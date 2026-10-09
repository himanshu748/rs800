# ₹800: submission write-up

**Track:** Heat & Water

- **Demo video:** https://www.youtube.com/watch?v=xtvfS-8Q3ro
- **Live app:** https://main.d231iqub8spohk.amplifyapp.com
- **Code:** https://github.com/himanshu748/rs800

## The problem

Heat advice for outdoor work boils down to "avoid working outside in the afternoon". For an independent electrician or plumber in Lucknow, that advice costs money they need that same day. A weather app knows the temperature, but not their jobs or their target. Nothing connects the jobs a worker actually has, the money they need and the hourly heat.

## What we built

₹800 takes a daily income target and the worker's real jobs (typed, or spoken in Hindi and turned into drafts by a GLM 5.3 model on Modal called from Lambda, then confirmed by the worker). It screens every 15 minutes of the forecast with the NWS heat index and applies hard heat rules to work, to travel between jobs and to the rest that follows outdoor work. Then an OR-Tools CP-SAT model finds the plan that reaches the target with the lowest modelled heat exposure, with travel and rest as explicit blocks. When the target can't be met inside the rules, it reports the exact shortfall and the reason for every dropped job. The target never relaxes a rule.

The core interaction is the weather simulator. Shift the forecast by -2 to +6 °C and the backend re-solves from scratch. In the demo scenario (synthetic Lucknow heatwave, four fictional jobs):

- +0 °C: ₹800 reached. The rooftop job moves from its booked 09:00 (Danger band) to 06:30, and the modelled exposure score is 27% lower than the day as booked.
- +3 °C: every rooftop slot breaks the direct-sun rule, so the job is removed. ₹650, ₹150 short, with that reason shown.
- +5 °C: the air-conditioned job also drops, because reaching it means travelling in extreme-danger heat, and the meter job drops because no heat-safe slot leaves time for the required rest before the workday ends. ₹250.

These numbers come from the solver, and a unit test fails if the transition changes.

## How AWS is used

- **AWS Lambda** runs FastAPI and OR-Tools CP-SAT (zip deploy, about 90 to 250 ms solver time per plan).
- **API Gateway HTTP API** fronts it with stage throttling.
- **DynamoDB** stores every plan and replan (linked by `parent_plan_id`, 7-day TTL).
- **Job reading:** Lambda calls a GLM 5.3 model hosted on Modal (OpenAI-compatible API, forced tool schema) to turn Hindi or English speech into structured draft jobs, in about 6 seconds. Amazon Bedrock is wired in as a fallback provider. The model only fills fields. It never decides timing or safety.
- **Amplify Hosting** serves the static Next.js app.
- **CloudWatch** receives structured `plan_generated` and `plan_recalculated` events.

## Honest limits

The heat rules and exposure weights are prototype guardrails and ranking coefficients, not validated occupational thresholds or medical risk. The heat index is a shade-based screening value, not WBGT. Demo weather and jobs are synthetic and labelled on every screen. Live mode uses Open-Meteo forecasts.

## AI tools used

Claude Code (Claude Opus 5.5) for code and docs. Codex CLI (OpenAI image generation) for the two hero illustrations. GLM 5.3 on Modal inside the product for job extraction (Bedrock fallback).
