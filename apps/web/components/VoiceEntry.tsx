"use client";

import { useRef, useState } from "react";
import { api, type DraftJob } from "@/lib/api";
import { useT } from "@/lib/i18n";

interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
}

function getRecognizer(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function VoiceEntry({ onDrafts }: { onDrafts: (d: DraftJob[]) => void }) {
  const { t, lang } = useT();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rec = useRef<SpeechRec | null>(null);
  const Rec = getRecognizer();

  const listen = () => {
    if (!Rec) return;
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = new Rec();
    r.lang = lang === "hi" ? "hi-IN" : "en-IN";
    r.interimResults = true;
    r.continuous = true;
    const base = text ? text + " " : "";
    r.onresult = (e) => {
      let s = "";
      for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript;
      setText(base + s);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  const read = async () => {
    setBusy(true);
    setError("");
    try {
      const out = await api.parseJobs(text, lang);
      if (!out.jobs.length) setError(t("readFailed"));
      onDrafts(out.jobs);
    } catch {
      setError(t("readFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
      <label htmlFor="say" className="font-display text-xl font-bold">
        {t("sayJobs")}
      </label>
      <p className="mt-1 text-sm text-muted">{t("sayJobsHint")}</p>
      <textarea
        id="say"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="mt-3 w-full rounded-lg border border-border bg-bg p-3 text-base focus:border-heat"
      />
      <div className="mt-3 flex flex-wrap gap-3">
        {Rec && (
          <button
            onClick={listen}
            aria-pressed={listening}
            className={`min-h-11 rounded-xl border px-4 ${listening ? "border-critical text-critical" : "border-border hover:border-text"}`}
          >
            <span aria-hidden>{listening ? "■ " : "● "}</span>
            {listening ? t("listening") : t("listen")}
          </button>
        )}
        <button
          onClick={read}
          disabled={busy || text.trim().length < 3}
          className="min-h-11 rounded-xl bg-text px-4 font-semibold text-bg hover:bg-heat disabled:opacity-40"
        >
          {busy ? t("reading") : t("readJobs")}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-warn">
          {error}
        </p>
      )}
    </div>
  );
}
