"use client";

import type { Activity, Environment, HourlyWeather, Job } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { catName } from "@/lib/reasons";
import { toMin } from "@/lib/store";

export const CAT_BG = ["var(--cat0)", "var(--cat1)", "var(--cat2)", "var(--cat3)", "var(--cat4)"];
const ENV_BG: Record<Environment, string> = {
  direct_sun: "var(--heat)",
  shaded_outdoor: "var(--warn)",
  indoor_uncooled: "#c9a27a",
  indoor_cooled: "var(--cool)",
};

export interface Row {
  label: string;
  activities: Activity[];
  ghosts?: { job_id: string; start: string; end: string }[];
  flagged?: Set<string>;
}

export function TimelineRange(hours: { start: string; end: string }, rows: Row[]) {
  let end = toMin(hours.end);
  for (const r of rows) for (const a of r.activities) end = Math.max(end, toMin(a.end));
  return { from: Math.floor(toMin(hours.start) / 60) * 60, to: Math.ceil(end / 60) * 60 };
}

export function HeatTimeline({ hourly, jobs, rows, range }: { hourly: HourlyWeather[]; jobs: Job[]; rows: Row[]; range: { from: number; to: number } }) {
  const { t, lang } = useT();
  const span = range.to - range.from;
  const pct = (m: number) => `${((m - range.from) / span) * 100}%`;
  const w = (a: string, b: string) => `${((toMin(b) - toMin(a)) / span) * 100}%`;
  const hours = Array.from({ length: span / 60 }, (_, i) => range.from / 60 + i);
  const num = (id: string) => jobs.findIndex((j) => j.id === id) + 1;
  const env = (id: string) => jobs.find((j) => j.id === id)?.environment ?? "indoor_cooled";
  const title = (id: string) => jobs.find((j) => j.id === id)?.title ?? id;

  return (
    <figure className="select-none">
      <div className="relative overflow-hidden rounded-xl border border-border">
        <div className="absolute inset-0 flex" aria-hidden>
          {hours.map((h) => (
            <div key={h} className="move flex-1 border-r border-black/20 last:border-r-0" style={{ background: CAT_BG[hourly[h]?.category_index ?? 0] }} />
          ))}
        </div>
        <div className="relative">
          {rows.map((r) => (
            <div key={r.label} className="relative h-14 border-b border-black/25 last:border-b-0">
              <span className="absolute left-1 top-0.5 z-10 text-[10px] font-semibold uppercase tracking-wider text-text/70">{r.label}</span>
              {r.ghosts?.map((g) => (
                <div key={`g-${g.job_id}`} className="absolute top-5 h-7 rounded-md border-2 border-dashed border-text/60"
                  style={{ left: pct(toMin(g.start)), width: w(g.start, g.end) }} title={title(g.job_id)}>
                  <span className="flex h-full items-center justify-center text-xs font-bold text-text/80">✕{num(g.job_id)}</span>
                </div>
              ))}
              {r.activities.map((a) => {
                const k = `${a.type}-${a.job_id}`;
                const style = { left: pct(toMin(a.start)), width: w(a.start, a.end) };
                if (a.type === "travel")
                  return <div key={k} className="move hatch absolute top-9 h-2 rounded-sm" style={style} title={t("travelAct")} />;
                if (a.type === "recovery")
                  return <div key={k} className="move absolute top-6 h-5 rounded-sm border border-cool bg-cool/25" style={style} title={t("recoveryAct")} />;
                const flagged = r.flagged?.has(a.job_id);
                return (
                  <div key={k} className={`move absolute top-5 flex h-7 items-center justify-center rounded-md text-xs font-bold text-bg ${flagged ? "ring-2 ring-critical ring-offset-1 ring-offset-black" : ""}`}
                    style={{ ...style, background: ENV_BG[env(a.job_id)] }} title={`${title(a.job_id)} ${a.start}-${a.end}`}>
                    {flagged ? "!" : ""}
                    {num(a.job_id)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 flex text-center tabular-nums" aria-hidden>
        {hours.map((h, i) => (
          <div key={h} className="flex-1">
            <div className="h-4 text-[10px] text-muted sm:text-xs">{i % 2 === 0 || span <= 600 ? String(h).padStart(2, "0") : ""}</div>
            <div className="move text-[10px] font-semibold text-text sm:text-xs">{Math.round(hourly[h]?.heat_index_c ?? 0)}°</div>
          </div>
        ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>{t("hourly")} (°C):</span>
        {[0, 1, 2, 3, 4].map((c) => (
          <span key={c} className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm" style={{ background: CAT_BG[c] }} />
            {catName(c, lang)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="hatch h-2 w-4 rounded-sm" /> {t("travelAct")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-4 rounded-sm border border-cool bg-cool/25" /> {t("recoveryAct")}
        </span>
      </figcaption>
    </figure>
  );
}
