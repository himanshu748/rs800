"""Generate the frame sub-compositions: a left rail of cue-timed callouts beside the real clip panel.

Cue times are seconds into the frame, taken from the narration word timestamps in audio_meta.json.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRAMES = ROOT / "compositions" / "frames"
GSAP = "https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"

BG, SURFACE, TEXT, MUTED, HEAT, COOL, WARN, BORDER = (
    "#111315", "#1D2022", "#F3F0E9", "#A7ABA8", "#F28C45", "#72B8C5", "#E8B84C", "#34383A")
PANEL = (440, 135, 1440, 810)
PHONE = (973, 135, 374, 810)

FACES = re.findall(r"@font-face\{font-family:(?:Space Grotesk|Noto Sans Devanagari);[^}]*\}", (ROOT / "frame.md").read_text())

# kind: kicker | head | stat (value + label) | item (label line) | quote
FRAMES_SPEC = [
    ("01-hook", "f01", PANEL, [
        ("kicker", 0.2, "01 · Lucknow, heatwave", None),
        ("head", 0.3, "44°c outside", None),
        ("stat", 4.8, "₹800", "has to be earned today"),
        ("stat", 9.9, "06:30 → 14:00", "same roof, a few hours later"),
    ]),
    ("02-value", "f02", PANEL, [
        ("kicker", 0.2, "02 · The idea", None),
        ("head", 2.6, "plan around the heat", None),
        ("item", 3.6, "Real solver output", "replayed from the live API"),
        ("item", 7.1, "Honest shortfall", "no rule bent for money"),
    ]),
    ("03-hindi-entry", "f03", PANEL, [
        ("kicker", 0.2, "03 · Input", None),
        ("head", 1.3, "हिंदी में", None),
        ("item", 3.5, "GLM 5.3 on Modal", "called from AWS Lambda"),
        ("item", 6.6, "Pay · window · sun or shade", "filled into job cards"),
        ("item", 9.9, "Worker confirms", "the model never decides safety"),
    ]),
    ("04-jobs", "f04", PANEL, [
        ("kicker", 0.2, "04 · Today's jobs", None),
        ("stat", 1.6, "4 jobs", "rooftop, plumbing, fan, meter"),
        ("stat", 3.3, "₹950", "if he did every one"),
        ("item", 6.4, "One tap", "Generate work plan"),
    ]),
    ("05-plan", "f05", PANEL, [
        ("kicker", 0.2, "05 · The plan", None),
        ("item", 1.0, "OR-Tools CP-SAT", "on AWS Lambda"),
        ("stat", 6.4, "09:00 → 06:30", "rooftop moved out of the danger band"),
        ("item", 13.0, "AC job → hottest hours", "travel and rest are real blocks"),
        ("stat", 18.9, "₹800 ✓", "target reached"),
        ("stat", 20.6, "27% lower", "modelled exposure score"),
    ]),
    ("06-replan", "f06", PANEL, [
        ("kicker", 0.2, "06 · What if it gets hotter?", None),
        ("stat", 0.9, "+3°c", "every hour of the forecast"),
        ("item", 3.7, "Re-solved on Lambda", "the whole day, from scratch"),
        ("item", 6.4, "Rooftop removed", "every slot breaks a heat rule"),
        ("stat", 11.4, "₹650", "₹150 short, with the reason"),
    ]),
    ("07-principle", "f07", PANEL, [
        ("kicker", 0.2, "07 · The rule", None),
        ("quote", 0.3, "the rules don't bend for money", None),
        ("item", 4.1, "The trade-off is his call", "move a customer, or find indoor work"),
    ]),
    ("08-aws", "f08", PANEL, [
        ("kicker", 0.2, "08 · Running on AWS", None),
        ("item", 2.3, "Lambda + API Gateway", "FastAPI and the OR-Tools solver"),
        ("item", 6.8, "CloudWatch", "a structured event per plan"),
        ("item", 9.7, "DynamoDB", "each replan linked to its parent"),
        ("item", 13.8, "Amplify Hosting", "the static Next.js site"),
    ]),
    ("09-mobile", "f09", PHONE, [
        ("kicker", 0.2, "09 · On his phone", None),
        ("head", 0.9, "हिंदी में", None),
        ("item", 1.9, "Budget Android", "390 px wide, no app install"),
        ("stat", 4.4, "108 · 112", "if he feels unwell"),
    ]),
]


def durations() -> dict[str, float]:
    text = (ROOT / "STORYBOARD.md").read_text()
    out = {}
    for block in re.split(r"^## Frame ", text, flags=re.M)[1:]:
        src = re.search(r"^- src:\s*compositions/frames/(\S+)\.html", block, re.M).group(1)
        out[src] = float(re.search(r"^- duration:\s*([\d.]+)s", block, re.M).group(1))
    return out


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def deva(s: str) -> str:
    return " deva" if re.search(r"[ऀ-ॿ]", s) else ""


def rail(p: str, items) -> tuple[str, list[str]]:
    html, tweens = [], []
    for i, (kind, cue, a, b) in enumerate(items):
        el = f"{p}-r{i}"
        if kind == "kicker":
            html.append(f'<div id="{el}" class="{p}-kicker">{esc(a)}</div>')
        elif kind == "head":
            html.append(f'<div id="{el}" class="{p}-head{deva(a)}">{esc(a)}</div>')
        elif kind == "quote":
            html.append(f'<div id="{el}" class="{p}-quote">{esc(a)}</div>')
        elif kind == "stat":
            html.append(f'<div id="{el}" class="{p}-card"><div class="{p}-stat">{esc(a)}</div>'
                        f'<div class="{p}-label">{esc(b)}</div></div>')
        else:
            html.append(f'<div id="{el}" class="{p}-card"><div class="{p}-item">{esc(a)}</div>'
                        f'<div class="{p}-label">{esc(b)}</div></div>')
        tweens.append(f'tl.fromTo("#{el}", {{ opacity: 0, y: 24 }}, {{ opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }}, {cue:.2f});')
    return "\n        ".join(html), tweens


def frame(fid: str, p: str, geo, items, dur: float) -> str:
    x, y, w, h = geo
    phone = geo == PHONE
    rail_html, tweens = rail(p, items)
    bezel = (f'<div id="{p}-bezel"></div>' if phone else f'<div id="{p}-frame"></div><div id="{p}-rule"></div>')
    return f"""<template>
  <div id="root" data-composition-id="{fid}" data-width="1920" data-height="1080" data-start="0" data-duration="{dur}">
    <style>
      {chr(10).join("      " + f for f in FACES).strip()}
      #root {{ position: relative; width: 1920px; height: 1080px; overflow: hidden; font-family: "Space Grotesk", sans-serif; color: {TEXT}; }}
      .{p}-bg {{ position: absolute; inset: 0; background: {BG}; }}
      #{p}-rail {{ position: absolute; left: 64px; top: 147px; width: 336px; display: flex; flex-direction: column; gap: 26px; }}
      .{p}-kicker {{ font-weight: 500; font-size: 17px; letter-spacing: 0.14em; text-transform: uppercase; color: {HEAT}; }}
      .{p}-head {{ font-weight: 700; font-size: 56px; line-height: 0.98; letter-spacing: -0.03em; text-transform: lowercase; }}
      .{p}-quote {{ font-weight: 700; font-size: 60px; line-height: 1.0; letter-spacing: -0.03em; color: {HEAT}; }}
      .{p}-card {{ border-top: 1px solid {BORDER}; padding-top: 16px; }}
      .{p}-stat {{ font-weight: 700; font-size: 50px; line-height: 1.0; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }}
      .{p}-item {{ font-weight: 700; font-size: 27px; line-height: 1.15; letter-spacing: -0.01em; }}
      .{p}-label {{ margin-top: 8px; font-weight: 500; font-size: 18px; line-height: 1.35; color: {MUTED}; }}
      .deva {{ font-family: "Noto Sans Devanagari", "Space Grotesk", sans-serif; text-transform: none; letter-spacing: 0; line-height: 1.25; }}
      #{p}-frame {{ position: absolute; left: {x - 1}px; top: {y - 1}px; width: {w + 2}px; height: {h + 2}px; border: 1px solid {BORDER}; }}
      #{p}-rule {{ position: absolute; left: {x}px; top: {y - 9}px; width: 36px; height: 2px; background: {HEAT}; }}
      #{p}-bezel {{ position: absolute; left: {x - 16}px; top: {y - 16}px; width: {w + 32}px; height: {h + 32}px; border-radius: 44px; background: {SURFACE}; border: 1px solid {BORDER}; }}
    </style>
    <div id="{p}-bg" class="clip {p}-bg" data-start="0" data-duration="{dur}" data-track-index="0"></div>
    {bezel}
    <div id="{p}-rail">
        {rail_html}
    </div>
    <video data-frame-video="approved" src="assets/clips/{p}.mp4" muted playsinline
      data-start="0" data-duration="{dur}" data-track-index="5"
      data-frame-video-x="{x}" data-frame-video-y="{y}" data-frame-video-width="{w}" data-frame-video-height="{h}" data-frame-video-fit="fill"></video>
    <script src="{GSAP}"></script>
    <script>
      window.__timelines = window.__timelines || {{}};
      const tl = gsap.timeline({{ paused: true }});
      {(chr(10) + "      ").join(tweens)}
      tl.set({{}}, {{}}, {dur});
      window.__timelines["{fid}"] = tl;
    </script>
  </div>
</template>
"""


def close_frame(dur: float) -> str:
    p, fid = "f10", "10-close"
    return f"""<template>
  <div id="root" data-composition-id="{fid}" data-width="1920" data-height="1080" data-start="0" data-duration="{dur}">
    <style>
      {chr(10).join("      " + f for f in FACES).strip()}
      #root {{ position: relative; width: 1920px; height: 1080px; overflow: hidden; font-family: "Space Grotesk", sans-serif; color: {TEXT}; }}
      .{p}-bg {{ position: absolute; inset: 0; background: {BG}; }}
      #{p}-wrap {{ position: absolute; left: 160px; top: 250px; width: 1600px; }}
      #{p}-kicker {{ font-weight: 500; font-size: 20px; letter-spacing: 0.14em; text-transform: uppercase; color: {HEAT}; }}
      #{p}-mark {{ margin-top: 22px; font-weight: 700; font-size: 230px; line-height: 0.86; letter-spacing: -0.05em; }}
      #{p}-line {{ margin-top: 34px; font-weight: 700; font-size: 66px; line-height: 1.0; letter-spacing: -0.03em; text-transform: lowercase; color: {HEAT}; }}
      #{p}-links {{ margin-top: 54px; display: flex; gap: 64px; border-top: 1px solid {BORDER}; padding-top: 24px; font-weight: 500; font-size: 26px; color: {MUTED}; }}
      #{p}-links b {{ display: block; font-size: 16px; letter-spacing: 0.14em; text-transform: uppercase; color: {TEXT}; margin-bottom: 8px; }}
    </style>
    <div id="{p}-bg" class="clip {p}-bg" data-start="0" data-duration="{dur}" data-track-index="0"></div>
    <div id="{p}-wrap">
      <div id="{p}-kicker">WeMakeDevs × AWS · Heat &amp; Water</div>
      <div id="{p}-mark">₹800</div>
      <div id="{p}-line">the heat doesn't stop the bills.</div>
      <div id="{p}-links">
        <div><b>Try it</b>main.d231iqub8spohk.amplifyapp.com</div>
        <div><b>Code</b>github.com/himanshu748/rs800</div>
      </div>
    </div>
    <script src="{GSAP}"></script>
    <script>
      window.__timelines = window.__timelines || {{}};
      const tl = gsap.timeline({{ paused: true }});
      tl.fromTo("#{p}-kicker", {{ opacity: 0, y: 16 }}, {{ opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }}, 0);
      tl.fromTo("#{p}-mark", {{ opacity: 0, y: 40 }}, {{ opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }}, 0.05);
      tl.fromTo("#{p}-line", {{ opacity: 0, y: 24 }}, {{ opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }}, 0.3);
      tl.fromTo("#{p}-links", {{ opacity: 0, y: 24 }}, {{ opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }}, 2.3);
      tl.to("#{p}-wrap", {{ opacity: 0, duration: 0.6, ease: "power2.in" }}, {max(0.0, dur - 0.6):.2f});
      window.__timelines["{fid}"] = tl;
    </script>
  </div>
</template>
"""


if __name__ == "__main__":
    FRAMES.mkdir(parents=True, exist_ok=True)
    d = durations()
    for fid, p, geo, items in FRAMES_SPEC:
        (FRAMES / f"{fid}.html").write_text(frame(fid, p, geo, items, d[fid]))
    (FRAMES / "10-close.html").write_text(close_frame(d["10-close"]))
    print("wrote", len(FRAMES_SPEC) + 1, "frames")
