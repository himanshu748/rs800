"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { HeatTimeline, TimelineRange, type Row } from "@/components/HeatTimeline";
import { Label, ModeBadge, Shell } from "@/components/Shell";
import { api, ApiError, type Plan } from "@/lib/api";
import { cityName, inr, useT } from "@/lib/i18n";
import { reasonText } from "@/lib/reasons";
import { usePlanner } from "@/lib/store";

export default function ResultPage() {
  return (
    <Suspense>
      <Result />
    </Suspense>
  );
}

function Result() {
  const id = useSearchParams().get("id") || "";
  const { t } = useT();
  const { plans, savePlan } = usePlanner();
  const [original, setOriginal] = useState<Plan | null>(plans[id] ?? null);
  const [sim, setSim] = useState<Plan | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (original || !id) return;
    api.getPlan(id).then(
      (p) => {
        if (p.parent_plan_id) {
          api.getPlan(p.parent_plan_id).then(setOriginal, () => setOriginal(p));
          setSim(p);
        } else setOriginal(p);
      },
      (e) => setError(e instanceof ApiError && e.status === 404 ? "Plan not found or expired." : t("apiDown")),
    );
  }, [id, original, t]);

  if (error)
    return (
      <Shell>
        <p className="pt-16 text-critical">{error}</p>
        <Link href="/plan/?step=jobs" className="mt-4 inline-block underline">← {t("back")}</Link>
      </Shell>
    );
  if (!original)
    return (
      <Shell>
        <p className="pt-16 text-muted">{t("loading")}</p>
      </Shell>
    );

  return (
    <Shell>
      <PlanView
        original={original}
        sim={sim}
        onSim={(p) => {
          savePlan(p);
          setSim(p);
        }}
        onRestore={() => setSim(null)}
      />
    </Shell>
  );
}

function PlanView({ original, sim, onSim, onRestore }: { original: Plan; sim: Plan | null; onSim: (p: Plan) => void; onRestore: () => void }) {
  const { t, lang } = useT();
  const plan = sim ?? original;
  const jobs = original.request.jobs;
  const live = original.weather.mode === "live";
  const delta = plan.weather.temperature_delta ?? 0;

  const rows: Row[] = useMemo(() => {
    const baseline: Row = {
      label: t("asBooked"),
      activities: plan.baseline_schedule.map((b) => ({ type: "job", job_id: b.job_id, start: b.start, end: b.end })),
      flagged: new Set(plan.baseline_schedule.filter((b) => b.blocked_by).map((b) => b.job_id)),
    };
    const current: Row = {
      label: t("rearranged"),
      activities: plan.activities,
      ghosts: sim ? original.schedule.filter((s) => !sim.schedule.some((x) => x.job_id === s.job_id)) : [],
    };
    return [baseline, current];
  }, [plan, sim, original, t]);
  const range = TimelineRange(original.request.working_hours, [...rows, { label: "", activities: original.activities }]);

  return (
    <div className="pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ModeBadge live={live} delta={delta} />
        <span className="text-sm text-muted">{cityName(original.weather.city, lang)}</span>
      </div>
      <h1 className="mt-4 font-display text-[32px] font-bold leading-tight sm:text-5xl">{t("yourDay")}</h1>

      <Income plan={plan} />

      <section className="mt-10">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="font-display text-2xl font-bold">{t("timeline")}</h2>
          <span className="text-xs text-muted">
            {t("source")}: {plan.weather.source === "synthetic" ? t("simulatedLabel") : plan.weather.source}
          </span>
        </div>
        <HeatTimeline hourly={plan.weather.hourly} jobs={jobs} rows={rows} range={range} />
      </section>

      <Simulator original={original} sim={sim} onSim={onSim} onRestore={onRestore} />

      <section className="mt-10">
        <ol className="space-y-3">
          {plan.activities.map((a) => {
            if (a.type !== "job")
              return (
                <li key={`${a.type}-${a.job_id}`} className="flex gap-4 pl-1 text-sm text-muted">
                  <span className="w-12 shrink-0 tabular-nums">{a.start}</span>
                  <span className={a.type === "recovery" ? "text-cool" : ""}>
                    {a.type === "travel" ? `${t("travelAct")} · ${a.start}-${a.end}` : `${t("recoveryAct")} · ${a.minutes} ${t("minutes")}`}
                  </span>
                </li>
              );
            const s = plan.schedule.find((x) => x.job_id === a.job_id)!;
            const n = jobs.findIndex((j) => j.id === s.job_id) + 1;
            return (
              <li key={`job-${s.job_id}`} className="rise rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-start gap-4">
                  <span className="w-12 shrink-0 font-display text-lg font-bold tabular-nums">{s.start}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-lg font-bold">
                        <span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-text text-xs text-bg">{n}</span>
                        {s.title}
                      </h3>
                      <span className="font-display text-xl font-bold">{inr(s.earnings)}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {s.start}-{s.end} · {t(`env_${s.environment}`)} · {t(`load_${s.workload}`)}
                    </p>
                    <p className="mt-2 text-sm">{reasonText(s, lang)}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {plan.unscheduled_jobs.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold">{t("notScheduled")}</h2>
          <ul className="mt-3 space-y-3">
            {plan.unscheduled_jobs.map((u) => (
              <li key={u.job_id} className="rounded-2xl border border-dashed border-border p-4">
                <div className="flex justify-between gap-3">
                  <h3 className="font-semibold">
                    <span className="mr-2 text-muted">{jobs.findIndex((j) => j.id === u.job_id) + 1}</span>
                    {u.title}
                  </h3>
                  <span className="text-muted line-through">{inr(u.earnings)}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{reasonText(u, lang)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 space-y-2 text-sm text-muted">
        {plan.warnings.map((w) => (
          <p key={w}>· {w}</p>
        ))}
        <p className="pt-2 font-mono text-xs">
          {t("computedOn", {
            compute: plan.infra?.compute ?? "API",
            region: plan.infra?.region ?? "-",
            ms: plan.solver.runtime_ms,
            id: plan.plan_id,
            store: plan.infra?.store ?? "-",
          })}
        </p>
      </section>
    </div>
  );
}

function Income({ plan }: { plan: Plan }) {
  const { t } = useT();
  const met = plan.status === "target_met";
  const pct = Math.min(100, (plan.scheduled_income / plan.target_income) * 100);
  return (
    <section className="mt-8 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-live="polite">
      <Label>{t("incomeTarget")}</Label>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
        <span className={`font-display text-5xl font-bold tabular-nums sm:text-6xl ${met ? "text-text" : "text-warn"}`}>{inr(plan.scheduled_income)}</span>
        <span className="font-display text-2xl text-muted">/ {inr(plan.target_income)}</span>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-bg">
        <div className={`move h-full rounded-full ${met ? "bg-cool" : "bg-warn"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`mt-3 font-display text-lg font-bold ${met ? "text-cool" : "text-warn"}`}>
        {met ? `✓ ${t("targetReached")}` : plan.scheduled_income === 0 ? t("noPlan") : `${inr(plan.shortfall)} ${t("shortfall")}`}
      </p>
      {!met && plan.scheduled_income > 0 && (
        <div className="mt-3 space-y-1">
          <p className="font-semibold">{t("notReachable", { target: inr(plan.target_income) })}</p>
          <p className="text-sm text-muted">
            {t("notReachableSub", { income: inr(plan.scheduled_income), gap: inr(plan.shortfall) })}
          </p>
        </div>
      )}
      {plan.baseline_exposure_score > 0 && (
        <p className="mt-4 border-t border-border pt-4 text-sm">
          {plan.relative_score_reduction_percent > 0
            ? t("exposureLower", { pct: Math.round(plan.relative_score_reduction_percent) })
            : t("exposureHigher", { score: plan.relative_exposure_score, base: plan.baseline_exposure_score })}
          <span className="text-muted">*</span>
          <span className="mt-1 block text-xs text-muted">* {t("exposureNote")}</span>
        </p>
      )}
    </section>
  );
}

function Simulator({ original, sim, onSim, onRestore }: { original: Plan; sim: Plan | null; onSim: (p: Plan) => void; onRestore: () => void }) {
  const { t, lang } = useT();
  const [delta, setDelta] = useState(sim?.weather.temperature_delta ?? 5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const diff = sim?.diff;

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      onSim(await api.simulate(original.plan_id, delta));
    } catch {
      setError(t("apiDown"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-10 rounded-2xl border border-heat/50 bg-surface p-5 sm:p-6">
      <h2 className="font-display text-2xl font-bold">{t("simTitle")}</h2>
      <p className="mt-1 text-sm text-muted">{t("simSub")}</p>
      <div className="mt-5 flex items-baseline justify-between">
        <Label>{t("scenario")}</Label>
        <span className="font-display text-3xl font-bold tabular-nums text-heat">
          {delta > 0 ? "+" : ""}
          {delta}°C
        </span>
      </div>
      <input type="range" min={-2} max={6} step={1} value={delta} onChange={(e) => setDelta(Number(e.target.value))}
        className="mt-2 w-full" aria-label={t("scenario")} />
      <div className="flex justify-between text-sm text-muted">
        <span>-2°C</span>
        <span>{t("normal")}</span>
        <span>+6°C</span>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button onClick={run} disabled={busy} className="min-h-12 flex-1 rounded-xl bg-heat px-4 font-display font-bold text-bg hover:bg-text disabled:opacity-50">
          {busy ? t("replanning") : t("replan", { delta: `${delta > 0 ? "+" : ""}${delta}` })}
        </button>
        {sim && (
          <button onClick={onRestore} className="min-h-12 rounded-xl border border-border px-4 hover:border-text">
            {t("restore")}
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-critical">{error}</p>}

      {sim && diff && (
        <div className="rise mt-6 border-t border-border pt-6">
          <div className="grid grid-cols-2 gap-3">
            {([["before", original], ["after", sim]] as const).map(([k, p]) => (
              <div key={k} className="rounded-xl bg-bg p-4">
                <Label>{t(k)}</Label>
                <p className={`mt-1 font-display text-3xl font-bold tabular-nums ${p.status === "target_met" ? "text-text" : "text-warn"}`}>{inr(p.scheduled_income)}</p>
                <p className="text-sm text-muted">
                  {p.status === "target_met" ? t("targetReached") : `${inr(p.shortfall)} ${t("shortfall")}`} · {p.schedule.length} {t("jobs")}
                </p>
              </div>
            ))}
          </div>
          <h3 className="mt-6 font-display text-lg font-bold">{t("whyChanged")}</h3>
          {diff.removed.length + diff.added.length + diff.moved.length === 0 ? (
            <p className="mt-2 text-sm text-muted">{t("nothingChanged")}</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {diff.removed.map((r) => (
                <li key={r.job_id} className="border-l-2 border-critical pl-3">
                  <span className="font-semibold">{t("removed", { title: r.title })} (-{inr(r.earnings)}).</span>{" "}
                  {r.reason_code ? reasonText(r, lang) : ""}
                </li>
              ))}
              {diff.added.map((a) => (
                <li key={a.job_id} className="border-l-2 border-cool pl-3">
                  {t("added", { title: a.title, start: a.start })} (+{inr(a.earnings)})
                </li>
              ))}
              {diff.moved.map((m) => (
                <li key={m.job_id} className="border-l-2 border-warn pl-3">
                  {t("moved", { title: m.title, from: m.from, to: m.to })}
                </li>
              ))}
            </ul>
          )}
          {sim.status !== "target_met" && <p className="mt-4 font-display font-bold text-heat">{t("noBend")}</p>}
        </div>
      )}
    </section>
  );
}
