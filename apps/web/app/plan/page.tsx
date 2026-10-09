"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { JobForm, field, validate } from "@/components/JobForm";
import { Label, ModeBadge, Shell } from "@/components/Shell";
import { VoiceEntry } from "@/components/VoiceEntry";
import { api, ApiError, type DraftJob, type Experience, type Job } from "@/lib/api";
import { cityName, inr, useT } from "@/lib/i18n";
import { CITIES, DEMO_SCENARIO, demoInput, usePlanner } from "@/lib/store";

const HOURS = Array.from({ length: (22 - 4) * 4 + 1 }, (_, i) => {
  const m = 4 * 60 + i * 15;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

export default function PlanPage() {
  return (
    <Suspense>
      <Wizard />
    </Suspense>
  );
}

function Wizard() {
  const params = useSearchParams();
  const router = useRouter();
  const step = params.get("step") === "jobs" ? "jobs" : "setup";
  return (
    <Shell>
      {step === "setup" ? <Setup onNext={() => router.push("/plan/?step=jobs")} /> : <Jobs onBack={() => router.push("/plan/")} />}
    </Shell>
  );
}

function Setup({ onNext }: { onNext: () => void }) {
  const { t, lang } = useT();
  const { input, setInput } = usePlanner();
  const badHours = input.working_hours.end <= input.working_hours.start;
  const setTarget = (n: number) => setInput((p) => ({ ...p, target_income: Math.max(0, Math.min(100000, n)) }));
  const exp: [Experience, "expNew" | "expExperienced" | "expUnknown"][] = [
    ["new", "expNew"],
    ["experienced", "expExperienced"],
    ["unknown", "expUnknown"],
  ];

  return (
    <div className="rise mx-auto max-w-xl pt-10">
      <Label>{t("step1")}</Label>
      <h1 className="mt-3 font-display text-[32px] font-bold leading-tight sm:text-5xl">{t("howMuch")}</h1>

      <div className="mt-8 flex items-baseline gap-1 font-display text-6xl font-bold sm:text-7xl">
        <span className="text-heat">₹</span>
        <input
          aria-label={t("incomeTarget")}
          inputMode="numeric"
          value={input.target_income || ""}
          onChange={(e) => setTarget(Number(e.target.value.replace(/\D/g, "")))}
          className="w-full bg-transparent outline-none"
        />
      </div>
      <input
        type="range"
        min={100}
        max={3000}
        step={50}
        value={Math.min(input.target_income, 3000)}
        onChange={(e) => setTarget(Number(e.target.value))}
        className="mt-2 w-full"
        aria-label={t("incomeTarget")}
      />
      <div className="flex justify-between text-sm text-muted">
        <span>₹100</span>
        <span>₹3,000</span>
      </div>
      {input.target_income < 100 && <p role="alert" className="mt-2 text-sm text-critical">₹100 to ₹1,00,000</p>}

      <div className="mt-8 grid gap-6">
        <label className="block">
          <span className="text-sm text-muted">{t("location")}</span>
          <select className={field} value={input.location.city} onChange={(e) => setInput((p) => ({ ...p, location: { city: e.target.value } }))}>
            {CITIES.map((c) => (
              <option key={c} value={c}>{cityName(c, lang)}</option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className="text-sm text-muted">{t("hours")}</legend>
          <div className="mt-1 grid grid-cols-2 gap-3">
            {(["start", "end"] as const).map((k) => (
              <label key={k}>
                <span className="sr-only">{k === "start" ? t("from") : t("to")}</span>
                <select
                  className={field}
                  value={input.working_hours[k]}
                  aria-invalid={badHours}
                  onChange={(e) => setInput((p) => ({ ...p, working_hours: { ...p.working_hours, [k]: e.target.value } }))}
                >
                  {HOURS.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm text-muted">{t("experience")}</legend>
          <div className="mt-2 grid gap-2">
            {exp.map(([v, k]) => (
              <label key={v} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 has-[:checked]:border-heat">
                <input type="radio" name="exp" className="h-5 w-5 accent-[var(--heat)]" checked={input.heat_work_experience === v}
                  onChange={() => setInput((p) => ({ ...p, heat_work_experience: v }))} />
                {t(k)}
              </label>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">{t("expHint")}</p>
        </fieldset>

        <fieldset>
          <legend className="text-sm text-muted">{t("weatherSource")}</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(["demo", "live"] as const).map((m) => (
              <label key={m} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 has-[:checked]:border-heat">
                <input type="radio" name="wx" className="h-5 w-5 accent-[var(--heat)]" checked={input.weather.mode === m}
                  onChange={() => setInput((p) => ({ ...p, weather: { mode: m, scenario_id: DEMO_SCENARIO } }))} />
                {m === "demo" ? t("weatherDemo") : t("weatherLive")}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <button
        onClick={onNext}
        disabled={badHours || input.target_income < 100}
        className="mt-10 min-h-14 w-full rounded-xl bg-text font-display text-lg font-bold text-bg hover:bg-heat disabled:opacity-40"
      >
        {t("continue")} →
      </button>
    </div>
  );
}

function Jobs({ onBack }: { onBack: () => void }) {
  const { t, lang } = useT();
  const router = useRouter();
  const { input, setInput, savePlan } = usePlanner();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [newId, setNewId] = useState("");
  const [drafts, setDrafts] = useState<DraftJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const jobs = input.jobs;
  const total = jobs.reduce((s, j) => s + j.earnings, 0);
  const allValid = jobs.length > 0 && jobs.every((j) => Object.keys(validate(j)).length === 0);

  const upsert = (j: Job) => {
    setInput((p) => {
      const exists = p.jobs.some((x) => x.id === j.id);
      return { ...p, jobs: exists ? p.jobs.map((x) => (x.id === j.id ? j : x)) : [...p.jobs, j] };
    });
    setDrafts((d) => d.filter((x) => x.id !== j.id));
    setEditing(null);
  };

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const plan = await api.optimize(input);
      savePlan(plan);
      router.push(`/plan/result/?id=${plan.plan_id}`);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 503 ? t("weatherDown") : t("apiDown"));
      setBusy(false);
    }
  };

  const fromDemo = jobs.length > 0 && jobs.every((j) => j.id.startsWith("job-00"));

  return (
    <div className="rise mx-auto max-w-2xl pt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Label>{t("step2")}</Label>
        {input.weather.mode === "demo" ? <ModeBadge live={false} /> : <ModeBadge live />}
      </div>
      <h1 className="mt-3 font-display text-[32px] font-bold leading-tight sm:text-5xl">{t("todaysWork")}</h1>
      <p className="mt-2 text-muted">
        {t("incomeTarget")}: <span className="font-semibold text-text">{inr(input.target_income)}</span> · {cityName(input.location.city, lang)} ·{" "}
        {input.working_hours.start}-{input.working_hours.end}
      </p>

      <div className="mt-8">
        <VoiceEntry onDrafts={(d) => setDrafts((prev) => [...prev, ...d])} />
      </div>

      {drafts.length > 0 && (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-warn">{t("draftNote")}</p>
          {drafts.map((d) => (
            <JobForm key={d.id} initial={{ ...d, title: lang === "en" && d.title_en ? d.title_en : d.title }} onSave={upsert}
              onCancel={() => setDrafts((all) => all.filter((x) => x.id !== d.id))} />
          ))}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold">
          {jobs.length} {t("jobs")}
        </h2>
        {fromDemo && <span className="text-xs font-bold tracking-[0.12em] text-warn">{t("demoJobsLabel")}</span>}
      </div>

      <div className="mt-4 space-y-3">
        {jobs.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-6 text-muted">
            {t("noJobs")}{" "}
            <button onClick={() => setInput(() => ({ ...demoInput(), location: input.location, weather: input.weather, heat_work_experience: input.heat_work_experience }))}
              className="underline underline-offset-4 hover:text-text">
              {t("loadDemo")}
            </button>
          </div>
        )}
        {jobs.map((j) =>
          editing === j.id ? (
            <JobForm key={j.id} initial={j} onSave={upsert} onCancel={() => setEditing(null)} />
          ) : (
            <JobCard key={j.id} job={j} onEdit={() => setEditing(j.id)}
              onRemove={() => setInput((p) => ({ ...p, jobs: p.jobs.filter((x) => x.id !== j.id) }))} />
          ),
        )}
        {editing === "new" ? (
          <JobForm initial={{ id: newId, title: "" }} onSave={upsert} onCancel={() => setEditing(null)} />
        ) : (
          <button onClick={() => { setNewId(`job-${Date.now().toString(36)}`); setEditing("new"); }} className="min-h-12 w-full rounded-2xl border border-dashed border-border text-muted hover:border-text hover:text-text">
            + {t("addJob")}
          </button>
        )}
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-border bg-bg/95 px-4 py-4 backdrop-blur">
        {error && (
          <p role="alert" className="mb-3 text-sm text-critical">
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="min-h-14 rounded-xl border border-border px-4">
            ←<span className="sr-only">{t("back")}</span>
          </button>
          <button
            onClick={generate}
            disabled={!allValid || busy || drafts.length > 0}
            className="min-h-14 flex-1 rounded-xl bg-heat font-display text-lg font-bold text-bg hover:bg-text disabled:opacity-40"
          >
            {busy ? t("planning") : t("generate")}
          </button>
        </div>
        <p className="mt-2 text-center text-sm text-muted">
          {t("potential")}: {inr(total)}
        </p>
      </div>
    </div>
  );
}

function JobCard({ job, onEdit, onRemove }: { job: Job; onEdit: () => void; onRemove: () => void }) {
  const { t } = useT();
  const outdoor = job.environment === "direct_sun" || job.environment === "shaded_outdoor";
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-bold">{job.title}</h3>
        <span className="font-display text-2xl font-bold">{inr(job.earnings)}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <span className={outdoor ? "text-heat" : "text-cool"}>{t(`env_${job.environment}`)}</span>
        <span>{t(`load_${job.workload}`)}</span>
        <span>{job.duration_minutes} {t("minutes")}</span>
        <span>
          {t("available")}: {job.earliest_start}-{job.latest_finish}
        </span>
        {job.preferred_start && <span>{t("booked").split(" (")[0]}: {job.preferred_start}</span>}
        {job.location_zone && <span>{job.location_zone}</span>}
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={onEdit} className="min-h-11 rounded-lg border border-border px-4 text-sm hover:border-text">
          {t("edit")}
        </button>
        <button onClick={onRemove} className="min-h-11 rounded-lg border border-border px-4 text-sm text-muted hover:border-critical hover:text-critical">
          {t("remove")}
        </button>
      </div>
    </div>
  );
}
