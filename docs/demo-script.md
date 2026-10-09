# Demo video script (target 175 s)

Record at 1280×800 on https://main.d231iqub8spohk.amplifyapp.com. Second tab: AWS console, CloudWatch log group `/aws/lambda/rs800-api` and DynamoDB table `rs800-plans`.

| Time | Screen | Voiceover |
|---|---|---|
| 0:00 to 0:15 | Landing hero. Let the dawn rooftop fade to the empty noon rooftop and the clock run to 14:00. | "When it's 44 degrees, the advice is: don't work outside. For Ravi, an electrician in Lucknow, staying home means losing the ₹800 he needs today." |
| 0:15 to 0:30 | Scroll to the replay. Let it play "As booked" then "Rearranged". | "₹800 doesn't tell him to stop. It rearranges the jobs he already has around the heat." |
| 0:30 to 0:55 | Click Plan my day. Switch to हिंदी. Type or speak the jobs, click Read my jobs, confirm the drafts. (The first call can take 10 seconds while the model wakes up. Do one practice call before recording.) | "He says his jobs in Hindi. A language model turns that into draft jobs. He checks every field. The model never decides timing or safety." |
| 0:55 to 1:20 | Generate work plan. Point at the As booked row (rooftop flagged at 09:00 in Danger) and the Rearranged row. | "A constraint solver on AWS Lambda moves the rooftop job to 06:30, plumbing before the peak, and puts the air-conditioned job in the hottest hours. Travel and rest are real blocks. ₹800 reached, with a 27% lower exposure score than the day as booked." |
| 1:20 to 1:50 | Slide to +3°C (the default), click Replan. Blocks move, rooftop becomes a dashed ✕, income counts to ₹650. Read the "Why did this change?" panel. | "Now the forecast runs five degrees hotter. The solver plans again. Every rooftop slot now breaks a heat rule, so that job is gone. ₹650, ₹150 short, and it tells him exactly why." |
| 1:50 to 2:10 | Hold on "₹800 will not relax the heat rules to reach your target." | "It will not bend the rules for money. It shows him the trade-off honestly, so he can decide: reschedule a customer, or find another indoor job." |
| 2:10 to 2:40 | AWS tab: CloudWatch `plan_generated` and `plan_recalculated` events with the plan ids, then the DynamoDB item, then back to the footer line "Solved by OR-Tools CP-SAT on AWS Lambda rs800-api in 91 ms". | "Every plan is solved in Lambda behind API Gateway, logged to CloudWatch and stored in DynamoDB. The frontend is on Amplify." |
| 2:40 to 2:55 | Mobile view in Hindi, tap Feeling unwell? | "It works on a budget phone, in Hindi, and if he feels sick it shows guidance to stop work and get help." |
| 2:55 | Hero line. | "The heat doesn't stop the bills. ₹800 helps workers plan around both." |
