---
workflow: product-launch-video
flow: automation
storyboard: no
message: "₹800 rearranges an outdoor worker's real jobs around the heat, and says honestly when the day's target can't be met without breaking a heat rule"
destination: youtube
aspect: 1920x1080
language: en
audience: hackathon judges (WeMakeDevs x AWS Environmental Hacks, Heat & Water track)
length: 125s
angle: show-it-as-is product demo
voice_provider: heygen
voice: "Dada ji, Warm & Friendly (02f211a5ef524caea2ad8447e72b218c)"
vo_mode: restructured
---

## Intent

The submission demo video for ₹800. Show the real deployed product doing the real thing, not a promo: a Lucknow electrician needs ₹800 today, enters jobs in Hindi, the solver on AWS Lambda rearranges the day around the heat, then a +5 °C forecast makes the rooftop job ineligible and the target drops to ₹650 with the reason. The app never bends the heat rules for money. End on AWS proof and the Hindi mobile view.

## Assets

- Real screen recordings of https://main.d231iqub8spohk.amplifyapp.com captured with Playwright for this video (landing, Hindi job entry, plan, +5 °C replan, mobile Hindi, Feeling unwell?).
- Real terminal recordings (vhs) of `aws logs filter-log-events` and `aws dynamodb get-item` for the exact plan ids created during the recording.
- docs/demo-script.md in the repo: narration source, tightened to fit on-screen timing.

## Customizations

- Every shot is a real recording. No stills standing in for interaction, no recreated UI.
- Subtle BGM bed under the voiceover.
- Short labels / lower-thirds naming what is on screen (AWS Lambda, DynamoDB, CloudWatch).
- No captions (user request, 2026-10-09).

## Notes

- Hard limit: under 3 minutes (hackathon rule). AWS must be visibly demonstrated.
- Synthetic demo data must stay labelled ("SIMULATED HEATWAVE SCENARIO" is on screen in the app).
- No hype words. No claims of preventing heatstroke; the exposure score is a scheduling heuristic.
