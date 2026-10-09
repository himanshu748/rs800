"use client";

import { useEffect, useState } from "react";
import { HeatTimeline, type Row } from "@/components/HeatTimeline";
import type { Activity, HourlyWeather, Job } from "@/lib/api";
import { inr, useT } from "@/lib/i18n";
import { reasonText } from "@/lib/reasons";
import snap from "@/lib/landing_snapshot.json";
import { useCountUp, useInView, useReducedMotion } from "./motion";

const STEPS = [3200, 4200, 1600, 5200];
const jobs = snap.jobs as unknown as Job[];
const range = { from: 6 * 60, to: 20 * 60 };
const DELTA = `+${snap.delta}°C`;

export function ReplayDemo() {
  const { t, lang } = useT();
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>(0.35);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!inView || !playing || reduced) return;
    const id = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), STEPS[step]);
    return () => clearTimeout(id);
  }, [step, inView, playing, reduced]);

  const hot = step >= 2;
  const plan = step === 3 ? snap.hotter : snap.normal;
  const hourly = (hot ? snap.hotter.hourly : snap.normal.hourly) as unknown as HourlyWeather[];
  const activities: Activity[] =
    step === 0
      ? snap.normal.baseline_schedule.map((b) => ({ type: "job", job_id: b.job_id, start: b.start, end: b.end }))
      : (plan.activities as Activity[]);
  const row: Row = {
    label: step === 0 ? t("asBooked") : t("rearranged"),
    activities,
    flagged: step === 0 ? new Set(snap.normal.baseline_schedule.filter((b) => b.blocked_by).map((b) => b.job_id)) : undefined,
    ghosts: step === 3 ? snap.normal.schedule.filter((s) => !snap.hotter.schedule.some((x) => x.job_id === s.job_id)) : [],
  };
  const income = useCountUp(step === 0 ? 0 : plan.scheduled_income);
  const removed = snap.diff.removed[0];

  const caption = [
    t("landReplay0"),
    t("landReplay1", { pct: Math.round(snap.normal.relative_score_reduction_percent) }),
    t("landReplay2", { delta: snap.delta }),
    `${t("removed", { title: removed.title })}. ${reasonText(removed as never, lang)}`,
  ][step];

  return (
    <div ref={ref} className="rounded-3xl border border-border bg-surface p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" aria-label={t("landReplayTitle")} className="flex flex-wrap gap-2">
          {[t("asBooked"), t("rearranged"), DELTA, t("after")].map((l, i) => (
            <button key={l} role="tab" aria-selected={step === i}
              onClick={() => { setStep(i); setPlaying(false); }}
              className={`min-h-11 rounded-full border px-4 text-sm ${step === i ? "border-heat bg-heat/15 text-text" : "border-border text-muted hover:text-text"}`}>
              {l}
            </button>
          ))}
        </div>
        <button onClick={() => setPlaying((p) => !p)} className="min-h-11 rounded-full border border-border px-4 text-sm text-muted hover:text-text"
          aria-label={playing ? "Pause" : "Play"}>
          {playing ? "❚❚" : "▶"}
        </button>
      </div>

      <div className="mt-6 grid items-end gap-6 sm:grid-cols-[1fr_auto]">
        <p key={step} className="rise min-h-14 max-w-xl text-lg">{caption}</p>
        <div className="text-right">
          <div className={`font-display text-5xl font-bold tabular-nums ${step === 3 ? "text-warn" : "text-text"}`}>{inr(income)}</div>
          <div className="text-sm text-muted">
            / {inr(800)}{" "}
            {step === 3 ? <span className="text-warn">· {inr(snap.hotter.shortfall)} {t("shortfall")}</span> : step > 0 ? <span className="text-cool">✓</span> : null}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center gap-3">
          <span className="text-xs text-muted">{t("scenario")}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg">
            <div className="move h-full rounded-full bg-heat" style={{ width: hot ? `${((snap.delta + 2) / 8) * 100}%` : "25%" }} />
          </div>
          <span className="w-14 text-right font-display font-bold tabular-nums text-heat">{hot ? DELTA : "+0°C"}</span>
        </div>
        <HeatTimeline hourly={hourly} jobs={jobs} rows={[row]} range={range} />
      </div>
      <p className="mt-4 text-xs text-muted">{t("landReplayNote")}</p>
    </div>
  );
}
