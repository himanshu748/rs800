# ₹800

₹800 helps outdoor workers in India who can't afford to stop working in a heatwave. An electrician enters (or says in Hindi) the jobs they actually have today, with pay, time windows and sun or shade. A constraint solver (Google OR-Tools CP-SAT on AWS Lambda) rearranges the day around the hourly heat index: rooftop work moves to 06:30, cooled indoor work takes the hottest hours, and travel and rest blocks are scheduled explicitly. If the income target can't be reached without breaking a heat rule, it says so and shows the exact shortfall. It never relaxes a rule to make the money work. Slide the forecast up by +5 °C and the backend re-solves: in the demo the rooftop job becomes ineligible and ₹800 becomes ₹650, with the reason.

**Live:** https://main.d231iqub8spohk.amplifyapp.com · **API:** https://4l3js7p5ub.execute-api.us-east-1.amazonaws.com/api/v1/health

Built for WeMakeDevs × AWS Environmental Hacks 2026, Heat & Water track.

## Run it locally

Backend (Python 3.12):

```bash
cd services/api
python3.12 -m venv .venv
./.venv/bin/pip install -r requirements.txt -r requirements-dev.txt
./.venv/bin/python -m pytest -q
./.venv/bin/uvicorn app.main:app --port 8000
```

Frontend (Node 22), in a second terminal:

```bash
cd apps/web
npm install
npm run dev
```

Open http://localhost:3000 and click **Explore the heatwave example**, then **Generate work plan**, then **Replan with +5°C**. Locally, plans are kept in memory unless `PLANS_TABLE` is set. Job reading from speech or text needs AWS credentials with Bedrock access. Everything else works without AWS.

## Deploy to AWS

```bash
./infrastructure/deploy.sh       # DynamoDB, IAM role, Lambda (zip via S3), API Gateway HTTP API; prints API_URL
echo "NEXT_PUBLIC_API_URL=<API_URL>" > apps/web/.env.production
./infrastructure/deploy-web.sh   # static Next.js export to Amplify Hosting; prints WEB_URL
```

Both scripts are idempotent and need only the AWS CLI and Python 3.12 (no Docker). OR-Tools Linux wheels unzip to about 158 MB, under Lambda's 250 MB zip limit.

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `apps/web/.env.production` | API Gateway base URL, no trailing slash |
| `PLANS_TABLE` | Lambda (set by `deploy.sh`) | DynamoDB table for plans |
| `ALLOWED_ORIGINS` | Lambda (set by `deploy.sh`) | Comma-separated CORS origins |
| `BEDROCK_MODEL_ID` | Lambda (set by `deploy.sh`) | Model for job extraction, default Claude Haiku 4.5 |

## Architecture

```text
Browser (Next.js static export, EN/हिंदी)
   │  HTTPS
Amplify Hosting ──► API Gateway HTTP API (throttled 10 rps)
                        │
                    AWS Lambda: FastAPI + Mangum
                    ├─ weather.py     demo fixture or Open-Meteo, +ΔT scenario copy
                    ├─ heat_index.py  NWS Rothfusz heat index, screening bands
                    ├─ policy.py      hard rules, rest blocks, exposure weights
                    ├─ optimizer.py   CP-SAT: max income → min exposure → min drift from booked times
                    ├─ parse_jobs.py  Bedrock Converse + tool schema → draft jobs (worker confirms)
                    └─ store.py       DynamoDB plans, 7-day TTL
                        │
                    CloudWatch: plan_generated / plan_recalculated JSON events
```

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/plans/optimize` | Solve a day from target, hours, jobs and weather mode |
| `POST /api/v1/plans/{id}/simulate` | Re-solve the same inputs with the forecast shifted by -2 to +6 °C, returns a diff |
| `GET /api/v1/plans/{id}` | Fetch a stored plan |
| `POST /api/v1/jobs/parse` | Hindi/English text to draft jobs via Bedrock |
| `GET /api/v1/weather` | Annotated hourly weather (demo or live) |
| `GET /api/v1/methodology` | Policy version, rules, weights, limits |
| `GET /api/v1/health` | Health and storage backend |

## How it decides

1. Every 15-minute slot gets an NWS heat-index band from the forecast (demo: a labelled synthetic Lucknow heatwave; live: Open-Meteo).
2. Hard rules remove slots. Extreme danger: no work outside a cooled room. Danger: no heavy work, and no direct-sun work for anyone not used to heat (the default when unsure).
3. CP-SAT maximizes income from the worker's own jobs. If the target is reachable it then minimizes the modelled exposure score subject to reaching it, then stays as close as possible to booked times. Jobs never overlap, travel and rest are explicit intervals, fixed appointments never move.
4. Every solution is re-checked by an independent validator before it is returned.
5. "As booked" is the same jobs at their booked times with no heat rules. The percentage compares those two scores.

Full rules, weights and limits: `/methodology` in the app or `services/api/app/policy.py`.

**Limits.** This is a scheduling prototype, not a certified occupational safety assessment. The exposure score is a ranking heuristic, not a medical risk. Heat index is a shade-based screening value, not WBGT, and a forecast is not an onsite measurement.

## Tests

```bash
cd services/api && ./.venv/bin/python -m pytest -q
```

19 tests cover income sums, fixed-appointment overlap, availability windows, shortfall, heavy-work bans, scenario copies that never mutate the source forecast, determinism, input validation, empty input, the rule that the target never relaxes policy, travel and rest non-overlap, and the demo transition (₹800 at +0 °C, ₹650 at +5 °C with only the rooftop job removed).

## Data and credits

- Weather: [Open-Meteo](https://open-meteo.com) (CC BY 4.0). Heat index: US National Weather Service Rothfusz regression.
- Demo weather and jobs are synthetic and labelled as such on every screen.
- Hero images are AI-generated (OpenAI image generation via Codex CLI).
- AI coding tools used: Claude Code (Claude Opus 5.5) and Codex CLI for image generation.

## License

MIT
