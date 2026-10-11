# ₹800: planning an electrician's heatwave day with OR-Tools on AWS Lambda

*Built for WeMakeDevs × AWS Environmental Hacks 2026, Heat & Water track.*

![The day as booked vs the day rearranged around the heat index](https://raw.githubusercontent.com/himanshu748/rs800/main/docs/assets/plan.jpg)

## The problem

Every heatwave, the advice is the same: avoid working outside between noon and 4 PM. That advice works if you have a salary. Ravi, an independent electrician in Lucknow, doesn't. If he takes the afternoon off, he loses the money he needed for that day.

A weather app knows it will be 44 °C. It doesn't know Ravi has a rooftop repair booked for 09:00, a pump job at noon, an air-conditioned office job and a meter check in a covered market. It doesn't know he needs ₹800 today. Nothing connected his real jobs, his income target and the hourly heat.

So the question I built for was narrow: **given the jobs he already has, what is the least dangerous way to earn what he needs today? And if he can't, what does the heat cost him?**

## What ₹800 does

1. Ravi enters his jobs (or says them in Hindi). Each job has pay, a time window, a duration and an environment: direct sun, outdoor shade, indoor uncooled or indoor cooled.
2. The backend screens every 15 minutes of the forecast with the US National Weather Service heat index and removes every slot that breaks a heat rule.
3. A constraint solver picks the plan that reaches ₹800 with the lowest modelled heat exposure. Travel between jobs and rest after outdoor work are scheduled as real blocks.
4. If ₹800 can't be reached inside the rules, it says so, shows the exact shortfall and gives the reason for every job it dropped.

On the demo day the rooftop job moves from 09:00 (already in the danger band) to 06:30. The air-conditioned job takes the hottest hours. Target reached, with a 27% lower exposure score than the day as booked.

Then you slide the forecast hotter and the solver plans the whole day again:

| Forecast | Income | Why |
|---|---|---|
| +0 °C | ₹800 of ₹800 | Rooftop job moved to 06:30 |
| +3 °C | ₹650, ₹150 short | Every rooftop slot now breaks the direct-sun rule, so that job is gone |
| +5 °C | ₹250 | Reaching the cooled job means travelling in extreme danger, and the meter job has no safe slot that leaves time to rest before 19:00 |

![Replanning at +3 °C: ₹650 with a reason for every change](https://raw.githubusercontent.com/himanshu748/rs800/main/docs/assets/replan.jpg)

The rule I held to: **the target never relaxes a heat rule.** If the money doesn't work, the app shows the trade-off and Ravi decides. He can move a customer or find indoor work. It never quietly schedules him onto a roof at 13:00.

## The stack

| Piece | What it does |
|---|---|
| **AWS Lambda** (Python 3.12, 1024 MB) | FastAPI behind Mangum. Runs the heat index, the policy rules and the OR-Tools CP-SAT solver. A typical plan solves in 50 to 250 ms. |
| **Amazon API Gateway** (HTTP API) | Public API, throttled to 10 requests per second with a burst of 20. |
| **Amazon DynamoDB** | Single table. Every plan and replan is stored, each replan linked to its parent with its diff. 7-day TTL. |
| **Amazon CloudWatch** | One structured JSON event per plan: `plan_generated`, `plan_recalculated`, `jobs_parsed`. |
| **AWS Amplify Hosting** | The static Next.js 16 site, in English and Hindi. |
| **Amazon Bedrock** | Fallback provider for reading jobs from speech. |
| **GLM 5.3 on Modal** | Primary model for turning Hindi or English speech into draft job cards, called from Lambda. |
| **Open-Meteo** | Live forecast mode. The demo uses a labelled synthetic Lucknow heatwave. |

```text
Browser (EN / हिंदी) → Amplify → API Gateway → Lambda (FastAPI + CP-SAT) → DynamoDB
                                                   └→ CloudWatch events
```

## How the solver decides

Each job becomes a set of candidate start times that survive the heat rules. Each candidate is an optional interval covering travel, then the job, then the rest block. One `NoOverlap` constraint keeps the whole day physically possible.

The objective is lexicographic, solved in three passes:

```python
m.maximize(income)                      # 1. how much can he earn inside the rules?
...
m.add(income >= req.target_income)      # 2. reach the target (or that maximum)
m.minimize(exposure)                    #    with the least modelled heat exposure
...
m.add(exposure == best_exposure)        # 3. among equally safe plans,
m.minimize(drift)                       #    stay closest to the times customers booked
```

Three passes instead of one weighted sum is what makes the output explainable. "Removed because every slot breaks a rule" and "moved to 08:15 because it cut the exposure score from 480 to 350" both come straight from which pass made the decision. Each pass has a 1.5 s limit, a fixed seed and one worker, so the same input always gives the same plan.

Every solution then goes through a separate validator that re-checks it against the rules from scratch. If the solver and the validator disagree, the API fails loudly instead of returning a plan.

## Where the language model fits (and where it doesn't)

Ravi can say *"सुबह 9 बजे छत पर बिजली का काम है, 300 रुपये"* and get a draft job card. Lambda calls GLM 5.3 on Modal through its OpenAI-compatible API with a forced tool schema, so the model can only return structured fields. Bedrock sits behind the same function as a fallback.

The model fills fields. Ravi checks every one. **The model never decides timing or safety.** That stays in deterministic code that a test can pin down.

## What fought back

**Bedrock access.** Bedrock calls were blocked on my account (a billing issue I couldn't clear in time), so job reading moved to a Modal-hosted GLM 5.3 endpoint. I kept Bedrock as a fallback behind the same `parse_jobs()` call, so switching back needs only an environment variable.

**A reasoning model that answered in the wrong field.** GLM 5.3 sometimes spent its whole token budget thinking and returned an empty `content`, with the JSON sitting in `reasoning_content`. The fix was a larger `max_tokens` and checking `content`, then `reasoning_content`, then `reasoning`. Failures are logged with which provider failed and how many reasoning characters came back.

**OR-Tools on Lambda without Docker.** The Linux wheels unzip to about 158 MB, under Lambda's 250 MB limit. `deploy.sh` installs them for `manylinux` x86_64, zips them, uploads through S3 and creates or updates every resource idempotently.

**Missing Lambda logs.** My `logging.info` events never showed up in CloudWatch. I switched to printing one JSON object per event, which CloudWatch picks up as-is.

**A timeout that looked like a ₹0 day.** Under CPU contention the second solver pass sometimes timed out, and the API returned an empty plan. The "Before" card read ₹0. The max-income plan from the first pass was already valid, so a timeout in the later passes now returns that plan instead of nothing. A test forces the timeout and checks the response.

**Bugs a review found before judges could.** A review pass against the live demo, the day before submission, found three:

- **Travel ignored the heat rules.** At +5 °C the plan sent Ravi across the city in direct sun during extreme danger. The job slots were checked, but the travel minutes before them weren't. Travel is now checked against the same policy (`EXTREME_DANGER_NO_TRAVEL`).
- **Rest ran past the workday.** A required 30-minute rest ended at 19:30 on a day that ended at 19:00. A candidate is now dropped if its rest block doesn't fit, and the reason says so (`NO_TIME_FOR_REST`).
- **Reopened replans lost their explanation.** The before/after diff was computed on the fly and never stored. It's now saved to DynamoDB with the replan, and the URL keeps the replan id.

Each fix came with a test. The suite is at 31 tests, including the exact demo transition: ₹800 at +0 °C, ₹650 at +3 °C with only the rooftop job removed and ₹250 at +5 °C. If any of those numbers move, the build fails.

## What I learned

- **Hard rules beat clever scoring for safety.** A heat rule is a constraint the solver can't trade away, not a big penalty. That's the only way "the target never relaxes a rule" is actually true.
- **Make the honest answer the main feature.** The most useful screen isn't the plan that works. It's ₹650 with "₹150 short, and here's exactly why."
- **Keep the language model at the edges.** It's great at turning Hindi speech into fields. It has no business deciding when someone climbs onto a roof.
- **Explanations need structure behind them.** Every reason in the UI is a code plus parameters from the solver (`BLOCKED_BY_HEAT_POLICY`, `NO_TIME_FOR_REST`), translated into English or Hindi on the client. That's what made the Hindi version cheap to add.
- **Review the demo path like a stranger would.** All three of the worst bugs were invisible to me because I always clicked through the same way.

## Honest limits

This is a scheduling prototype, not a certified occupational safety assessment. The heat rules and exposure weights are prototype guardrails, not validated thresholds or a medical risk. The heat index is a shade-based screening value, not WBGT. Demo weather and jobs are synthetic and labelled on every screen. A **Feeling unwell?** button on every page shows guidance to stop work and get help (108, 112).

## Try it

- **Demo video (2 min):** https://www.youtube.com/watch?v=xtvfS-8Q3ro
- **Live app:** https://main.d231iqub8spohk.amplifyapp.com
- **Code (MIT):** https://github.com/himanshu748/rs800

*AI tools used: Claude Code (Claude Opus 5.5) for code and docs, Codex CLI for the hero images, GLM 5.3 on Modal inside the product for job reading.*
