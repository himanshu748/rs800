"use client";

import { useState } from "react";
import type { DraftJob, Environment, Job, Workload } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { toMin } from "@/lib/store";

const TIMES = Array.from({ length: (22 - 5) * 4 + 1 }, (_, i) => {
  const m = 5 * 60 + i * 15;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});
const ENVS: Environment[] = ["direct_sun", "shaded_outdoor", "indoor_uncooled", "indoor_cooled"];
const LOADS: Workload[] = ["light", "moderate", "heavy"];

export const field =
  "min-h-11 w-full rounded-lg border border-border bg-bg px-3 text-base text-text focus:border-heat aria-[invalid=true]:border-critical";

function snap(t?: string | null) {
  if (!t || !/^\d{2}:\d{2}$/.test(t)) return undefined;
  const m = Math.round(toMin(t) / 15) * 15;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function validate(j: Partial<Job>): Record<string, string> {
  const e: Record<string, string> = {};
  if (!j.title?.trim()) e.title = "Required";
  if (!j.earnings || j.earnings <= 0) e.earnings = "Must be more than ₹0";
  if (!j.duration_minutes || j.duration_minutes < 15 || j.duration_minutes > 480 || j.duration_minutes % 15)
    e.duration_minutes = "15 to 480, in steps of 15";
  if (!j.earliest_start) e.earliest_start = "Required";
  if (!j.latest_finish) e.latest_finish = "Required";
  if (j.earliest_start && j.latest_finish && j.duration_minutes && toMin(j.earliest_start) + j.duration_minutes > toMin(j.latest_finish))
    e.latest_finish = "The job doesn't fit in this window";
  if (j.preferred_start && j.earliest_start && j.latest_finish && j.duration_minutes) {
    const p = toMin(j.preferred_start);
    if (p < toMin(j.earliest_start) || p + j.duration_minutes > toMin(j.latest_finish)) e.preferred_start = "Outside the window";
  }
  if (!j.environment) e.environment = "Required";
  if (!j.workload) e.workload = "Required";
  if ((j.travel_minutes ?? 0) % 15) e.travel_minutes = "Steps of 15";
  return e;
}

export function JobForm({ initial, onSave, onCancel }: { initial: DraftJob | Job; onSave: (j: Job) => void; onCancel: () => void }) {
  const { t } = useT();
  const [j, setJ] = useState<Partial<Job> & { id: string }>({
    location_zone: "",
    travel_minutes: 0,
    flexible: true,
    ...initial,
    earliest_start: snap(initial.earliest_start),
    latest_finish: snap(initial.latest_finish),
    preferred_start: snap(initial.preferred_start) ?? null,
  });
  const [tried, setTried] = useState(false);
  const errors = validate(j);
  const set = <K extends keyof Job>(k: K, v: Job[K]) => setJ((p) => ({ ...p, [k]: v }));
  const err = (k: string) =>
    tried && errors[k] ? (
      <span role="alert" className="mt-1 block text-sm text-critical">
        {errors[k]}
      </span>
    ) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (Object.keys(errors).length) return;
    onSave({ ...(j as Job), confirmed: true, preferred_start: j.preferred_start || null });
  };

  const timeSelect = (k: "earliest_start" | "latest_finish" | "preferred_start", optional = false) => (
    <select
      className={field}
      value={j[k] ?? ""}
      aria-invalid={tried && !!errors[k]}
      onChange={(e) => set(k, (e.target.value || (optional ? null : undefined)) as string)}
    >
      <option value="">{optional ? "(none)" : "…"}</option>
      {TIMES.map((x) => (
        <option key={x}>{x}</option>
      ))}
    </select>
  );

  return (
    <form onSubmit={submit} className="rise space-y-4 rounded-2xl border border-heat/50 bg-surface p-4 sm:p-6" noValidate>
      <label className="block">
        <span className="text-sm text-muted">{t("title")}</span>
        <input className={field} value={j.title ?? ""} maxLength={100} aria-invalid={tried && !!errors.title} onChange={(e) => set("title", e.target.value)} />
        {err("title")}
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="text-sm text-muted">{t("earnings")}</span>
          <input className={field} inputMode="numeric" value={j.earnings ?? ""} aria-invalid={tried && !!errors.earnings}
            onChange={(e) => set("earnings", Number(e.target.value.replace(/\D/g, "")) || (undefined as unknown as number))} />
          {err("earnings")}
        </label>
        <label>
          <span className="text-sm text-muted">{t("duration")}</span>
          <select className={field} value={j.duration_minutes ?? ""} aria-invalid={tried && !!errors.duration_minutes}
            onChange={(e) => set("duration_minutes", Number(e.target.value))}>
            <option value="">…</option>
            {Array.from({ length: 32 }, (_, i) => (i + 1) * 15).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {err("duration_minutes")}
        </label>
        <label>
          <span className="text-sm text-muted">{t("earliest")}</span>
          {timeSelect("earliest_start")}
          {err("earliest_start")}
        </label>
        <label>
          <span className="text-sm text-muted">{t("latest")}</span>
          {timeSelect("latest_finish")}
          {err("latest_finish")}
        </label>
        <label>
          <span className="text-sm text-muted">{t("booked")}</span>
          {timeSelect("preferred_start", true)}
          {err("preferred_start")}
        </label>
        <label>
          <span className="text-sm text-muted">{t("travel")}</span>
          <select className={field} value={j.travel_minutes ?? 0} onChange={(e) => set("travel_minutes", Number(e.target.value))}>
            {[0, 15, 30, 45, 60, 75, 90].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>
      <fieldset>
        <legend className="text-sm text-muted">{t("environment")}</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {ENVS.map((v) => (
            <Chip key={v} on={j.environment === v} onClick={() => set("environment", v)}>{t(`env_${v}`)}</Chip>
          ))}
        </div>
        {err("environment")}
      </fieldset>
      <fieldset>
        <legend className="text-sm text-muted">{t("workload")}</legend>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {LOADS.map((v) => (
            <Chip key={v} on={j.workload === v} onClick={() => set("workload", v)}>{t(`load_${v}`)}</Chip>
          ))}
        </div>
        {err("workload")}
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="text-sm text-muted">{t("zone")}</span>
          <input className={field} value={j.location_zone ?? ""} maxLength={40} onChange={(e) => set("location_zone", e.target.value)} />
        </label>
        <label className="flex min-h-11 items-end gap-2 pb-2">
          <input type="checkbox" className="h-5 w-5 accent-[var(--heat)]" checked={j.flexible ?? true} onChange={(e) => set("flexible", e.target.checked)} />
          <span>{t("flexible")}</span>
        </label>
      </div>
      <div className="flex gap-3">
        <button type="submit" className="min-h-11 flex-1 rounded-xl bg-text px-4 font-semibold text-bg hover:bg-heat">
          {"missing" in initial ? t("confirm") : t("save")}
        </button>
        <button type="button" onClick={onCancel} className="min-h-11 rounded-xl border border-border px-4">
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-11 rounded-lg border px-3 text-sm ${on ? "border-heat bg-heat/15 text-text" : "border-border text-muted hover:text-text"}`}
    >
      {children}
    </button>
  );
}
