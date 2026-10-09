"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Job, Plan, PlanInput } from "./api";
import demo from "./demo_jobs.json";

export const DEMO_SCENARIO = "lucknow-heatwave-01";
export const CITIES = ["Lucknow", "Delhi", "Jaipur", "Ahmedabad", "Mumbai"];

export const DEFAULT_INPUT: PlanInput = {
  target_income: 800,
  location: { city: "Lucknow" },
  working_hours: { start: "06:00", end: "19:00" },
  heat_work_experience: "unknown",
  weather: { mode: "demo", scenario_id: DEMO_SCENARIO },
  jobs: [],
};

export function demoInput(): PlanInput {
  return {
    ...DEFAULT_INPUT,
    target_income: demo.target_income,
    working_hours: demo.working_hours,
    jobs: demo.jobs as Job[],
  };
}

interface State {
  input: PlanInput;
  setInput: (f: (p: PlanInput) => PlanInput) => void;
  plans: Record<string, Plan>;
  savePlan: (p: Plan) => void;
  ready: boolean;
}

const Ctx = createContext<State | null>(null);
const KEY = "rs800.input.v1";

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [input, setInputState] = useState<PlanInput>(DEFAULT_INPUT);
  const [plans, setPlans] = useState<Record<string, Plan>>({});
  const [ready, setReady] = useState(false);

  // Static export renders without localStorage, so saved input can only be applied after mount.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setInputState({ ...DEFAULT_INPUT, ...JSON.parse(raw) });
    } catch {}
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(input));
    } catch {}
  }, [input, ready]);

  const value: State = {
    input,
    setInput: (f) => setInputState((p) => f(p)),
    plans,
    savePlan: (p) => setPlans((all) => ({ ...all, [p.plan_id]: p })),
    ready,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlanner() {
  const v = useContext(Ctx);
  if (!v) throw new Error("PlannerProvider missing");
  return v;
}

export const MAX_FORECAST_DAYS = 6;

export function istDate(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function requestBody(input: PlanInput): PlanInput {
  if (input.weather.mode !== "live") return { ...input, date: null };
  const today = istDate();
  const last = istDate(MAX_FORECAST_DAYS);
  const d = input.date && input.date >= today && input.date <= last ? input.date : today;
  return { ...input, date: d };
}

export function toMin(t: string) {
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
}
