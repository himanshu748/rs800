import json
import os
import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from . import parse_jobs, policy
from .models import OptimizeRequest, ParseRequest, SimulateRequest
from .optimizer import PlanValidationError, plan
from .store import PlanStore
from .weather import CITIES, SCENARIOS, WeatherUnavailable, get_weather


app = FastAPI(title="₹800 planning API", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o],
    allow_methods=["GET", "POST"],
    allow_headers=["content-type"],
)
api = APIRouter(prefix="/api/v1")
store = PlanStore()


def _event(name: str, **fields) -> None:
    print(json.dumps({"event": name, **fields}, ensure_ascii=False), flush=True)


def _weather_for(req: OptimizeRequest) -> dict:
    try:
        return get_weather(req.weather.mode, req.weather.scenario_id, req.location.city, req.date,
                           req.temperature_delta, req.timezone)
    except WeatherUnavailable as e:
        _event("weather_unavailable", detail=str(e))
        raise HTTPException(503, {"status": "weather_unavailable", "detail": str(e)})


def _run(req: OptimizeRequest, parent: dict | None = None) -> dict:
    parent_id = parent["plan_id"] if parent else None
    weather = _weather_for(req)
    try:
        result = plan(req, weather)
    except PlanValidationError as e:
        _event("plan_validation_failed", detail=str(e))
        raise HTTPException(500, "solver output failed validation")
    plan_id = f"plan-{uuid.uuid4().hex[:12]}"
    record = {
        "plan_id": plan_id,
        "parent_plan_id": parent_id,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mode": weather["mode"],
        "infra": {
            "compute": f"AWS Lambda {os.environ['AWS_LAMBDA_FUNCTION_NAME']}" if os.environ.get("AWS_LAMBDA_FUNCTION_NAME") else "local",
            "region": os.environ.get("AWS_REGION", "-"),
            "store": "Amazon DynamoDB" if store.backend.startswith("dynamodb") else "memory",
        },
        "request": req.model_dump(),
        "weather": weather,
        **result,
    }
    if parent:
        record["diff"] = _diff(parent, record)
    store.put(plan_id, record)
    _event("plan_generated", plan_id=plan_id, parent_plan_id=parent_id, status=result["status"],
           target=req.target_income, income=result["scheduled_income"], shortfall=result["shortfall"],
           delta=req.temperature_delta, mode=weather["mode"], jobs=len(req.jobs),
           runtime_ms=result["solver"]["runtime_ms"], store=store.backend)
    return record


def _diff(before: dict, after: dict) -> dict:
    b = {s["job_id"]: s for s in before["schedule"]}
    a = {s["job_id"]: s for s in after["schedule"]}
    un = {u["job_id"]: u for u in after["unscheduled_jobs"]}
    return {
        "income_before": before["scheduled_income"],
        "income_after": after["scheduled_income"],
        "removed": [{"job_id": k, "title": v["title"], "earnings": v["earnings"],
                     "reason_code": un.get(k, {}).get("reason_code"), "params": un.get(k, {}).get("params", {})}
                    for k, v in b.items() if k not in a],
        "added": [{"job_id": k, "title": v["title"], "earnings": v["earnings"], "start": v["start"]}
                  for k, v in a.items() if k not in b],
        "moved": [{"job_id": k, "title": v["title"], "from": b[k]["start"], "to": v["start"]}
                  for k, v in a.items() if k in b and b[k]["start"] != v["start"]],
    }


@api.get("/health")
def health():
    return {"ok": True, "store": store.backend, "time": int(time.time())}


@api.get("/methodology")
def methodology():
    return policy.describe()


@api.get("/scenarios")
def scenarios():
    return {"demo": list(SCENARIOS), "cities": list(CITIES)}


@api.get("/weather")
def weather(mode: str = "demo", scenario_id: str = "lucknow-heatwave-01", city: str = "Lucknow",
            date: str | None = None, delta: float = Query(0.0, ge=-2, le=6)):
    if mode not in ("demo", "live"):
        raise HTTPException(422, "mode must be demo or live")
    try:
        return get_weather(mode, scenario_id, city, date, delta, "Asia/Kolkata")
    except WeatherUnavailable as e:
        raise HTTPException(503, {"status": "weather_unavailable", "detail": str(e)})


@api.post("/plans/optimize")
def optimize(req: OptimizeRequest):
    return _run(req)


@api.get("/plans/{plan_id}")
def get_plan(plan_id: str):
    rec = store.get(plan_id)
    if not rec:
        raise HTTPException(404, "plan not found")
    return rec


@api.post("/plans/{plan_id}/simulate")
def simulate(plan_id: str, body: SimulateRequest):
    parent = store.get(plan_id)
    if not parent:
        raise HTTPException(404, "plan not found")
    req = OptimizeRequest(**{**parent["request"], "temperature_delta": body.temperature_delta})
    rec = _run(req, parent=parent)
    _event("plan_recalculated", plan_id=rec["plan_id"], parent_plan_id=plan_id, delta=body.temperature_delta,
           removed=[r["job_id"] for r in rec["diff"]["removed"]], income_before=parent["scheduled_income"],
           income_after=rec["scheduled_income"])
    return rec


@api.post("/jobs/parse")
def parse(body: ParseRequest):
    try:
        out = parse_jobs.parse(body.text, body.language)
    except Exception as e:
        _event("jobs_parse_failed", provider=parse_jobs.provider(), detail=str(e)[:500])
        raise HTTPException(502, "could not read the jobs from that text, please add them by hand")
    _event("jobs_parsed", count=len(out["jobs"]), model=out["model"], language=body.language)
    return out


app.include_router(api)
handler = Mangum(app, lifespan="off")
