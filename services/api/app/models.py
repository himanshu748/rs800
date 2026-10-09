import re
from datetime import date as date_cls, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field, field_validator, model_validator

TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
MAX_FORECAST_DAYS = 6

Environment = Literal["indoor_cooled", "indoor_uncooled", "shaded_outdoor", "direct_sun"]
Workload = Literal["light", "moderate", "heavy"]
Experience = Literal["new", "experienced", "unknown"]
PlanStatus = Literal["target_met", "target_not_met", "no_feasible_plan", "weather_unavailable", "solver_timeout"]


def to_min(t: str) -> int:
    return int(t[:2]) * 60 + int(t[3:])


def to_hhmm(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"


def _check_time(v: str) -> str:
    if not TIME_RE.match(v):
        raise ValueError("time must be HH:MM (24h)")
    if to_min(v) % 15:
        raise ValueError("time must be on a 15-minute step")
    return v


class Job(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=100)
    earnings: int = Field(gt=0, le=100_000)
    duration_minutes: int = Field(ge=15, le=480)
    earliest_start: str
    latest_finish: str
    preferred_start: str | None = None
    environment: Environment
    workload: Workload
    location_zone: str = Field(default="", max_length=40)
    travel_minutes: int = Field(default=0, ge=0, le=120)
    flexible: bool = True
    confirmed: bool = True

    @field_validator("earliest_start", "latest_finish", "preferred_start")
    @classmethod
    def _times(cls, v: str | None) -> str | None:
        return v if v is None else _check_time(v)

    @field_validator("duration_minutes", "travel_minutes")
    @classmethod
    def _step(cls, v: int) -> int:
        if v % 15:
            raise ValueError("must be a multiple of 15 minutes")
        return v

    @model_validator(mode="after")
    def _window(self):
        if to_min(self.earliest_start) + self.duration_minutes > to_min(self.latest_finish):
            raise ValueError(f"job '{self.title}' does not fit inside its availability window")
        if self.preferred_start is not None:
            p = to_min(self.preferred_start)
            if p < to_min(self.earliest_start) or p + self.duration_minutes > to_min(self.latest_finish):
                raise ValueError(f"job '{self.title}' booked time is outside its window")
        return self

    @property
    def booked_start(self) -> str:
        return self.preferred_start or self.earliest_start


class WorkingHours(BaseModel):
    start: str = "06:00"
    end: str = "19:00"

    @field_validator("start", "end")
    @classmethod
    def _times(cls, v: str) -> str:
        return _check_time(v)

    @model_validator(mode="after")
    def _order(self):
        if to_min(self.end) <= to_min(self.start):
            raise ValueError("workday end must be after start")
        return self


class Location(BaseModel):
    city: str = "Lucknow"
    latitude: float | None = None
    longitude: float | None = None


class WeatherRequest(BaseModel):
    mode: Literal["demo", "live"] = "demo"
    scenario_id: str | None = "lucknow-heatwave-01"


class OptimizeRequest(BaseModel):
    target_income: int = Field(ge=100, le=100_000)
    currency: Literal["INR"] = "INR"
    date: str | None = None
    timezone: str = "Asia/Kolkata"
    location: Location = Location()
    working_hours: WorkingHours = WorkingHours()
    heat_work_experience: Experience = "unknown"
    weather: WeatherRequest = WeatherRequest()
    temperature_delta: float = Field(default=0.0, ge=-2, le=6)
    jobs: list[Job] = Field(default_factory=list, max_length=20)

    @field_validator("date")
    @classmethod
    def _forecast_date(cls, v: str | None) -> str | None:
        if v is None:
            return v
        try:
            d = date_cls.fromisoformat(v)
        except ValueError:
            raise ValueError("date must be YYYY-MM-DD")
        today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
        if not today <= d <= today + timedelta(days=MAX_FORECAST_DAYS):
            raise ValueError(f"date must be today or up to {MAX_FORECAST_DAYS} days ahead")
        return v

    @model_validator(mode="after")
    def _unique_ids(self):
        ids = [j.id for j in self.jobs]
        if len(ids) != len(set(ids)):
            raise ValueError("job ids must be unique")
        return self


class SimulateRequest(BaseModel):
    temperature_delta: float = Field(ge=-2, le=6)


class ParseRequest(BaseModel):
    text: str = Field(min_length=3, max_length=2000)
    language: Literal["en", "hi"] = "hi"
