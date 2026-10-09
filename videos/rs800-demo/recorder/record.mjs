// Records real screen clips of the live ₹800 app for the demo video.
// Usage: node record.mjs [clipName...]   (no args = all clips)
import { chromium } from "playwright";
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const SITE = "https://main.d231iqub8spohk.amplifyapp.com";
const OUT = new URL("../clips/raw/", import.meta.url).pathname;
const MARKS = new URL("../clips/markers.json", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const demo = JSON.parse(readFileSync(new URL("../../../services/api/app/data/demo_jobs.json", import.meta.url)));
const marks = existsSync(MARKS) ? JSON.parse(readFileSync(MARKS, "utf8")) : {};

const HINDI_JOBS =
  "आज सुबह 10 बजे तक अलीगंज में छत पर वायरिंग का काम है, 300 रुपये, एक घंटा। " +
  "फिर गोमती नगर में पंप की प्लंबिंग, छाँव में, 250 रुपये, सवा घंटा, 7 से 4 के बीच कभी भी।";

// A visible cursor and click ripple; headless recordings have no pointer.
const CURSOR = `
(() => {
  const add = () => {
    if (document.getElementById('__cur')) return;
    const c = document.createElement('div');
    c.id = '__cur';
    c.style.cssText = 'position:fixed;left:-50px;top:-50px;width:22px;height:22px;z-index:2147483647;pointer-events:none;' +
      'border-radius:50%;background:rgba(243,240,233,.92);border:2px solid #111315;box-shadow:0 2px 10px rgba(0,0,0,.5);' +
      'transform:translate(-50%,-50%);transition:width .12s,height .12s';
    document.body.appendChild(c);
    addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', e => {
      c.style.width = c.style.height = '16px';
      const r = document.createElement('div');
      r.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;border-radius:50%;border:3px solid #f28c45;' +
        'left:' + e.clientX + 'px;top:' + e.clientY + 'px;width:10px;height:10px;transform:translate(-50%,-50%);' +
        'transition:all .5s ease-out;opacity:1';
      document.body.appendChild(r);
      requestAnimationFrame(() => { r.style.width = r.style.height = '64px'; r.style.opacity = '0'; });
      setTimeout(() => r.remove(), 600);
    }, true);
    addEventListener('mouseup', () => { c.style.width = c.style.height = '22px'; }, true);
  };
  if (document.body) add(); else addEventListener('DOMContentLoaded', add);
})();`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Turn variable-rate screencast frames into a constant 30 fps H.264 clip whose t=0 is the session start.
function encode(name, frames, start, end) {
  if (!frames.length) throw new Error(`${name}: no frames captured`);
  const lines = [];
  for (let i = 0; i < frames.length; i++) {
    const from = i === 0 ? start : frames[i].ts;
    const to = i + 1 < frames.length ? frames[i + 1].ts : end;
    lines.push(`file '${frames[i].file}'`, `duration ${Math.max(0.001, to - from).toFixed(4)}`);
  }
  lines.push(`file '${frames[frames.length - 1].file}'`);
  const list = join(OUT, `${name}-frames.txt`);
  writeFileSync(list, lines.join("\n"));
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list,
    "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-movflags", "+faststart",
    join(OUT, `${name}.mp4`)]);
  console.log(`  ${name}: ${frames.length} frames -> ${name}.mp4`);
}

async function session(name, { lang = "en", input = null, mobile = false } = {}, run) {
  const viewport = mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 };
  const scale = mobile ? 2 : 1.5;
  // Without this flag the headless shell screencasts at CSS pixels even when deviceScaleFactor is set.
  const browser = await chromium.launch({ args: [`--force-device-scale-factor=${scale}`] });
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale, isMobile: mobile, hasTouch: mobile });
  await context.addInitScript(
    ([l, i]) => {
      try {
        if (!sessionStorage.getItem("__seeded")) {
          localStorage.setItem("rs800.lang", l);
          if (i) localStorage.setItem("rs800.input.v1", i);
          else localStorage.removeItem("rs800.input.v1");
          sessionStorage.setItem("__seeded", "1");
        }
      } catch {}
    },
    [lang, input ? JSON.stringify(input) : null],
  );
  await context.addInitScript(CURSOR);
  const page = await context.newPage();
  // CDP screencast captures at device pixels (crisp 1920x1080); Playwright's recorder only captures CSS pixels.
  const framesDir = join(OUT, `${name}-frames`);
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  const frames = [];
  const cdp = await context.newCDPSession(page);
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    const file = join(framesDir, `${String(frames.length).padStart(6, "0")}.jpg`);
    writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ file, ts: metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 92,
    maxWidth: viewport.width * scale,
    maxHeight: viewport.height * scale,
    everyNthFrame: 1,
  });
  const t0 = Date.now();
  const m = {};
  const mark = (k) => {
    m[k] = +((Date.now() - t0) / 1000).toFixed(2);
    console.log(`  ${name} ${k} @ ${m[k]}s`);
  };
  const h = {
    page,
    mark,
    wait,
    async move(locator, steps = 25) {
      const b = await locator.boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps });
    },
    async click(locator) {
      await locator.scrollIntoViewIfNeeded();
      await h.move(locator);
      await wait(250);
      await locator.click();
    },
    async scrollTo(y, ms = 1200) {
      await page.evaluate(
        ([target, dur]) =>
          new Promise((done) => {
            const start = scrollY, t = performance.now();
            const step = (now) => {
              const p = Math.min(1, (now - t) / dur), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
              scrollTo(0, start + (target - start) * e);
              p < 1 ? requestAnimationFrame(step) : done();
            };
            requestAnimationFrame(step);
          }),
        [y, ms],
      );
    },
    async scrollToEl(locator, offset = 80, ms = 1200) {
      const y = await locator.evaluate((el, o) => el.getBoundingClientRect().top + scrollY - o, offset);
      await h.scrollTo(Math.max(0, y), ms);
    },
  };
  try {
    await run(h);
  } finally {
    await cdp.send("Page.stopScreencast").catch(() => {});
    const tEnd = Date.now() / 1000;
    await context.close();
    await browser.close();
    encode(name, frames, t0 / 1000, tEnd);
    marks[name] = m;
    writeFileSync(MARKS, JSON.stringify(marks, null, 2));
  }
}

const clips = {
  async "01-landing"() {
    await session("01-landing", {}, async ({ page, mark, wait, scrollToEl }) => {
      await page.goto(SITE + "/", { waitUntil: "networkidle" });
      mark("loaded");
      await wait(9500);
      mark("noon");
      await scrollToEl(page.getByText("Watch the solver rearrange", { exact: false }), 130, 1600);
      mark("replay_start");
      await wait(15500);
      mark("end");
    });
  },

  async "02-hindi-entry"() {
    await session("02-hindi-entry", { lang: "hi" }, async ({ page, mark, wait, click, scrollToEl, move }) => {
      await page.goto(SITE + "/plan/?step=jobs", { waitUntil: "networkidle" });
      await wait(1200);
      mark("loaded");
      const box = page.locator("#say");
      await click(box);
      mark("typing");
      await box.pressSequentially(HINDI_JOBS, { delay: 28 });
      mark("typed");
      await wait(600);
      await click(page.getByRole("button", { name: "काम पढ़ें" }));
      mark("read_clicked");
      await page.locator("form").first().waitFor({ timeout: 45000 });
      mark("drafts");
      await wait(800);
      await scrollToEl(page.locator("form").first(), 90, 1400);
      await wait(2500);
      await move(page.locator("form").first().locator("input").nth(1));
      await wait(1500);
      await scrollToEl(page.locator("form").nth(1), 90, 1400);
      await wait(3000);
      mark("end");
    });
  },

  async "03-plan-replan"() {
    await session("03-plan-replan", {}, async ({ page, mark, wait, click, scrollToEl, scrollTo }) => {
      await page.goto(SITE + "/", { waitUntil: "networkidle" });
      await wait(1500);
      await click(page.getByRole("button", { name: "Explore the heatwave example" }).first());
      await page.waitForURL(/step=jobs/);
      await wait(1000);
      mark("jobs");
      await scrollTo(520, 2200);
      await wait(1500);
      await scrollTo(1100, 2200);
      await wait(1200);
      await click(page.getByRole("button", { name: "Generate work plan" }));
      mark("generate");
      await page.waitForURL(/result/, { timeout: 20000 });
      await page.getByText("Your day, rearranged.").first().waitFor();
      mark("plan");
      marks.ids = { ...(marks.ids || {}), plan: new URL(page.url()).searchParams.get("id") };
      await wait(3000);
      await scrollToEl(page.getByRole("heading", { name: "Your workday" }), 70, 1600);
      mark("timeline");
      await wait(4000);
      await scrollToEl(page.getByRole("heading", { name: /Rooftop electrical repair/ }).first(), 260, 1800);
      mark("reasons");
      await wait(5000);
      await scrollToEl(page.getByRole("heading", { name: "Your workday" }), 20, 1600);
      mark("sim_ready");
      await wait(1500);
      const replan = page.getByRole("button", { name: /Replan with/ });
      await click(replan);
      mark("replan");
      await page.getByText("Why did this change?").waitFor({ timeout: 20000 });
      await wait(600);
      mark("replanned");
      await wait(3500);
      await scrollToEl(page.getByText("Why did this change?"), 300, 1800);
      mark("diff");
      await wait(5500);
      await scrollToEl(page.getByText("Your day, rearranged.").first(), 40, 1600);
      mark("income");
      await wait(3500);
      const footer = await page.getByText(/Solved by OR-Tools/).textContent();
      marks.ids.sim = footer.match(/plan-[0-9a-f]+/)[0];
      await scrollToEl(page.getByText(/Solved by OR-Tools/), 500, 1800);
      mark("footer");
      await wait(3000);
      mark("end");
    });
  },

  async "04-mobile-hindi"() {
    const id = marks.ids?.sim;
    if (!id) throw new Error("run 03-plan-replan first");
    await session("04-mobile-hindi", { lang: "hi", mobile: true }, async ({ page, mark, wait, scrollTo, click }) => {
      await page.goto(`${SITE}/plan/result/?id=${id}`, { waitUntil: "networkidle" });
      await page.getByText("आपका दिन, नए सिरे से।").waitFor({ timeout: 20000 });
      await wait(1500);
      mark("loaded");
      await scrollTo(700, 2400);
      await wait(2000);
      await scrollTo(1500, 2400);
      await wait(2000);
      await scrollTo(0, 1600);
      await wait(800);
      await click(page.getByRole("button", { name: "तबीयत ख़राब है?" }));
      mark("unwell");
      await wait(5000);
      mark("end");
    });
  },
};

const want = process.argv.slice(2);
for (const [name, fn] of Object.entries(clips)) {
  if (want.length && !want.includes(name)) continue;
  console.log("recording", name);
  await fn();
}
console.log("ids", marks.ids);
