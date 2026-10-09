---
format: 1920x1080
duration: 125s
message: "₹800 rearranges an outdoor worker's real jobs around the heat, and says honestly when the day's target can't be met without breaking a heat rule"
arc: Hook → Value claim → Demo loop (input → plan → hotter replan) → Principle → AWS proof → Reach → Close
audience: hackathon judges (WeMakeDevs x AWS Environmental Hacks, Heat & Water track)
mode: autonomous
music: calm, warm, understated ambient piano bed, low energy, no drums
---

## Video direction

- palette system: the app's own tokens (frame.md roles remapped): ground #111315, surface #1D2022, text #F3F0E9, muted #A7ABA8, heat accent #F28C45, cool #72B8C5, warn #E8B84C, hairline #34383A. One accent only (heat orange) for kickers, rules and the closing line.
- layout: every clip frame shares one editorial template. Real recording in a 1440x810 panel (x 440, y 44) framed by a 1px hairline with an orange stub rule; a 336 px left rail (x 64) carries the chapter kicker and stat or item cards. Everything sits above y 896 (caption band clear). Frame 9 swaps the panel for a phone bezel; frame 10 is type only.
- motion grammar + reveal model: each rail card fades up (opacity + 24 px rise, power3.out, 0.7 s) on the word that names it; nothing in the rail appears before the voice reaches it. Motion inside the panel is the real recording itself; punch-ins are baked into the clip crops, never animated in HTML.
- rhythm: frames 5 and 7 hold longer reads on the same screen (slow footage) as breathers before and after the replan climax in frame 6.
- negative list: no recreated UI, no stock imagery, no floating decorative shapes, no narration sentences as on-screen text, no exits except the final frame, no front-loading (rail empty except the kicker at t=0), no screensaver drift.

## Frame 1: 44 degrees, ₹800 to earn

- blueprint: compose
- focal: assets/clips/f01.mp4

- type: hook
- scene: Live landing page; the rooftop photo fades from dawn (worker at the wiring box) to an empty, scorching noon roof while the on-page clock runs to 14:00
- duration: 11.886s
- transition_in: cut
- voiceover: "Forty-four degrees in Lucknow. Ravi, an electrician, still needs to earn eight hundred rupees today. The usual advice is: don't work outside. For him, that means losing the day."
- asset_candidates: clips/01-landing.mp4 (0 to 11.6s)
- status: animated
- src: compositions/frames/01-hook.html

Open on the real site. The dawn-to-noon fade, with the worker disappearing from the roof, is the whole problem in one image.

## Frame 2: It plans around the heat

- blueprint: compose
- focal: assets/clips/f02.mp4

- type: product_intro
- scene: Same clip scrolls to the landing replay: booked day, rearranged day, +5°C, ₹650 with the reason
- duration: 9.064s
- transition_in: cut
- voiceover: "Eight Hundred doesn't tell him to stop. It rearranges the jobs he already has around the heat, and tells him honestly what the heat will cost him."
- asset_candidates: clips/01-landing.mp4 (13.3 to 28.8s)
- status: animated
- src: compositions/frames/02-value.html

The value claim lands in beat two. The replay is real solver output, so it is evidence as well as a preview.

## Frame 3: He says his jobs in Hindi

- blueprint: compose
- focal: assets/clips/f03.mp4

- type: feature_showcase
- scene: Hindi jobs page; a Hindi sentence types into the box, "काम पढ़ें" is clicked, two job cards fill in from the model
- duration: 14.393s
- transition_in: crossfade
- voiceover: "He says his jobs in Hindi. A language model, called from Lambda, turns that into job cards: pay, time window, sun or shade. He checks every field. The model never decides timing or safety."
- asset_candidates: clips/02-hindi-entry.mp4 (2.6 to 31s; speed up the 9.6 to 19.9s model wait)
- status: animated
- src: compositions/frames/03-hindi-entry.html

## Frame 4: Four jobs, one tap

- blueprint: compose
- focal: assets/clips/f04.mp4

- type: feature_showcase
- scene: The four demo jobs (rooftop ₹300, plumbing ₹250, fan repair ₹250, meter board ₹150), Generate work plan clicked
- duration: 7.967s
- transition_in: cut
- voiceover: "Here is his day: four jobs, nine hundred and fifty rupees if he did them all. One tap to plan."
- asset_candidates: clips/03-plan-replan.mp4 (5.9 to 15.4s)
- status: animated
- src: compositions/frames/04-jobs.html

## Frame 5: The day, rearranged

- blueprint: compose
- focal: assets/clips/f05.mp4

- type: benefit_highlight
- scene: Plan result: ₹800 target reached, 27% lower exposure score; timeline with As booked (rooftop flagged at 09:00 in Danger) vs Rearranged; the rooftop reason line
- duration: 24.973s
- transition_in: cut
- voiceover: "A constraint solver on AWS Lambda reads the hourly heat index. The rooftop job was booked for nine, already in the danger band, so it moves to six-thirty. The air-conditioned job takes the hottest hours. Travel and rest are real blocks. Target reached, with a twenty-seven percent lower exposure score than the day as booked."
- asset_candidates: clips/03-plan-replan.mp4 (15.4 to 32.4s)
- status: animated
- src: compositions/frames/05-plan.html

## Frame 6: Five degrees hotter

- blueprint: compose
- focal: assets/clips/f06.mp4

- type: feature_showcase
- scene: Simulator at +3°C, Replan clicked; job blocks slide, the rooftop block turns into a dashed ✕, ₹650 and the "Why did this change?" panel
- duration: 16.547347s
- transition_in: cut
- voiceover: "Now make it three degrees hotter. The solver plans the whole day again. Every rooftop slot now breaks a heat rule, so that job is gone. Six hundred and fifty rupees. A hundred and fifty short. And it says exactly why."
- asset_candidates: clips/03-plan-replan.mp4 (32.4 to 48.5s)
- status: animated
- src: compositions/frames/06-replan.html

The core moment. The plan changes because the solver re-ran on Lambda, not because of an animation.

## Frame 7: The rules don't bend for money

- blueprint: compose
- focal: assets/clips/f07.mp4

- type: benefit_highlight
- scene: The ₹650 / ₹800 income card with "We couldn't find a plan that reaches ₹800 within the current heat rules", then the footer line naming Lambda and DynamoDB
- duration: 9.744s
- transition_in: cut
- voiceover: "Eight Hundred will not bend the heat rules to make the money work. It shows him the trade-off, so he can decide: move a customer, or find indoor work."
- asset_candidates: clips/03-plan-replan.mp4 (48.5 to 57s)
- status: animated
- src: compositions/frames/07-principle.html

## Frame 8: Running on AWS

- blueprint: compose
- focal: assets/clips/f08.mp4

- type: social_proof
- scene: Real terminal: CloudWatch log events for this exact replan, the DynamoDB record linked to its parent plan, the Lambda function configuration
- duration: 16.144s
- transition_in: crossfade
- voiceover: "Every plan you just saw was solved on AWS Lambda, behind API Gateway. CloudWatch logs each replan. DynamoDB stores it, linked to the plan it came from. And the site runs on Amplify."
- asset_candidates: clips/05-aws-terminal.mp4 (0 to 19s)
- status: animated
- src: compositions/frames/08-aws.html

## Frame 9: On his phone, in Hindi

- blueprint: compose
- focal: assets/clips/f09.mp4

- type: feature_showcase
- scene: Phone-sized Hindi result page scrolling, then "तबीयत ख़राब है?" tapped and the 108 / 112 guidance
- duration: 8.359s
- transition_in: crossfade
- voiceover: "It works in Hindi on a budget phone. And if he feels unwell, it shows guidance to stop work and get help."
- asset_candidates: clips/04-mobile-hindi.mp4 (6.4 to 27.8s)
- status: animated
- src: compositions/frames/09-mobile.html

## Frame 10: Plan around both

- blueprint: compose
- focal: closing type

- type: cta
- scene: Closing card: ₹800, "The heat doesn't stop the bills.", the live URL and the GitHub repo
- duration: 4.963s
- transition_in: cut
- voiceover: "The heat doesn't stop the bills. Eight Hundred helps him plan around both."
- asset_candidates: none (type only; brand colors and fonts from frame.md)
- status: animated
- src: compositions/frames/10-close.html
