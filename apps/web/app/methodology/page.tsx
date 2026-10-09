"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { catName, ruleText } from "@/lib/reasons";

const CAT_INDEX: Record<string, number> = { caution: 1, extreme_caution: 2, danger: 3, extreme_danger: 4 };

interface Method {
  version: string;
  heat_index: string;
  categories_f: Record<string, string>;
  rules: string[];
  rule_codes?: string[];
  limitation_codes?: string[];
  weights: Record<string, Record<string, number>>;
  limitations: string[];
}

export default function Methodology() {
  const { t, lang } = useT();
  const [m, setM] = useState<Method | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    api.methodology().then((x) => setM(x as unknown as Method), () => setErr(true));
  }, []);

  return (
    <Shell>
      <article className="mx-auto max-w-2xl pt-10">
        <h1 className="font-display text-4xl font-bold">{t("methodTitle")}</h1>
        <p className="mt-4 text-muted">{t("methodIntro")}</p>
        {err && <p className="mt-6 text-critical">{t("apiDown")}</p>}
        {m && (
          <>
            <h2 className="mt-10 font-display text-2xl font-bold">{t("m1")}</h2>
            <p className="mt-2">{lang === "hi" ? "पूर्वानुमान के तापमान और नमी पर NWS Rothfusz तरीका (छाँव मानकर)।" : `${m.heat_index}.`}</p>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {Object.entries(m.categories_f).map(([k, v]) => (
                <li key={k}>
                  {lang === "hi" ? `${catName(CAT_INDEX[k] ?? 0, lang)}: हीट इंडेक्स ${v} °F` : `${k.replace("_", " ")}: heat index ${v} °F`}
                </li>
              ))}
            </ul>
            <h2 className="mt-10 font-display text-2xl font-bold">{t("m2")} ({m.version})</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              {m.rules.map((r, i) => (
                <li key={r}>{ruleText(m.rule_codes?.[i], r, lang)}</li>
              ))}
            </ul>
            <h2 className="mt-10 font-display text-2xl font-bold">{t("m3")}</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>{t("mo1")}</li>
              <li>{t("mo2")}</li>
              <li>{t("mo3")}</li>
            </ol>
            <p className="mt-3 text-sm text-muted">{t("scoreNote")}</p>
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
            <h2 className="mt-10 font-display text-2xl font-bold">{t("m4")}</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
              {m.limitations.map((r, i) => (
                <li key={r}>{ruleText(m.limitation_codes?.[i], r, lang)}</li>
              ))}
            </ul>
          </>
        )}
      </article>
    </Shell>
  );
}
