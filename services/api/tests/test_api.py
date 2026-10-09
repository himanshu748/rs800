import json
from pathlib import Path

from fastapi.testclient import TestClient

from app import parse_jobs
from app.main import app

client = TestClient(app)
DEMO = json.loads((Path(__file__).parents[1] / "app/data/demo_jobs.json").read_text())
BODY = {"target_income": 800, "jobs": DEMO["jobs"], "weather": {"mode": "demo", "scenario_id": "lucknow-heatwave-01"}}


def test_health():
    assert client.get("/api/v1/health").json()["ok"] is True


def test_optimize_then_simulate_links_and_diffs():
    r = client.post("/api/v1/plans/optimize", json=BODY)
    assert r.status_code == 200
    p = r.json()
    assert p["status"] == "target_met" and p["mode"] == "demo"
    s = client.post(f"/api/v1/plans/{p['plan_id']}/simulate", json={"temperature_delta": 3}).json()
    assert s["parent_plan_id"] == p["plan_id"] and s["mode"] == "simulated"
    assert [r["job_id"] for r in s["diff"]["removed"]] == ["job-001"]
    stored = client.get(f"/api/v1/plans/{s['plan_id']}").json()
    assert stored["scheduled_income"] == 650
    assert stored["diff"] == s["diff"] and stored["diff"]["removed"][0]["job_id"] == "job-001"


def test_unknown_scenario_is_503_not_fabricated():
    body = {**BODY, "weather": {"mode": "demo", "scenario_id": "made-up"}}
    r = client.post("/api/v1/plans/optimize", json=body)
    assert r.status_code == 503 and r.json()["detail"]["status"] == "weather_unavailable"


def test_malformed_is_422_and_missing_plan_404():
    assert client.post("/api/v1/plans/optimize", json={"target_income": -1}).status_code == 422
    assert client.get("/api/v1/plans/plan-nope").status_code == 404


def test_parse_clean_flags_missing_fields():
    j = parse_jobs._clean({"title": "छत की वायरिंग", "earnings": 300, "duration_minutes": 50,
                           "environment": "direct_sun", "workload": None})
    assert j["duration_minutes"] == 45 and j["confirmed"] is False
    assert set(j["missing"]) == {"earliest_start", "latest_finish", "workload"}
