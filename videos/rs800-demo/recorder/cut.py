"""Cut the real recordings into one exact-length segment per storyboard frame.

Each segment is a list of (source, in, out, speed); speed > 1 plays faster.
Times are seconds in the source clip, chosen against the narration word timings.
"""

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "clips" / "raw"
OUT = ROOT / "assets" / "clips"

# crop window (x, y, w, h) in source pixels, or None for the full frame
APP = (160, 0, 1600, 900)
REPLAY = (160, 150, 1600, 900)

M = json.loads((ROOT / "clips" / "markers.json").read_text())
L, H, P, MOB = M["01-landing"], M["02-hindi-entry"], M["03-plan-replan"], M["04-mobile-hindi"]

# speed None = solved so the frame's segments add up to its exact duration
PLAN = {
    "f01": {"crop": None, "segs": [("01-landing", max(0.0, L["loaded"] - 1.1), None, 1.0)]},
    "f02": {"crop": REPLAY, "segs": [("01-landing", L["replay_start"] + 0.3, L["replay_start"] + 15.3, None)]},
    "f03": {"crop": APP, "segs": [
        ("02-hindi-entry", H["typing"] - 0.6, H["read_clicked"] + 0.23, 1.25),
        ("02-hindi-entry", H["read_clicked"] + 0.23, H["drafts"], 6.0),
        ("02-hindi-entry", H["drafts"], H["drafts"] + 7.3, None),
    ]},
    "f04": {"crop": APP, "segs": [("03-plan-replan", P["jobs"] - 0.3, P["plan"] + 0.2, None)]},
    "f05": {"crop": APP, "segs": [
        ("03-plan-replan", P["timeline"] - 0.08, P["reasons"] - 1.85, 0.42),
        ("03-plan-replan", P["reasons"] - 1.85, P["reasons"] + 4.95, 1.0),
        ("03-plan-replan", P["plan"] + 0.04, P["plan"] + 2.89, None),
    ]},
    "f06": {"crop": APP, "segs": [("03-plan-replan", P["sim_ready"] - 0.9, P["income"] - 0.53, None)]},
    "f07": {"crop": APP, "segs": [("03-plan-replan", P["income"] - 0.93, P["income"] + 3.47, None)]},
    "f08": {"crop": None, "segs": [
        ("03-plan-replan", P["footer"] - 1.66, P["footer"] + 2.94, 0.8, APP),
        ("05-aws-terminal", 5.0, 18.07, None, None),
    ]},
    "f09": {"crop": None, "size": (374, 810), "segs": [
        ("04-mobile-hindi", MOB["loaded"] + 0.09, MOB["loaded"] + 6.09, 1.5),
        ("04-mobile-hindi", MOB["unwell"] - 0.81, MOB["unwell"] + 3.59, None),
    ]},
}


def resolve(spec: dict, duration: float) -> list[tuple]:
    """Fill the one open end (None out or None speed) so the segments total the frame duration."""
    segs = [list(s) for s in spec["segs"]]
    fixed = sum((s[2] - s[1]) / s[3] for s in segs if s[2] is not None and s[3] is not None)
    for s in segs:
        if s[2] is None:
            s[2] = s[1] + (duration - fixed) * s[3]
        elif s[3] is None:
            s[3] = (s[2] - s[1]) / (duration - fixed)
    return [tuple(s) for s in segs]


def frame_durations() -> dict[str, float]:
    text = (ROOT / "STORYBOARD.md").read_text()
    out = {}
    for block in re.split(r"^## Frame ", text, flags=re.M)[1:]:
        n = int(block.split(":", 1)[0])
        out[f"f{n:02d}"] = float(re.search(r"^- duration:\s*([\d.]+)s", block, re.M).group(1))
    return out


def build(name: str, spec: dict, duration: float) -> float:
    w, h = spec.get("size", (1440, 810))
    inputs, chains = [], []
    spec = {**spec, "segs": resolve(spec, duration)}
    for i, seg in enumerate(spec["segs"]):
        src, t_in, t_out, speed = seg[:4]
        crop = seg[4] if len(seg) > 4 else spec["crop"]
        inputs += ["-i", str(RAW / f"{src}.mp4")]
        f = f"[{i}:v]trim={t_in}:{t_out},setpts=(PTS-STARTPTS)/{speed}"
        if crop:
            f += f",crop={crop[2]}:{crop[3]}:{crop[0]}:{crop[1]}"
        f += f",scale={w}:{h}:flags=lanczos,fps=30,setsar=1[s{i}]"
        chains.append(f)
    n = len(spec["segs"])
    graph = ";".join(chains) + ";" + "".join(f"[s{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0,tpad=stop_mode=clone:stop_duration=3[v]"
    dst = OUT / f"{name}.mp4"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", graph, "-map", "[v]", "-t", f"{duration:.3f}",
         "-c:v", "libx264", "-crf", "17", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(dst)],
        check=True,
    )
    got = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(dst)],
                               capture_output=True, text=True, check=True).stdout)
    content = sum((s[2] - s[1]) / s[3] for s in spec["segs"])
    print(f"{name}: target {duration:.3f}s, content {content:.2f}s, file {got:.3f}s")
    return got


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    durs = frame_durations()
    json.dump({k: build(k, v, durs[k]) for k, v in PLAN.items()}, open(OUT / "segments.json", "w"), indent=1)
