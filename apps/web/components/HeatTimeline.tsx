"use client";

import type { Activity, Environment, HourlyWeather, Job } from "@/lib/api";
import { useT, type Key } from "@/lib/i18n";
import { catName } from "@/lib/reasons";
import { toMin } from "@/lib/store";

export const CAT_BG = ["var(--cat0)", "var(--cat1)", "var(--cat2)", "var(--cat3)", "var(--cat4)"];
const ENV_BG: Record<Environment, string> = {
  direct_sun: "var(--heat)",
  shaded_outdoor: "var(--warn)",
  indoor_uncooled: "#c9a27a",
  indoor_cooled: "var(--cool)",
};
const ENV_ICON: Record<Environment, string> = {
  direct_sun: "☀",
  shaded_outdoor: "⛱",
  indoor_uncooled: "⌂",
  indoor_cooled: "❄",
};
const ENV_KEY: [Environment, Key][] = [
  ["direct_sun", "env_direct_sun"],
  ["shaded_outdoor", "env_shaded_outdoor"],
  ["indoor_cooled", "env_indoor_cooled"],
];

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

export function HeatTimeline({ hourly, jobs, rows, range, details = false }: { hourly: HourlyWeather[]; jobs: Job[]; rows: Row[]; range: { from: number; to: number }; details?: boolean }) {
  const { t, lang } = useT();
  const span = range.to - range.from;
  const pct = (m: number) => `${((m - range.from) / span) * 100}%`;
  const w = (a: string, b: string) => `${((toMin(b) - toMin(a)) / span) * 100}%`;
  const hours = Array.from({ length: span / 60 }, (_, i) => range.from / 60 + i);
  const num = (id: string) => jobs.findIndex((j) => j.id === id) + 1;
  const env = (id: string) => jobs.find((j) => j.id === id)?.environment ?? "indoor_cooled";
  const title = (id: string) => jobs.find((j) => j.id === id)?.title ?? id;
  const anyFlag = rows.some((r) => r.flagged && r.flagged.size > 0);
  const anyGhost = rows.some((r) => r.ghosts && r.ghosts.length > 0);
  const gutter = "w-[84px] shrink-0 sm:w-[112px]";

  return (
    <figure className="select-none">
      <p className="mb-3 text-sm text-muted">{t("tlHelp")}</p>
      <div className="flex">
        <div className={gutter} aria-hidden>
          {rows.map((r) => (
            <div key={r.label} className="flex h-14 items-center pr-2 text-[10px] font-semibold uppercase leading-tight tracking-normal text-text/80 sm:text-xs sm:tracking-wider">
              {r.label}
            </div>
          ))}
        </div>
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-border">
          <div className="absolute inset-0 flex" aria-hidden>
            {hours.map((h) => (
              <div key={h} className="move flex-1 border-r border-black/20 last:border-r-0" style={{ background: CAT_BG[hourly[h]?.category_index ?? 0] }} />
            ))}
          </div>
          <div className="relative">
            {rows.map((r) => (
              <div key={r.label} className="relative h-14 border-b border-black/25 last:border-b-0">
                {r.ghosts?.map((g) => (
                  <div key={`g-${g.job_id}`} className="absolute top-3.5 h-7 rounded-md border-2 border-dashed border-text/70"
                    style={{ left: pct(toMin(g.start)), width: w(g.start, g.end) }} title={title(g.job_id)}>
                    <span className="flex h-full items-center justify-center text-xs font-bold text-text">✕{num(g.job_id)}</span>
                  </div>
                ))}
                {r.activities.map((a) => {
                  const k = `${a.type}-${a.job_id}`;
                  const style = { left: pct(toMin(a.start)), width: w(a.start, a.end) };
                  if (a.type === "travel")
                    return <div key={k} className="move hatch absolute top-8 h-2 rounded-sm" style={style} title={t("travelAct")} />;
                  if (a.type === "recovery")
                    return <div key={k} className="move absolute top-4 h-6 rounded-sm border border-cool bg-cool/25" style={style} title={t("recoveryAct")} />;
                  const flagged = r.flagged?.has(a.job_id);
                  return (
                    <div key={k} className={`move absolute top-3.5 flex h-7 items-center justify-center gap-0.5 overflow-hidden rounded-md text-xs font-bold text-bg ${flagged ? "ring-2 ring-critical ring-offset-1 ring-offset-black" : ""}`}
                      style={{ ...style, background: ENV_BG[env(a.job_id)] }} title={`${title(a.job_id)} ${a.start}-${a.end}`}>
                      {flagged && <span>!</span>}
                      <span aria-hidden>{ENV_ICON[env(a.job_id)]}</span>
                      <span>{num(a.job_id)}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex">
        <div className={`${gutter} pt-1 text-[10px] leading-4 text-muted sm:text-xs`} aria-hidden>
          <div>{t("tlHour")}</div>
          <div>{t("tlHeatIndex")}</div>
          {details && (
            <>
              <div>{t("tempRow")}</div>
              <div>{t("humidityRow")}</div>
            </>
          )}
        </div>
        <div className="mt-1 flex min-w-0 flex-1 text-center tabular-nums" aria-hidden>
          {hours.map((h, i) => (
            <div key={h} className="flex-1">
              <div className="h-4 text-[10px] text-muted sm:text-xs">{i % 2 === 0 || span <= 600 ? String(h).padStart(2, "0") : ""}</div>
              <div className="move text-[10px] font-semibold text-text sm:text-xs">{Math.round(hourly[h]?.heat_index_c ?? 0)}°</div>
              {details && (
                <>
                  <div className="move text-[10px] text-muted sm:text-xs">{Math.round(hourly[h]?.temperature_c ?? 0)}</div>
                  <div className="text-[10px] text-muted sm:text-xs">{Math.round(hourly[h]?.relative_humidity ?? 0)}</div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      <figcaption className="mt-4 space-y-2 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-text">{t("tlHeatKey")}</span>
          <span>{t("tlCooler")}</span>
          {[0, 1, 2, 3, 4].map((c) => (
            <span key={c} className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm" style={{ background: CAT_BG[c] }} />
              {catName(c, lang)}
            </span>
          ))}
          <span>{t("tlHotter")}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-text">{t("tlJobsKey")}</span>
          {jobs.map((j, i) => (
            <span key={j.id} className="inline-flex items-center gap-1">
              <span className="inline-grid h-4 min-w-4 place-items-center rounded px-1 text-[10px] font-bold text-bg" style={{ background: ENV_BG[j.environment] }}>
                {ENV_ICON[j.environment]} {i + 1}
              </span>
              {j.title}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {ENV_KEY.map(([e, k]) => (
            <span key={e} className="inline-flex items-center gap-1">
              <span aria-hidden>{ENV_ICON[e]}</span> {t(k)}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <span className="hatch h-2 w-4 rounded-sm" /> {t("travelAct")}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-4 rounded-sm border border-cool bg-cool/25" /> {t("recoveryAct")}
          </span>
          {anyFlag && <span className="text-critical">! {t("tlFlag")}</span>}
          {anyGhost && <span className="text-text">✕ {t("tlGhost")}</span>}
        </div>
      </figcaption>
    </figure>
  );
}
