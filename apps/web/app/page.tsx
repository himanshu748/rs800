"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { HeroScene } from "@/components/landing/HeroScene";
import { Reveal } from "@/components/landing/motion";
import { ReplayDemo } from "@/components/landing/ReplayDemo";
import { Shell } from "@/components/Shell";
import { useT, type Key } from "@/lib/i18n";
import { demoInput, usePlanner } from "@/lib/store";

const HAS_IMAGES = true;

function Words({ text, base = 0 }: { text: string; base?: number }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span key={i} className="word" style={{ animationDelay: `${base + i * 90}ms` }}>
          {w}&nbsp;
        </span>
      ))}
    </>
  );
}

export default function Home() {
  const { t } = useT();
  const router = useRouter();
  const { setInput } = usePlanner();

  const startDemo = () => {
    setInput(() => demoInput());
    router.push("/plan/?step=jobs");
  };

  const ctas = (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Link href="/plan/" className="group inline-flex min-h-14 items-center justify-between gap-6 rounded-xl bg-text px-6 font-display text-lg font-bold text-bg transition-colors hover:bg-heat">
        {t("planMyDay")} <span aria-hidden className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1">↗</span>
      </Link>
      <button onClick={startDemo} className="inline-flex min-h-14 items-center justify-center rounded-xl border border-text/30 bg-bg/40 px-6 text-lg backdrop-blur transition-colors hover:border-text">
        {t("exploreExample")}
      </button>
    </div>
  );

  return (
    <Shell>
      <section className="relative left-1/2 min-h-[88svh] w-screen -translate-x-1/2 overflow-hidden">
        <HeroScene hasImages={HAS_IMAGES} />
        <div className="relative mx-auto flex min-h-[88svh] max-w-5xl flex-col justify-center px-4 py-16">
          <p className="word text-xs font-semibold uppercase tracking-[0.16em] text-warn">
            {t("landEyebrow")} · {t("heroScenario")}
          </p>
          <h1 className="mt-5 font-display text-[44px] font-bold leading-[0.92] tracking-tight sm:text-[84px]">
            <span className="block text-heat"><Words text={t("heroLine1")} base={100} /></span>
            <span className="block"><Words text={t("heroLine2")} base={400} /></span>
          </h1>
          <p className="word mt-8 max-w-xl text-lg text-text/80 sm:text-xl" style={{ animationDelay: "800ms" }}>{t("heroSub")}</p>
          <div className="word mt-10" style={{ animationDelay: "1000ms" }}>{ctas}</div>
          <p className="word mt-10 max-w-3xl text-text/60" style={{ animationDelay: "1200ms" }}>{t("builtFor")}</p>
        </div>
      </section>

      <section className="pt-20">
        <Reveal>
          <h2 className="max-w-2xl font-display text-[32px] font-bold leading-tight sm:text-5xl">{t("landReplayTitle")}</h2>
          <p className="mt-3 max-w-2xl text-muted">{t("landReplaySub")}</p>
        </Reveal>
        <Reveal delay={150} className="mt-8">
          <ReplayDemo />
        </Reveal>
      </section>

      <section className="pt-24">
        <Reveal>
          <h2 className="font-display text-[32px] font-bold sm:text-5xl">{t("vsTitle")}</h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {([["vsWeatherQ", "vsWeather", false], ["vsAdvisoryQ", "vsAdvisory", false], ["vsUsQ", "vsUs", true]] as [Key, Key, boolean][]).map(([q, a, us], i) => (
            <Reveal key={q} delay={i * 120}>
              <div className={`h-full rounded-2xl border p-6 ${us ? "border-heat bg-heat/10" : "border-border bg-surface"}`}>
                <p className="text-sm text-muted">{t(q)}</p>
                <p className={`mt-3 font-display text-2xl font-bold ${us ? "text-text" : "text-text/70"}`}>&ldquo;{t(a)}&rdquo;</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="pt-24">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
          {([["01", "how1t", "how1"], ["02", "how2t", "how2"], ["03", "how3t", "how3"]] as const).map(([n, h, b], i) => (
            <Reveal key={n} delay={i * 120} className="bg-surface">
              <div className="p-6 sm:p-8">
                <span className="font-display text-5xl font-bold text-heat/80">{n}</span>
                <h3 className="mt-4 font-display text-xl font-bold">{t(h)}</h3>
                <p className="mt-2 text-muted">{t(b)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="pt-24">
        <Reveal>
          <h2 className="font-display text-[32px] font-bold sm:text-5xl">{t("stackTitle")}</h2>
          <p className="mt-3 max-w-2xl text-muted">{t("stackSub")}</p>
        </Reveal>
        <Reveal delay={150} className="mt-8">
          <Stack />
        </Reveal>
      </section>

      <section className="pt-24 pb-8">
        <Reveal>
          <div className="rounded-3xl border border-border bg-surface p-8 sm:p-12">
            <p className="border-l-2 border-heat pl-5 font-display text-2xl font-bold sm:text-3xl">{t("noBend")}</p>
            <h2 className="mt-10 font-display text-[32px] font-bold leading-tight sm:text-5xl">{t("ctaTitle")}</h2>
            <div className="mt-8">{ctas}</div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              <Link href="/methodology/" className="underline underline-offset-4 hover:text-text">{t("methodology")} →</Link>
              {HAS_IMAGES && <span>{t("imageCredit")}</span>}
            </div>
          </div>
        </Reveal>
      </section>
    </Shell>
  );
}

function Stack() {
  const { t } = useT();
  const nodes: [string, Key][] = [
    ["Amplify Hosting", "stAmplify"],
    ["API Gateway", "stGateway"],
    ["Lambda", "stLambda"],
    ["DynamoDB", "stDynamo"],
  ];
  const side: [string, Key][] = [
    ["Modal · GLM 5.3", "stBedrock"],
    ["CloudWatch", "stCloudwatch"],
  ];
  return (
    <div className="rounded-3xl border border-border bg-surface p-4 sm:p-8">
      <div className="relative grid gap-3 sm:grid-cols-4">
        <svg className="pointer-events-none absolute inset-0 hidden h-full w-full sm:block" aria-hidden preserveAspectRatio="none" viewBox="0 0 100 10">
          <line x1="12" y1="5" x2="88" y2="5" stroke="var(--heat)" strokeWidth="0.25" className="flow" vectorEffect="non-scaling-stroke" />
        </svg>
        {nodes.map(([n, k]) => (
          <div key={n} className="relative rounded-2xl border border-border bg-bg p-4">
            <p className="font-display text-lg font-bold text-heat">{n}</p>
            <p className="mt-1 text-sm text-muted">{t(k)}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        {side.map(([n, k]) => (
          <div key={n} className="rounded-2xl border border-dashed border-border p-4 sm:col-start-3 first:sm:col-start-2">
            <p className="font-display text-lg font-bold text-cool">{n}</p>
            <p className="mt-1 text-sm text-muted">{t(k)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
