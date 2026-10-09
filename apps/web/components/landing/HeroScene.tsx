"use client";

import { useEffect, useState } from "react";
import snap from "@/lib/landing_snapshot.json";
import { useT } from "@/lib/i18n";
import { catName } from "@/lib/reasons";
import { useReducedMotion } from "./motion";

const START = 6 * 60 + 30;
const END = 14 * 60;
const CYCLE_MS = 9000;

function fmt(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.floor(m % 60 / 15) * 15).padStart(2, "0")}`;
}

export function HeroScene({ hasImages }: { hasImages: boolean }) {
  const { t, lang } = useT();
  const reduced = useReducedMotion();
  const [p, setP] = useState(0);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const x = ((now - t0) % (CYCLE_MS * 2)) / CYCLE_MS;
      const tri = x < 1 ? x : 2 - x;
      setP(tri * tri * (3 - 2 * tri));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const minute = START + (END - START) * p;
  const row = snap.normal.hourly[Math.floor(minute / 60)];
  const next = snap.normal.hourly[Math.min(23, Math.floor(minute / 60) + 1)];
  const f = (minute % 60) / 60;
  const hi = row.heat_index_c + (next.heat_index_c - row.heat_index_c) * f;

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {hasImages ? (
        // Static export has no image optimizer; these are pre-sized JPEGs.
        /* eslint-disable @next/next/no-img-element */
        <>
          <img src="/img/dawn.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <img src="/img/noon.jpg" alt="" className="heat-shimmer absolute inset-0 h-full w-full object-cover" style={{ opacity: p }} />
        </>
        /* eslint-enable @next/next/no-img-element */
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, #1f3a48 ${0}%, #f28c45 ${120 - p * 70}%, #fff3d6 160%)` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-bg/95 via-bg/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/10 to-bg/50" />
      <div className="absolute top-4 right-4 text-right sm:top-auto sm:bottom-8 md:right-10">
        <div className="font-display text-3xl font-bold tabular-nums text-text/90 sm:text-6xl md:text-7xl">{fmt(minute)}</div>
        <div className="mt-1 font-display text-base tabular-nums sm:text-2xl" style={{ color: hi >= 39.4 ? "var(--critical)" : "var(--warn)" }}>
          {hi.toFixed(0)}°C {lang === "hi" ? "हीट इंडेक्स" : "heat index"}
        </div>
        <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-text/70">{catName(row.category_index, lang)}</div>
        <div className="mt-3 inline-block rounded-md px-3 py-1.5 font-display text-sm font-bold sm:text-lg"
          style={hi >= 39.4 ? { background: "var(--critical)", color: "var(--bg)" } : { background: "var(--cool)", color: "var(--bg)" }}>
          {hi >= 39.4 ? t("heroTooHot") : t("heroOk")}
        </div>
        <div className="mt-2 hidden text-sm text-text/70 sm:block">{t("heroSameRoof")}</div>
      </div>
    </div>
  );
}
