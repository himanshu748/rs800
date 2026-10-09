"use client";

import Link from "next/link";
import { useState } from "react";
import { useLang, useT } from "@/lib/i18n";

export function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const { t } = useT();
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="font-display text-2xl font-bold tracking-tight text-text" aria-label="₹800 home">
            ₹800
          </Link>
          <div className="flex items-center gap-2">
            {right}
            <UnwellButton />
            <LangToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl space-y-1 px-4 py-6 text-sm text-muted">
          <p>{t("prototype")}</p>
          <p>
            {t("attribution")}{" "}
            <Link href="/methodology/" className="underline underline-offset-2 hover:text-text">
              {t("methodology")}
            </Link>
          </p>
        </div>
      </footer>
    </>
  );
}

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div role="group" aria-label="Language" className="flex overflow-hidden rounded-full border border-border text-sm">
      {(["en", "hi"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`min-h-11 px-3 ${lang === l ? "bg-text text-bg" : "text-muted hover:text-text"}`}
        >
          {l === "en" ? "EN" : "हिंदी"}
        </button>
      ))}
    </div>
  );
}

function UnwellButton() {
  const { t, d } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="min-h-11 rounded-full border border-critical/60 px-3 text-sm text-critical hover:bg-critical/10"
      >
        {t("unwell")}
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-labelledby="unwell-title" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-critical bg-surface p-6">
            <h2 id="unwell-title" className="font-display text-3xl font-bold text-critical">
              {t("unwellTitle")}
            </h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-base">
              {d.unwellBody.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <div className="mt-6 flex gap-3">
              <a href="tel:108" className="min-h-11 flex-1 rounded-xl bg-critical px-4 py-3 text-center font-semibold text-bg">
                108
              </a>
              <a href="tel:112" className="min-h-11 flex-1 rounded-xl border border-critical px-4 py-3 text-center font-semibold text-critical">
                112
              </a>
              <button autoFocus onClick={() => setOpen(false)} className="min-h-11 flex-1 rounded-xl border border-border px-4 py-3">
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{children}</span>;
}

export function ModeBadge({ live, delta = 0 }: { live: boolean; delta?: number }) {
  const { t } = useT();
  const shift = delta ? ` · ${delta > 0 ? "+" : ""}${delta}°C` : "";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold tracking-[0.12em] ${
        live && !delta ? "border-cool/60 text-cool" : "border-warn/60 text-warn"
      }`}
    >
      <span aria-hidden className={`h-2 w-2 rounded-full ${live && !delta ? "bg-cool" : "bg-warn"}`} />
      {live && delta ? `${t("simPrefix")}: ${t("liveLabel")}${shift}` : (live ? t("liveLabel") : t("simulatedLabel")) + shift}
    </span>
  );
}
