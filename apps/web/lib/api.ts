export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

export type Environment = "indoor_cooled" | "indoor_uncooled" | "shaded_outdoor" | "direct_sun";
export type Workload = "light" | "moderate" | "heavy";
export type Experience = "new" | "experienced" | "unknown";

export interface Job {
  id: string;
  title: string;
  earnings: number;
  duration_minutes: number;
  earliest_start: string;
  latest_finish: string;
  preferred_start?: string | null;
  environment: Environment;
  workload: Workload;
  location_zone: string;
  travel_minutes: number;
  flexible: boolean;
  confirmed: boolean;
}

export interface DraftJob extends Partial<Omit<Job, "id">> {
  id: string;
  title: string;
  title_en?: string;
  missing?: string[];
}

export interface HourlyWeather {
  time: string;
  temperature_c: number;
  relative_humidity: number;
  heat_index_c: number;
  category_index: number;
  category: string;
}

export interface Weather {
  id: string;
  name: string;
  city: string;
  source: string;
  label: string;
  mode: "demo" | "live" | "simulated";
  temperature_delta: number;
  fetched_at?: string;
  note?: string;
  hourly: HourlyWeather[];
}

export interface Reason {
  reason_code: string;
  params: Record<string, string | number>;
}

export interface ScheduledJob extends Reason {
  job_id: string;
  title: string;
  start: string;
  end: string;
  earnings: number;
  environment: Environment;
  workload: Workload;
  exposure_score: number;
  peak_category_index: number;
}

export interface Activity {
  type: "job" | "travel" | "recovery";
  job_id: string;
  start: string;
  end: string;
  minutes?: number;
}

export interface UnscheduledJob extends Reason {
  job_id: string;
  title: string;
  earnings: number;
}

export interface Diff {
  income_before: number;
  income_after: number;
  removed: (Reason & { job_id: string; title: string; earnings: number })[];
  added: { job_id: string; title: string; earnings: number; start: string }[];
  moved: { job_id: string; title: string; from: string; to: string }[];
}

export interface Plan {
  plan_id: string;
  parent_plan_id: string | null;
  created_at: string;
  mode: Weather["mode"];
  status: "target_met" | "target_not_met" | "no_feasible_plan" | "weather_unavailable" | "solver_timeout";
  target_income: number;
  scheduled_income: number;
  shortfall: number;
  max_available_income: number;
  relative_exposure_score: number;
  baseline_exposure_score: number;
  relative_score_reduction_percent: number;
  baseline_schedule: { job_id: string; start: string; end: string; blocked_by: string | null }[];
  solver: { name: string; status: string; runtime_ms: number; candidates: number };
  infra?: { compute: string; region: string; store: string };
  heat_work_experience: Experience;
  schedule: ScheduledJob[];
  activities: Activity[];
  unscheduled_jobs: UnscheduledJob[];
  warnings: string[];
  weather: Weather;
  request: { jobs: Job[]; working_hours: { start: string; end: string }; temperature_delta: number };
  diff?: Diff;
}

export interface PlanInput {
  target_income: number;
  location: { city: string };
  working_hours: { start: string; end: string };
  heat_work_experience: Experience;
  weather: { mode: "demo" | "live"; scenario_id: string };
  jobs: Job[];
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) throw new ApiError(0, "NEXT_PUBLIC_API_URL is not set");
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers || {}) },
    });
  } catch {
    throw new ApiError(0, "network");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = body?.detail;
    const msg = typeof d === "string" ? d : d?.detail || d?.status || JSON.stringify(d ?? body);
    throw new ApiError(res.status, msg);
  }
  return body as T;
}

export const api = {
  optimize: (input: PlanInput) => call<Plan>("/plans/optimize", { method: "POST", body: JSON.stringify(input) }),
  simulate: (id: string, delta: number) =>
    call<Plan>(`/plans/${id}/simulate`, { method: "POST", body: JSON.stringify({ temperature_delta: delta }) }),
  getPlan: (id: string) => call<Plan>(`/plans/${id}`),
  parseJobs: (text: string, language: "en" | "hi") =>
    call<{ jobs: DraftJob[]; model: string }>("/jobs/parse", { method: "POST", body: JSON.stringify({ text, language }) }),
  methodology: () => call<Record<string, unknown>>("/methodology"),
};
