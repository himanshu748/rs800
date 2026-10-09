"""CP-SAT work planner: lexicographic income, then modelled exposure, then closeness to booked times."""

import time
from collections import Counter
from dataclasses import dataclass

from ortools.sat.python import cp_model

from . import policy
from .models import Job, OptimizeRequest, to_hhmm, to_min

SLOT = 15
SCALE = 10
PHASE_LIMIT_S = 0.8


@dataclass
class Candidate:
    job: int
    start: int
    exposure: int
    recovery: int
    max_cat: int


class PlanValidationError(Exception):
    pass


def _cat_at(cats: list[int], minute: int) -> int:
    return cats[min(minute // 60, 23)]


def _job_slots(job: Job, start: int) -> range:
    return range(start, start + job.duration_minutes, SLOT)


def _exposure(job: Job, start: int, cats: list[int]) -> float:
    total = sum(policy.slot_exposure(job.environment, job.workload, _cat_at(cats, t)) for t in _job_slots(job, start))
    for t in range(start - job.travel_minutes, start, SLOT):
        total += policy.slot_exposure(policy.TRAVEL_ENVIRONMENT, policy.TRAVEL_WORKLOAD, _cat_at(cats, t))
    return total


def _blocked(job: Job, start: int, cats: list[int], experience: str) -> str | None:
    for t in _job_slots(job, start):
        r = policy.blocked_reason(job.environment, job.workload, _cat_at(cats, t), experience)
        if r:
            return r
    return None


def _overlaps(a: tuple[int, int], b: tuple[int, int]) -> bool:
    return a[0] < b[1] and b[0] < a[1]


def _fixed_conflicts(jobs: list[Job]) -> dict[int, int]:
    fixed = [i for i, j in enumerate(jobs) if not j.flexible]
    out: dict[int, int] = {}
    for a in fixed:
        for b in fixed:
            if a < b:
                sa, sb = to_min(jobs[a].booked_start), to_min(jobs[b].booked_start)
                ia = (sa - jobs[a].travel_minutes, sa + jobs[a].duration_minutes)
                ib = (sb - jobs[b].travel_minutes, sb + jobs[b].duration_minutes)
                if _overlaps(ia, ib):
                    out.setdefault(a, b)
                    out.setdefault(b, a)
    return out


def _candidates(req: OptimizeRequest, cats: list[int]):
    ws, we = to_min(req.working_hours.start), to_min(req.working_hours.end)
    cands: list[Candidate] = []
    why_none: dict[int, dict] = {}
    for i, job in enumerate(req.jobs):
        if job.flexible:
            starts = range(to_min(job.earliest_start), to_min(job.latest_finish) - job.duration_minutes + 1, SLOT)
        else:
            starts = [to_min(job.booked_start)]
        in_day = [s for s in starts if s - job.travel_minutes >= ws and s + job.duration_minutes <= we]
        blocks: Counter = Counter()
        for s in in_day:
            r = _blocked(job, s, cats, req.heat_work_experience)
            if r:
                blocks[r] += 1
                continue
            mc = max(_cat_at(cats, t) for t in _job_slots(job, s))
            cands.append(Candidate(i, s, round(_exposure(job, s, cats) * SCALE), policy.recovery_minutes(job.environment, mc), mc))
        if not in_day:
            why_none[i] = {"reason_code": "OUTSIDE_WORKDAY", "params": {}}
        elif not any(c.job == i for c in cands):
            peak = max(max(_cat_at(cats, t) for t in _job_slots(job, s)) for s in in_day)
            why_none[i] = {"reason_code": "BLOCKED_BY_HEAT_POLICY", "params": {"rule": blocks.most_common(1)[0][0], "peak_category_index": peak}}
    return cands, why_none


def _solve_phases(req: OptimizeRequest, cands: list[Candidate]):
    """Return (chosen candidates, proven_optimal, timed_out)."""
    jobs = req.jobs
    booked = [to_min(j.booked_start) for j in jobs]

    def build():
        m = cp_model.CpModel()
        x = [m.new_bool_var(f"x{k}") for k in range(len(cands))]
        intervals = []
        for k, c in enumerate(cands):
            j = jobs[c.job]
            size = j.travel_minutes + j.duration_minutes + c.recovery
            intervals.append(m.new_optional_fixed_size_interval_var(c.start - j.travel_minutes, size, x[k], f"i{k}"))
        m.add_no_overlap(intervals)
        for i in range(len(jobs)):
            m.add(sum(x[k] for k, c in enumerate(cands) if c.job == i) <= 1)
        income = sum(jobs[c.job].earnings * x[k] for k, c in enumerate(cands))
        exposure = sum(c.exposure * x[k] for k, c in enumerate(cands))
        drift = sum(abs(c.start - booked[c.job]) * x[k] for k, c in enumerate(cands))
        return m, x, income, exposure, drift

    def run(m):
        s = cp_model.CpSolver()
        s.parameters.max_time_in_seconds = PHASE_LIMIT_S
        s.parameters.num_workers = 1
        s.parameters.random_seed = 0
        return s, s.solve(m)

    ok = (cp_model.OPTIMAL, cp_model.FEASIBLE)
    m, x, income, exposure, drift = build()
    m.maximize(income)
    s, st = run(m)
    if st not in ok:
        return None, False, st == cp_model.UNKNOWN
    proven = st == cp_model.OPTIMAL
    max_income = int(s.objective_value)

    m, x, income, exposure, drift = build()
    if max_income >= req.target_income:
        m.add(income >= req.target_income)
    else:
        m.add(income == max_income)
    m.minimize(exposure)
    s, st = run(m)
    if st not in ok:
        return None, False, st == cp_model.UNKNOWN
    proven &= st == cp_model.OPTIMAL
    best_exposure = int(s.objective_value)
    chosen = [cands[k] for k in range(len(cands)) if s.value(x[k])]

    m, x, income, exposure, drift = build()
    m.add(income >= min(max_income, req.target_income))
    m.add(exposure == best_exposure)
    m.minimize(drift)
    s3, st = run(m)
    if st in ok:
        proven &= st == cp_model.OPTIMAL
        chosen = [cands[k] for k in range(len(cands)) if s3.value(x[k])]
    return sorted(chosen, key=lambda c: c.start), proven, False


def _validate(req: OptimizeRequest, chosen: list[Candidate], cats: list[int]) -> None:
    ws, we = to_min(req.working_hours.start), to_min(req.working_hours.end)
    seen = set()
    spans = []
    for c in chosen:
        j = req.jobs[c.job]
        if c.job in seen:
            raise PlanValidationError(f"{j.id} scheduled twice")
        seen.add(c.job)
        if c.start < to_min(j.earliest_start) or c.start + j.duration_minutes > to_min(j.latest_finish):
            raise PlanValidationError(f"{j.id} outside its window")
        if not j.flexible and c.start != to_min(j.booked_start):
            raise PlanValidationError(f"{j.id} fixed appointment moved")
        if c.start - j.travel_minutes < ws or c.start + j.duration_minutes > we:
            raise PlanValidationError(f"{j.id} outside workday")
        if _blocked(j, c.start, cats, req.heat_work_experience):
            raise PlanValidationError(f"{j.id} placed in a blocked slot")
        spans.append((c.start - j.travel_minutes, c.start + j.duration_minutes + c.recovery))
    for a in range(len(spans)):
        for b in range(a + 1, len(spans)):
            if _overlaps(spans[a], spans[b]):
                raise PlanValidationError("activities overlap")


def _baseline(req: OptimizeRequest, chosen: list[Candidate], cats: list[int]) -> tuple[int, list[dict]]:
    """The same jobs at (or as near as possible to) their booked times, with no heat rules."""
    jobs = [req.jobs[c.job] for c in chosen]
    if not jobs:
        return 0, []
    ws, we = to_min(req.working_hours.start), to_min(req.working_hours.end)
    m = cp_model.CpModel()
    picks = []
    for j in jobs:
        lo = max(to_min(j.earliest_start), ws + j.travel_minutes)
        hi = min(to_min(j.latest_finish), we) - j.duration_minutes
        starts = [to_min(j.booked_start)] if not j.flexible else list(range(lo, hi + 1, SLOT))
        xs = [(s, m.new_bool_var("")) for s in starts]
        m.add_exactly_one(v for _, v in xs)
        picks.append(xs)
    ivs = [m.new_optional_fixed_size_interval_var(s - j.travel_minutes, j.travel_minutes + j.duration_minutes, v, "")
           for j, xs in zip(jobs, picks) for s, v in xs]
    m.add_no_overlap(ivs)
    m.minimize(sum(abs(s - to_min(j.booked_start)) * v for j, xs in zip(jobs, picks) for s, v in xs))
    sv = cp_model.CpSolver()
    sv.parameters.num_workers = 1
    sv.parameters.max_time_in_seconds = PHASE_LIMIT_S
    if sv.solve(m) not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return 0, []
    total = 0.0
    rows = []
    for j, xs in zip(jobs, picks):
        s = next(s for s, v in xs if sv.value(v))
        total += _exposure(j, s, cats)
        rows.append({"job_id": j.id, "start": to_hhmm(s), "end": to_hhmm(s + j.duration_minutes),
                     "blocked_by": _blocked(j, s, cats, req.heat_work_experience)})
    return round(total * SCALE), sorted(rows, key=lambda r: r["start"])


def _scheduled_reason(req: OptimizeRequest, c: Candidate, cats: list[int]) -> dict:
    j = req.jobs[c.job]
    booked = to_min(j.booked_start)
    if j.environment == "indoor_cooled":
        code = "INDOOR_DURING_HEAT" if c.max_cat >= policy.DANGER else "INDOOR_COOLED"
        return {"reason_code": code, "params": {"peak_category_index": c.max_cat}}
    if not j.flexible:
        return {"reason_code": "FIXED_APPOINTMENT", "params": {}}
    if c.start == booked:
        return {"reason_code": "KEPT_BOOKED_TIME", "params": {}}
    blocked = _blocked(j, booked, cats, req.heat_work_experience)
    params = {"booked": to_hhmm(booked), "moved_to": to_hhmm(c.start),
              "booked_score": round(_exposure(j, booked, cats), 1), "new_score": round(c.exposure / SCALE, 1)}
    if blocked:
        return {"reason_code": "BOOKED_TIME_BLOCKED", "params": {**params, "rule": blocked}}
    return {"reason_code": "MOVED_TO_LOWER_EXPOSURE", "params": params}


def plan(req: OptimizeRequest, weather: dict) -> dict:
    t0 = time.perf_counter()
    cats = [row["category_index"] for row in weather["hourly"]]
    if len(cats) != 24:
        raise PlanValidationError("weather must have 24 hourly rows")
    conflicts = _fixed_conflicts(req.jobs)
    cands, why_none = _candidates(req, cats)
    chosen, proven, timed_out = ([], True, False) if not cands else _solve_phases(req, cands)
    runtime_ms = round((time.perf_counter() - t0) * 1000)

    base = {"target_income": req.target_income, "currency": "INR", "policy_version": policy.POLICY_VERSION,
            "heat_work_experience": req.heat_work_experience}
    if chosen is None:
        return {**base, "status": "solver_timeout" if timed_out else "no_feasible_plan", "scheduled_income": 0,
                "shortfall": req.target_income, "activities": [], "schedule": [], "unscheduled_jobs": [],
                "solver": {"name": "ortools_cp_sat", "status": "UNKNOWN" if timed_out else "INFEASIBLE", "runtime_ms": runtime_ms},
                "warnings": []}

    _validate(req, chosen, cats)
    income = sum(req.jobs[c.job].earnings for c in chosen)
    exposure = sum(c.exposure for c in chosen)
    base_score, base_rows = _baseline(req, chosen, cats)

    schedule, activities = [], []
    for c in chosen:
        j = req.jobs[c.job]
        end = c.start + j.duration_minutes
        reason = _scheduled_reason(req, c, cats)
        schedule.append({"job_id": j.id, "title": j.title, "start": to_hhmm(c.start), "end": to_hhmm(end),
                         "earnings": j.earnings, "environment": j.environment, "workload": j.workload,
                         "exposure_score": round(c.exposure / SCALE, 1), "peak_category_index": c.max_cat, **reason})
        if j.travel_minutes:
            activities.append({"type": "travel", "job_id": j.id, "start": to_hhmm(c.start - j.travel_minutes), "end": to_hhmm(c.start)})
        activities.append({"type": "job", "job_id": j.id, "start": to_hhmm(c.start), "end": to_hhmm(end)})
        if c.recovery:
            activities.append({"type": "recovery", "job_id": j.id, "start": to_hhmm(end), "end": to_hhmm(end + c.recovery),
                               "minutes": c.recovery})

    chosen_ids = {c.job for c in chosen}
    status = "target_met" if income >= req.target_income else ("target_not_met" if chosen else "no_feasible_plan")
    unscheduled = []
    for i, j in enumerate(req.jobs):
        if i in chosen_ids:
            continue
        if i in conflicts and conflicts[i] in chosen_ids:
            r = {"reason_code": "CONFLICTS_WITH_FIXED_APPOINTMENT", "params": {"other_job_id": req.jobs[conflicts[i]].id}}
        elif i in why_none:
            r = why_none[i]
        elif status == "target_met":
            r = {"reason_code": "TARGET_ALREADY_MET", "params": {}}
        else:
            r = {"reason_code": "NO_ROOM_IN_DAY", "params": {}}
        unscheduled.append({"job_id": j.id, "title": j.title, "earnings": j.earnings, **r})

    warnings = ["This plan is a scheduling prototype, not a certified occupational safety assessment."]
    if conflicts:
        warnings.append("Some fixed appointments overlap. Only one of each overlapping pair can be kept.")
    if req.heat_work_experience != "experienced":
        warnings.append("Not yet used to working in heat: stricter rules applied. Build up outdoor time gradually over 1 to 2 weeks.")
    if not proven:
        warnings.append("Solver hit its time limit. This plan is valid but not proven to be the best.")

    exposure_f = round(exposure / SCALE, 1)
    base_f = round(base_score / SCALE, 1)
    return {
        **base,
        "status": status,
        "scheduled_income": income,
        "shortfall": max(0, req.target_income - income),
        "max_available_income": sum(j.earnings for j in req.jobs),
        "relative_exposure_score": exposure_f,
        "baseline_exposure_score": base_f,
        "baseline_schedule": base_rows,
        "relative_score_reduction_percent": round(100 * (base_f - exposure_f) / base_f, 1) if base_f else 0.0,
        "solver": {"name": "ortools_cp_sat", "status": "OPTIMAL" if proven else "FEASIBLE",
                   "runtime_ms": round((time.perf_counter() - t0) * 1000), "candidates": len(cands)},
        "schedule": schedule,
        "activities": activities,
        "unscheduled_jobs": unscheduled,
        "warnings": warnings,
    }
