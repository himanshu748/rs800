import copy
import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from .heat_index import CATEGORIES, category_index, heat_index_c, heat_index_f, c_to_f

DATA = Path(__file__).parent / "data"
SCENARIOS = {"lucknow-heatwave-01": DATA / "lucknow_heatwave.json"}
CITIES = {
    "Lucknow": (26.85, 80.95),
    "Delhi": (28.61, 77.21),
    "Jaipur": (26.91, 75.79),
    "Ahmedabad": (23.02, 72.57),
    "Mumbai": (19.08, 72.88),
}
OPEN_METEO = "https://api.open-meteo.com/v1/forecast"
LIVE_TTL_S = 30 * 60
_live_cache: dict[tuple, tuple[float, dict]] = {}


class WeatherUnavailable(Exception):
    pass


def load_scenario(scenario_id: str) -> dict:
    path = SCENARIOS.get(scenario_id)
    if not path:
        raise WeatherUnavailable(f"unknown demo scenario '{scenario_id}'")
    snap = json.loads(path.read_text())
    snap["mode"] = "demo"
    return snap


def fetch_live(city: str, date: str | None, tz: str = "Asia/Kolkata") -> dict:
    if city not in CITIES:
        raise WeatherUnavailable(f"unsupported city '{city}'")
    day = date or datetime.now(ZoneInfo(tz)).date().isoformat()
    key = (city, day)
    hit = _live_cache.get(key)
    if hit and time.time() - hit[0] < LIVE_TTL_S:
        return copy.deepcopy(hit[1])
    lat, lon = CITIES[city]
    q = urllib.parse.urlencode({
        "latitude": lat, "longitude": lon, "timezone": tz, "start_date": day, "end_date": day,
        "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation,uv_index",
    })
    try:
        with urllib.request.urlopen(f"{OPEN_METEO}?{q}", timeout=10) as r:
            body = json.loads(r.read())
    except Exception as e:
        raise WeatherUnavailable(f"Open-Meteo request failed: {e}") from e
    h = body.get("hourly") or {}
    times = h.get("time") or []
    if len(times) != 24 or any(v is None for v in h.get("temperature_2m", [None])):
        raise WeatherUnavailable("Open-Meteo returned incomplete hourly data")
    hourly = [
        {
            "time": times[i][-5:],
            "temperature_c": h["temperature_2m"][i],
            "relative_humidity": h["relative_humidity_2m"][i],
            "wind_kmh": h["wind_speed_10m"][i],
            "shortwave_wm2": h["shortwave_radiation"][i],
            "uv_index": h["uv_index"][i],
        }
        for i in range(24)
    ]
    snap = {
        "id": f"live-{city.lower()}-{day}", "name": f"{city} forecast for {day}", "city": city,
        "latitude": lat, "longitude": lon, "source": "Open-Meteo (open-meteo.com, CC BY 4.0)",
        "label": "LIVE FORECAST", "mode": "live", "date": day,
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "hourly": hourly,
    }
    _live_cache[key] = (time.time(), snap)
    return copy.deepcopy(snap)


def apply_delta(snapshot: dict, delta: float) -> dict:
    """Return a scenario copy shifted by delta °C. The input snapshot is never modified."""
    out = copy.deepcopy(snapshot)
    out["temperature_delta"] = delta
    if delta:
        out["mode"] = "simulated"
        out["label"] = f"SIMULATED: {'+' if delta > 0 else ''}{delta:g}°C ON {snapshot.get('label', '')}".strip()
        for row in out["hourly"]:
            row["temperature_c"] = round(row["temperature_c"] + delta, 1)
    return annotate(out)


def annotate(snapshot: dict) -> dict:
    for row in snapshot["hourly"]:
        hi_f = heat_index_f(c_to_f(row["temperature_c"]), row["relative_humidity"])
        row["heat_index_c"] = round(heat_index_c(row["temperature_c"], row["relative_humidity"]), 1)
        row["category_index"] = category_index(hi_f)
        row["category"] = CATEGORIES[row["category_index"]]
    return snapshot


def get_weather(mode: str, scenario_id: str | None, city: str, date: str | None, delta: float, tz: str) -> dict:
    base = load_scenario(scenario_id or "") if mode == "demo" else fetch_live(city, date, tz)
    return apply_delta(base, delta)
