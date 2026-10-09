import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.models import OptimizeRequest, to_min
from app.optimizer import plan
from app.policy import blocked_reason
from app.weather import annotate, apply_delta, get_weather, load_scenario
from app.heat_index import heat_index_f

DEMO = json.loads((Path(__file__).parents[1] / "app/data/demo_jobs.json").read_text())


def job(**kw):
    base = {"id": "j", "title": "t", "earnings": 100, "duration_minutes": 60, "earliest_start": "06:00",
            "latest_finish": "19:00", "environment": "indoor_cooled", "workload": "light"}
    return {**base, **kw}


def flat_weather(temp_c=25.0, rh=40):
    return annotate({"mode": "demo", "hourly": [{"time": f"{h:02d}:00", "temperature_c": temp_c, "relative_humidity": rh}
                                                for h in range(24)]})


def run(jobs, target=800, weather=None, **kw):
    req = OptimizeRequest(target_income=target, jobs=jobs, **kw)
    return plan(req, weather or flat_weather())


def demo(delta):
    req = OptimizeRequest(target_income=800, jobs=DEMO["jobs"], temperature_delta=delta)
    return plan(req, get_weather("demo", "lucknow-heatwave-01", "Lucknow", None, delta, "Asia/Kolkata"))


def test_heat_index_matches_nws_table():
    # NWS chart: 96°F at 50% RH is about 108°F
    assert round(heat_index_f(96, 50)) in (107, 108)
    assert heat_index_f(70, 50) < 80


def test_ut001_income_sum():
    p = run([job(id="a", earnings=300), job(id="b", earnings=250), job(id="c", earnings=250)])
    assert p["status"] == "target_met" and p["scheduled_income"] == 800


def test_ut002_fixed_overlap_never_both():
    jobs = [job(id="a", earnings=500, flexible=False, preferred_start="09:00"),
            job(id="b", earnings=500, flexible=False, preferred_start="09:30")]
    p = run(jobs, target=1000)
    assert len(p["schedule"]) == 1
    assert p["unscheduled_jobs"][0]["reason_code"] == "CONFLICTS_WITH_FIXED_APPOINTMENT"


def test_ut003_availability_window():
    p = run([job(id="a", earliest_start="08:00", latest_finish="10:00")], target=100)
    s = p["schedule"][0]
    assert to_min(s["start"]) >= 480 and to_min(s["end"]) <= 600


def test_ut004_shortfall():
    p = run([job(id="a", earnings=400), job(id="b", earnings=250)])
    assert (p["status"], p["scheduled_income"], p["shortfall"]) == ("target_not_met", 650, 150)


def test_ut005_heavy_direct_sun_never_in_danger():
    hot = flat_weather(40, 50)
    p = run([job(id="a", environment="direct_sun", workload="heavy", earnings=900)], weather=hot)
    assert p["schedule"] == [] and p["unscheduled_jobs"][0]["reason_code"] == "BLOCKED_BY_HEAT_POLICY"


def test_ut006_scenario_recomputes_without_mutating_original():
    base = load_scenario("lucknow-heatwave-01")
    before = json.dumps(base, sort_keys=True)
    hot = apply_delta(base, 5)
    assert json.dumps(base, sort_keys=True) == before
    assert hot["mode"] == "simulated"
    assert hot["hourly"][7]["category_index"] > apply_delta(base, 0)["hourly"][7]["category_index"]


def test_ut007_deterministic():
    a, b = demo(0), demo(0)
    strip = lambda p: {k: v for k, v in p.items() if k != "solver"}
    assert strip(a) == strip(b)


def test_ut008_invalid_inputs():
    with pytest.raises(ValidationError):
        OptimizeRequest(target_income=800, jobs=[job(earnings=-5)])
    with pytest.raises(ValidationError):
        OptimizeRequest(target_income=800, jobs=[job(earliest_start="09:00", latest_finish="09:30")])
    with pytest.raises(ValidationError):
        OptimizeRequest(target_income=800, working_hours={"start": "19:00", "end": "06:00"})


def test_ut009_no_jobs():
    assert run([])["status"] == "no_feasible_plan"


def test_ut010_target_never_relaxes_policy():
    hot = flat_weather(40, 50)
    jobs = [job(id="a", environment="direct_sun", workload="moderate", earnings=5000)]
    for target in (100, 5000, 100000):
        assert run(jobs, target=target, weather=hot)["scheduled_income"] == 0


def test_travel_and_recovery_do_not_overlap_work():
    p = demo(0)
    spans = sorted((to_min(a["start"]), to_min(a["end"])) for a in p["activities"])
    for (s1, e1), (s2, e2) in zip(spans, spans[1:]):
        assert e1 <= s2
    assert any(a["type"] == "recovery" for a in p["activities"])
    assert any(a["type"] == "travel" for a in p["activities"])


def test_demo_transition_800_to_650():
    normal, hot = demo(0), demo(5)
    assert normal["status"] == "target_met" and normal["scheduled_income"] == 800
    assert hot["status"] == "target_not_met" and hot["scheduled_income"] == 650 and hot["shortfall"] == 150
    dropped = {u["job_id"]: u["reason_code"] for u in hot["unscheduled_jobs"]}
    assert dropped == {"job-001": "BLOCKED_BY_HEAT_POLICY"}
    assert normal["relative_exposure_score"] < normal["baseline_exposure_score"]


def test_experienced_worker_keeps_rooftop_in_danger():
    assert blocked_reason("direct_sun", "moderate", 3, "experienced") is None
    assert blocked_reason("direct_sun", "moderate", 3, "unknown") is not None
    assert blocked_reason("shaded_outdoor", "light", 4, "experienced") is not None
