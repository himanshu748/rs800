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
    assert j["duration_minutes"] == 60 and j["confirmed"] is False
    assert set(j["missing"]) == {"earliest_start", "latest_finish", "workload"}


def test_parse_clean_never_loosens_off_grid_values():
    j = parse_jobs._clean({"title": "Pump", "earnings": 250, "duration_minutes": 50, "travel_minutes": 20,
                           "earliest_start": "08:05", "latest_finish": "10:10", "preferred_start": "08:50",
                           "environment": "shaded_outdoor", "workload": "moderate"})
    assert (j["duration_minutes"], j["travel_minutes"]) == (60, 30)
    assert (j["earliest_start"], j["latest_finish"], j["preferred_start"]) == ("08:15", "10:00", "09:00")
    assert {a["field"]: (a["from"], a["to"]) for a in j["adjusted"]} == {
        "duration_minutes": (50, 60), "travel_minutes": (20, 30), "earliest_start": ("08:05", "08:15"),
        "latest_finish": ("10:10", "10:00"), "preferred_start": ("08:50", "09:00")}
    on_grid = parse_jobs._clean({"title": "AC", "earnings": 250, "duration_minutes": 60, "earliest_start": "10:00",
                                 "latest_finish": "12:00", "environment": "indoor_cooled", "workload": "light"})
    assert on_grid["adjusted"] == []


def _live_snapshot(temp_c):
    from app.weather import annotate
    return annotate({"id": "live-lucknow-x", "mode": "live", "label": "LIVE FORECAST", "city": "Lucknow",
                     "hourly": [{"time": f"{h:02d}:00", "temperature_c": temp_c, "relative_humidity": 40,
                                 "wind_kmh": 5, "shortwave_wm2": 0, "uv_index": 0} for h in range(24)]})


def _live_jobs():
    return [{"id": "a", "title": "AC repair", "earnings": 500, "duration_minutes": 60, "earliest_start": "08:00",
             "latest_finish": "18:00", "environment": "indoor_cooled", "workload": "light"}]


def test_live_replan_shifts_the_stored_forecast_not_a_refetch(monkeypatch):
    from app import weather
    temps = iter([25.0, 40.0])
    monkeypatch.setattr(weather, "fetch_live", lambda *a, **k: _live_snapshot(next(temps)))
    p = client.post("/api/v1/plans/optimize", json={"target_income": 500, "jobs": _live_jobs(),
                                                     "weather": {"mode": "live"}}).json()
    assert p["weather"]["hourly"][12]["temperature_c"] == 25.0

    def outage(*a, **k):
        raise weather.WeatherUnavailable("down")

    monkeypatch.setattr(weather, "fetch_live", outage)
    r = client.post(f"/api/v1/plans/{p['plan_id']}/simulate", json={"temperature_delta": 1})
    assert r.status_code == 200
    assert {h["temperature_c"] for h in r.json()["weather"]["hourly"]} == {26.0}
    again = client.post(f"/api/v1/plans/{r.json()['plan_id']}/simulate", json={"temperature_delta": 2}).json()
    assert {h["temperature_c"] for h in again["weather"]["hourly"]} == {27.0}


def test_past_dated_stored_plan_can_still_be_replanned():
    from datetime import date, timedelta
    from app.main import store
    p = client.post("/api/v1/plans/optimize", json=BODY).json()
    rec = store.get(p["plan_id"])
    rec["request"]["date"] = (date.today() - timedelta(days=2)).isoformat()
    store.put(p["plan_id"], rec)
    r = client.post(f"/api/v1/plans/{p['plan_id']}/simulate", json={"temperature_delta": 3})
    assert r.status_code == 200 and r.json()["scheduled_income"] == 650


def test_incomplete_live_forecast_is_503(monkeypatch):
    import io
    from app import weather
    weather._live_cache.clear()
    hourly = {"time": [f"2026-10-11T{h:02d}:00" for h in range(24)], **{k: [30.0] * 24 for k in weather.HOURLY_FIELDS}}
    hourly["relative_humidity_2m"][13] = None
    monkeypatch.setattr(weather.urllib.request, "urlopen",
                        lambda *a, **k: io.BytesIO(json.dumps({"hourly": hourly}).encode()))
    r = client.post("/api/v1/plans/optimize", json={"target_income": 500, "jobs": _live_jobs(), "weather": {"mode": "live"}})
    assert r.status_code == 503 and r.json()["detail"]["status"] == "weather_unavailable"


def test_overlarge_pay_is_422():
    jobs = [{**_live_jobs()[0], "earnings": 100_001}]
    assert client.post("/api/v1/plans/optimize", json={"target_income": 500, "jobs": jobs}).status_code == 422
