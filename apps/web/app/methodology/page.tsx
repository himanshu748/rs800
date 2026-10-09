"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";

interface Method {
  version: string;
  heat_index: string;
  categories_f: Record<string, string>;
  rules: string[];
  weights: Record<string, Record<string, number>>;
  limitations: string[];
}

export default function Methodology() {
  const { t } = useT();
  const [m, setM] = useState<Method | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    api.methodology().then((x) => setM(x as unknown as Method), () => setErr(true));
  }, []);

  return (
    <Shell>
      <article className="mx-auto max-w-2xl pt-10">
        <h1 className="font-display text-4xl font-bold">{t("methodTitle")}</h1>
        <p className="mt-4 text-muted">
          The schedule comes from a constraint solver (Google OR-Tools CP-SAT) running on AWS Lambda. Bedrock only reads your spoken job
          list into draft fields that you confirm. It never decides timing or safety.
        </p>
        {err && <p className="mt-6 text-critical">{t("apiDown")}</p>}
        {m && (
          <>
            <h2 className="mt-10 font-display text-2xl font-bold">1. Screening the forecast</h2>
            <p className="mt-2">{m.heat_index}.</p>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {Object.entries(m.categories_f).map(([k, v]) => (
                <li key={k}>
                  {k.replace("_", " ")}: heat index {v} °F
                </li>
              ))}
            </ul>
            <h2 className="mt-10 font-display text-2xl font-bold">2. Hard rules ({m.version})</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              {m.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <h2 className="mt-10 font-display text-2xl font-bold">3. What the solver optimizes</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>Earn as much as possible up to your target, using only the jobs you entered, inside their windows, with travel and rest blocks.</li>
              <li>If the target is reachable, pick the combination and times with the lowest modelled exposure score that still reaches it.</li>
              <li>Among equally good plans, stay closest to the times customers booked.</li>
            </ol>
            <p className="mt-3 text-sm text-muted">
              Exposure score per 15 minutes = weather weight × effort weight × place weight. Travel counts as light work in direct sun.
              &quot;As booked&quot; is the same jobs at their booked times with no heat rules.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {Object.entries(m.weights).map(([k, v]) => (
                <div key={k} className="rounded-xl border border-border bg-surface p-4 text-sm">
                  <p className="font-semibold capitalize">{k}</p>
                  {Object.entries(v).map(([a, b]) => (
                    <p key={a} className="flex justify-between text-muted">
                      <span>{a.replace(/_/g, " ")}</span>
                      <span className="tabular-nums">{b}</span>
                    </p>
                  ))}
                </div>
              ))}
            </div>
            <h2 className="mt-10 font-display text-2xl font-bold">4. Limits</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
              {m.limitations.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </>
        )}
      </article>
    </Shell>
  );
}
