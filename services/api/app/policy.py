"""Prototype heat-planning policy and exposure weights.

These are product guardrails and ranking coefficients for a hackathon prototype.
They are not NIOSH, OSHA or IMD thresholds and are not validated relative risks.
"""

POLICY_VERSION = "prototype-v1"

WEATHER_WEIGHT = [1.0, 1.5, 2.5, 4.0, 6.0]
WORKLOAD_WEIGHT = {"light": 1.0, "moderate": 1.4, "heavy": 1.8}
ENVIRONMENT_WEIGHT = {
    "indoor_cooled": 0.2,
    "indoor_uncooled": 0.8,
    "shaded_outdoor": 0.8,
    "direct_sun": 1.2,
}
# Travel between jobs is modelled as light work in direct sun (two-wheeler or on foot).
TRAVEL_ENVIRONMENT = "direct_sun"
TRAVEL_WORKLOAD = "light"

DANGER = 3
EXTREME_DANGER = 4


def blocked_reason(environment: str, workload: str, category: int, experience: str) -> str | None:
    """Return why a 15-minute slot is off limits for this job, or None if allowed."""
    if environment == "indoor_cooled":
        return None
    if category >= EXTREME_DANGER:
        return "EXTREME_DANGER_NO_UNCOOLED_WORK"
    if category >= DANGER:
        if workload == "heavy":
            return "DANGER_NO_HEAVY_WORK"
        # Workers not used to heat get the stricter rule: no direct sun at all in Danger.
        if environment == "direct_sun" and experience != "experienced":
            return "DANGER_NO_DIRECT_SUN_UNACCLIMATIZED"
    return None


def recovery_minutes(environment: str, max_category: int) -> int:
    """Explicit rest block required after a job, by the hottest slot the job touched."""
    if environment == "indoor_cooled":
        return 0
    if max_category >= DANGER:
        return 30
    if max_category >= 2:
        return 15
    return 0


def slot_exposure(environment: str, workload: str, category: int, minutes: int = 15) -> float:
    return minutes * WEATHER_WEIGHT[category] * WORKLOAD_WEIGHT[workload] * ENVIRONMENT_WEIGHT[environment]


def describe() -> dict:
    return {
        "version": POLICY_VERSION,
        "occupational_safety_validated": False,
        "heat_index": "NWS Rothfusz regression on forecast air temperature and relative humidity (shade assumed)",
        "categories_f": {"caution": "80-89", "extreme_caution": "90-102", "danger": "103-124", "extreme_danger": ">=125"},
        "rules": [
            "Extreme danger: no work outside a cooled indoor space.",
            "Danger: no heavy work outside a cooled indoor space.",
            "Danger: no direct-sun work unless the worker says they are used to working in heat.",
            "Recovery after an uncooled job: 15 min if it touched extreme caution, 30 min if it touched danger.",
            "Missing weather means no heat-aware plan.",
            "The income target never relaxes any rule above.",
        ],
        "rule_codes": ["EXTREME_DANGER", "DANGER_HEAVY", "DANGER_DIRECT_SUN", "RECOVERY", "NO_WEATHER", "TARGET_NEVER_RELAXES"],
        "limitation_codes": ["SCORE_NOT_RISK", "FORECAST_NOT_WBGT", "COOLED_ASSUMPTION", "REST_PROTOTYPE"],
        "weights": {
            "weather": dict(zip(["below_caution", "caution", "extreme_caution", "danger", "extreme_danger"], WEATHER_WEIGHT)),
            "workload": WORKLOAD_WEIGHT,
            "environment": ENVIRONMENT_WEIGHT,
        },
        "limitations": [
            "Exposure score is a ranking heuristic for scheduling, not a medical risk estimate.",
            "Forecasts are not onsite measurements. Heat index is not WBGT.",
            "Indoor cooled assumes working cooling. A hot, unventilated room is not cooled.",
            "Rest blocks are prototype constraints, not individual work/rest prescriptions.",
        ],
    }
