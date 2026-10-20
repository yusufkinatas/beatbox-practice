# Beatbox Practice: plan for v1, the sound coach

Agreed with the owner on 2026-10-20 in a design interview. Nothing in this plan is implemented yet. Start at "Build order", step 1.

## Where things stand

- `index.html` is v0: a working single-file timing trainer (vanilla JS, Web Audio, AudioWorklet from a Blob URL). It learns the user's own B / t / K (8 samples each, kNN on 8 spectral features), then scores timing and "sound match" per step against a metronome. It went through 3 review rounds and matches the v0 design closely.
- `selftest.mjs` tests v0's pure logic block (`node selftest.mjs`, 25 tests).
- `DESIGN.md` is the v0 design spec (the "Step Deck" look). The design canvas is the Artifact https://claude.ai/artifact/56x72RiPzkVas9YBoyQLSA (artboards in `project/*.dc.html`).
- Vercel project `beatbox-practice` (scope `yusuf-kinatas-projects`) is linked in `.vercel/`. https://beatbox-practice.vercel.app serves an early v0 build.
- The folder is not a git repo yet.

## Why v1

v0 only checks that you repeat whatever three noises you taught it. Any noise works, and nothing says whether a sound is a good beatbox sound. The owner is a beginner and wants the app to tell them whether they are hitting the sound, and how to fix it.

## Decisions

### Roadmap
1. Sounds first, then timing, then patterns.
2. Sounds in scope: kick **B**, closed hi-hat **t**, outward **K** snare. Inward K could become a 4th sound later, with its own rules.

### The judge
3. Layered:
   - **Quality** comes from rules.
   - **Identity** ("which sound is this?") comes from a small model plus obvious rules.
   - The user's own recordings only help the app recognize them. They never define what is correct.
4. Identity model: train offline here, mainly on the AVP dataset (amateurs, laptop mic, close to a beginner). Export it as JSON that the app runs directly, with no ML runtime in the browser. The features must be computed identically in training and in the app.
5. Rules can veto the model with a reason ("Not a kick: no low end."). A veto counts as a wrong sound, with a tip.
6. If the model is unsure, the verdict is "Couldn't tell, try again". If more than about 1 in 10 hits get it, that is a judge problem to fix, not something to retry.
7. "Not any of your sounds" is a valid verdict. The user may make a noise that is none of B / t / K.
8. Quality mistakes v1 catches:
   - a vowel tail ("buh", "tuh", "kuh")
   - too much air (a long, hissy tail)
   - voice on t or K (they should be unvoiced)
   - a weak kick (not enough low end or punch at the start)
   - too quiet
   - wrong or none sound (decisions 5 and 7)

   Left for later: a cough-like K (hard to tell from a clean K without a trained model).
9. The worst failure is a wrong rule. This guards against it:
   - **"Why?" view on every hit:** each active check shows its measured value against its limit, plus the model's confidence per sound and any veto. It is always visible in the prototype, and behind "details" in the real app.
   - **Rule audit:** a rule that fails even one pro clip is treated as wrong. It switches off until fixed, and the report names it.
   - **Pro clips are never used to train anything.** They stay a clean test.
10. Personal profile (later step): a user's take joins their profile only after it passes the checks.

### Feedback on each hit
11. Show the verdict, then **every** failing check with its own tip, and playback of the user's hit next to the pro reference for that sound. Scores and the "Why?" view sit behind "details".
12. Thumbs up / down on verdicts exist **only in the prototype / MVP**, never in the real app. A thumbs-down stores the hit and its measurements for review against the rule.

### Levels and session flow
13. Each sound levels up on its own:
    - **Level 1 "It's a B":** right sound, loud enough, no vowel tail.
    - **Level 2 "Clean":** adds the too-much-air check.
    - **Level 3 "Sharp":** adds unvoiced for t and K, and punch for B.
14. Level up when 7 of the last 10 hits pass at the current level. Never drop back down.
15. Per sound, the session runs: listen and copy (the app plays the pro reference, then listens; the two never overlap), then a drill (repeat until you pass), then free play.
16. Timing mode with sound judging unlocks when all three sounds reach level 1. In timing mode it judges only "right sound", never quality.
17. Until timing mode is rebuilt, keep v0's Practice screen as a **timing-only warm-up**: timing scoring stays, and v0's own-sound matching is removed.

### Truth and testing
18. Roles in the test set:
    - **Good:** pro clips only. About 8+ isolated hits per sound, from at least 2 or 3 beatboxers, each approved by the owner by ear.
    - **Bad:** the owner's exaggerated mistakes, made on purpose (obvious "buh", obviously airy, voiced "ts"). The owner is a beginner, so their normal takes are not trusted as good.
    - **Off-target:** noises that are none of the sounds (claps, coughs, "uh", clicks, speech).
    - **Unlabelled:** the owner's honest attempts. They get judged, and the owner rates the verdicts with thumbs.
19. Test set size: per sound, 5 of each relevant mistake, plus about 15 off-target noises, recorded on **both** phone and laptop. Grow it whenever the judge gets something wrong.
20. **Go bar** for the judge prototype:
    - every pro clip passes (non-negotiable)
    - at least 80% of the exaggerated mistakes are flagged with the right tip
    - at least 80% of off-target noises are rejected

    Between 70 and 80%: look at which rule is failing before deciding anything.
21. The owner gives approximate video timestamps. Search about ±5 s around each, find the isolated hits, and play the candidates back for approval.

### Tuning loop
22. Borrow the idea of karpathy/autoresearch, not the repo (that one trains text models on an NVIDIA GPU). Once the test set and pro clips exist, an agent tunes rule thresholds and the identity model against the go bar: change, score, keep or discard, log every try. It must never improve the score by failing a pro clip.

### Data and storage
23. The owner's test recordings live in `testset/` in the project folder. Git ignores them and they are never deployed. The dev server saves them there.
24. Recording on the phone away from the PC: the deployed app records and labels takes into the phone's browser storage, and an "Export" button shares a zip through the phone's share sheet. An import script files the zip into `testset/`. Export after each recording session, since browser storage can be cleared.
25. App history, kept on the device: pass rates and unlocks per sound per day, plus recent audio takes (about the last 30 days) so the user can replay old takes against new ones. No backend for now.

### Stack, repo, deploy
26. Vite + TypeScript, no UI framework. Reuse v0's audio pipeline (worklet onset detection, mic setup, gesture handling, scheduler).
27. `git init`, commit the current app, tag it `v0`. Push to a **private** GitHub repo `yusufkinatas/beatbox-practice` (`gh` is logged in as yusufkinatas). Connect the Vercel project to it. Vercel switches from a plain static site to the Vite preset.
28. `main` is the working branch. Every push to `main` deploys to production, https://beatbox-practice.vercel.app, which is public and stable. The owner approved this, so pushing to `main` counts as an approved production deploy. The stable address also keeps phone recordings across updates (browser storage is tied to the address).

### Design
29. Keep the v0 "Step Deck" look (DESIGN.md) and extend it with the sound coach screens. Blue and orange stay reserved for on-time and off-time. Sound verdicts need their own encoding, without using those colors.
30. Design for phone and laptop equally. If a limitation forces a choice, ask the owner.
31. Tips: the agent drafts them from tutorial material, and the owner reviews them in the design phase.

## Build order

1. **Repo:** git init, tag `v0`, private GitHub repo, Vercel connected via git (decisions 27 and 28).
2. **Judge prototype:** a bare page in the new Vite + TS project, with no designed screens. It needs:
   - the live mic, with each hit cut out and judged by the rules plus the identity model, showing verdict, tips and the "Why?" view, plus thumbs
   - a record-and-label mode ("B, airy" × 5), saving to `testset/` on the dev server, or exporting from the phone
   - pro clip import with approval by ear
   - a report that scores the judge against the go bar and runs the rule audit
3. **Tune** (decision 22) until the go bar passes. Stop and show the owner the report.
4. **Design:** extend DESIGN.md and the canvas with the sound coach (listen and copy, drill, free play, levels, "Why?" details, history, the timing-only warm-up). The owner reviews it before the build.
5. **Build the sound coach.**
6. Later: personal profile (decision 10), timing mode on the new judge, then patterns.

## Pro reference clip candidates

Each timestamp below was checked against the audio: an isolated hit has at least 250 ms of near-silence on both sides. Times are absolute video seconds. The owner still has to approve each clip by ear. Planned mix: the owner's picks where they have clean hits, filled in from the tutorial channels.

| Source | URL | B | t | K (outward unless noted) |
|---|---|---|---|---|
| Wing, "DOPAMINE \| Tutorial" | https://youtu.be/TT-9OhiSX8Y | 368.1 | 368.8, 377.6 | 369.6, 380.0 (borderline) |
| D-Low, "5 TOP TIPS" | https://youtu.be/v0POPH-M3SU | 182.8 | | 87.7, 88.4, 89.1, 89.8, 91.8, 93.3, 97.8 to 100.7, 175.4 to 185.0 |
| D-Low, "Whistle Hihat Tutorial" | https://youtu.be/zpjXQHt9AB4 | | 56.8 | |
| Seboom Academy, "Your First Beat" (cleanest) | https://youtu.be/XBSPHZp0s60 | 552.8, 554.8, 556.8, 558.8, every 2 s from 566.8 to 578.8 | 219.1, 220.0, 220.9, 222.8, 223.8, 224.7, 233.4 | 373.6, 376.1, 378.5, 390.9, 393.3, 395.7 |
| FootboxG, kick | https://youtu.be/m37cDsDl-4I | 44.9, 46.0, 48.1, 49.1, 50.4, 55.2, 58.1 | | |
| FootboxG, hi-hat | https://youtu.be/B19ZKJaHamo | | 17.7, 18.8, 22.2, 29.8, 31.1, 40.9, 45.7 | |
| FootboxG, outward K | https://youtu.be/BTWwO_Dh21g | | | 26.5, 27.2, 27.8, 30.6, 31.7, 46.8, 49.3, 54.2, 56.6 |
| SkilleR, "How to beatbox" (faint music) | https://youtu.be/gXv8x4HVEcI | 101.6, 102.3, 103.0, 110.6, 111.2, 111.7, 112.8, 116.9 | | 179.7, 181.0, 181.6, 182.1, 182.6, 183.1, 183.5, 184.0 |
| Colaps, "Click Roll K Snare" | https://youtu.be/6lCCGmOWgPs | | | **inward** K only: 43.3 to 57.9 (not in scope for v1) |

Notes:
- In FootboxG videos from about 40 s on, he counts "1 2 3" before each hit, and those words also pass the isolation test. Use only the listed times.
- Wing's hits have Korean speech just outside the 250 ms gaps.

## Research notes

- **Nobody grades beatbox sounds yet.** No public dataset labels sounds good or bad, and no app or model is known to judge correctness. Research and apps (Dubler, HumBeatz, VoxBeat) only name which sound was made.
- **AVP dataset** (Delgado 2019): 28 amateurs, about 9,780 hits, classes kick / snare / closed hat / open hat, recorded on a MacBook mic. https://zenodo.org/records/5036529. AVP-LVT adds phoneme labels: https://zenodo.org/records/5578744. beatboxset1 (experienced beatboxers, full beats): https://archive.org/details/beatboxset1
- **Accuracy:** naming sounds reaches 95 to 98% on isolated hits, about 77 to 82% when trained on isolated hits and tested on improvisation, and about 72% for a general model on a new person, versus 87 to 90% when adapted to that user (Delgado 2021 and 2022, https://ar5iv.labs.arxiv.org/html/2204.04646).
- **v0's classifier** is essentially Hipke 2014 (centroid and RMS statistics with kNN).
- **The only known grader** (Lui, NIME 2013) compared the user's sound to reference features. Non-musicians improved most with plain right/wrong feedback.
- **Measurable markers.** The kick is a voiceless bilabial ejective, with a low-frequency burst in the first ~40 ms. The closed hat is short (~94 ms in one study), with energy from 1.6 to 10 kHz. The outward K is a pulmonic velar affricate. A vowel or voicing shows up as periodicity plus a long tail. Too much air shows up as a long, noisy, flat-spectrum tail. The thresholds come from 1 to 5 performers, so they need tuning.
- **Browser options if a bigger model is ever needed:** ONNX Runtime Web, TF.js speech-commands (about 5.9 MB). Meyda for features.

## Environment notes for the next agent

- **Tools here:**
  - `yt-dlp` (`/opt/homebrew/bin`)
  - git, `gh`, python3 with numpy and scipy
  - Vercel CLI (logged in as yusufkinatas)
  - agent-browser at `/Users/yusufeminkinatas/.nvm/versions/node/v24.16.0/bin/agent-browser`
- **ffmpeg:** use `/opt/homebrew/bin/ffmpeg`. The one in `~/.local/bin` is an Intel build that does not run.
- **Cutting clips with yt-dlp:** add `--force-keyframes-at-cuts` to `--download-sections`, or the cut times drift (a 30 s window came back 40 s long).
- **Fake-mic testing in headless Chrome (agent-browser `--args`):**
  - `--mute-audio` on every launch (the owner hears it otherwise)
  - `--use-fake-ui-for-media-stream,--use-fake-device-for-media-stream,--use-file-for-fake-audio-capture=<wav>`
  - on macOS also `--disable-features=AudioServiceOutOfProcess`, or the fake mic records digital silence
  - each relaunch gets a fresh profile (localStorage is wiped) unless you pass the same `--profile <dir>`
- **Mic needs a secure context:** HTTPS or localhost. On phones, create or resume the AudioContext inside a tap, and expect iOS Safari to show only about 664 px of an 844 px screen.
