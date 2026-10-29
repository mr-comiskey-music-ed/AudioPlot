# AudioPlot

## Purpose
A studio and stage plot designer and signal flow simulator. Students
learn how audio gear connects and how signal moves through a studio
or stage setup, by building plots themselves. Drills are the means;
the goal is students designing real setups with understanding.

## Hard rules
- Never save student data anywhere: no database, no backend, no
  server logs. Data that only travels inside the student's own code
  (like their name) is fine.
- Students show work with a base64 code pasted into Google Classroom.
- Must run well on Chromebooks and stay lightweight.
- Repo: github.com/mr-comiskey-music-ed/AudioPlot. Deployed on Vercel
  at audioplot.mrcomiskey.com. Work on a branch and don't
  push to main unless I say so.

## Structure
- Default mode is an ungraded open sandbox.
- Teachers can assign graded tasks: an open-ended one (any 4
  instruments) plus the existing challenges, which come with given
  instruments.
- A Learn modal, like the other apps have. Keep it lean. It replaces
  the old Field Guide, which is being dropped.
- The studio/stage canvas needs a way to expand for more
  instruments/gear. Not a zoom-in.

## Grading
- This app is where the code compression and the teacher batch grade
  report were first built; SynthLab and MixerLab follow its approach.
  Keep the code format stable. Old student codes should keep working.
- Teacher side: paste a whole class's codes, see grading results, and
  pull up each student's work one at a time.

## Signal flow simulation
Signal path: source → mic/DI/amp → snake input → mixer channel →
master bus → snake outputs (MAIN L/R, MON 1/2) → PA / monitors.
- Mics capture a source acoustically, not by cable. A mic is tied to a
  source by `latchedSourceInstanceId` (an instance id, `'room'`, or
  `'drummer'`), or failing that by distance (within ~140px of an
  instrument or amp).
- Cables are `xlr`, `quarter_inch` or `speaker`. Each cable is checked
  as it's drawn (`src/components/canvas/signalValidation.ts`): e.g.
  electric guitar/bass/keys need 1/4" into an amp or DI; acoustic
  sources have no jack and need a mic; mics, DIs and bass-amp direct
  out go to the snake on XLR. Bad cables are refused with a teaching
  toast, not stored.
- Patching to `snake_in_N` assigns that gear to mixer channel N
  (8 channels by default). Snake outputs are `snake_out_main_l/_r`
  (PA speakers only) and `snake_out_mon1/2` (wedges or IEM
  transmitters). Wedges and PA speakers daisy-chain over XLR.
- `validateChannelSignalChain` (`src/services/gradingEngine.ts`) is the
  single source of truth for "does this channel have signal". It fails
  on: unpatched channel, condenser without +48V, mic aimed at nothing,
  mic on an electric instrument directly, amp/DI with no 1/4" input.
- The audio engine (`src/services/audioEngine.ts`, Web Audio + Tone)
  plays a synced 10-second MP3 stem per instrument (`public/audio/`)
  only on channels that pass that check, then applies gain, fader,
  pan, mute/solo, and master trim/fader/dim/mono, with a limiter.
  Channels with fader ≤ 5 or muted are silent. Students hear their
  mistakes.
- `traceSignalPath` (`src/components/canvas/signalPath.ts`) highlights
  the whole up/downstream chain for selected gear (the HUD view).

## Tasks and challenges (`src/data/challenges.ts`)
- No task = sandbox (`SANDBOX_ID = 'sandbox'`): checks run, no grade.
- Teachers assign a task with an assignment link (`?task=<id>`), made
  in `ChallengeModal`.
- Open tasks (student picks ≥ 4 instruments): `open_studio`,
  `open_live`.
- Studio challenges (instruments pre-placed): `studio_singer_songwriter`
  (acoustic gtr + vocal), `studio_jazz_trio` (piano, vocal, bass, sax),
  `studio_drum_set` (kick, snare, 3 toms, stereo overheads),
  `studio_rock_band` (kick, snare, cymbals, bass rig, guitar cab, keys,
  vocal).
- Live challenges: `live_classical_duo` (piano, violin),
  `live_small_band` (guitar amp, vocal, keys), `live_blues_band` (kick,
  snare, cymbals, bass amp, guitar amp, vocal), `live_jazz_quintet`
  (trumpet, sax, piano, bass, kick, snare, cymbals). Live tasks add PA
  (MAIN L/R, speakers in both PA zones) and monitor (MON 1/2) checks.
- Task ids are saved in student codes. Never rename or remove one.
  Old codes with no task id grade as the open task for their
  environment (`resolveTaskId`).

## Grading rubric (`evaluateStudioSetup`)
Instruments 20, signal chain 25, mic choice 25, phantom power 15,
stands/accessories 10, mixer routing 5; live stage adds PA 10 and
monitors 10. Percentage = earned ÷ possible (n/a categories skipped).
Letter bands: A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, F below. Grades are
always recomputed from the decoded plot, never read from the code.

## Code format (`src/services/submissionCodec.ts`)
Format is frozen: changing keys, defaults, or the hash breaks old codes.
- Student code = `LZString.compressToEncodedURIComponent(json)` + `.` +
  checksum (32-bit string hash of the JSON, base36). Not true base64;
  it's lz-string's URL-safe alphabet. Codes start with `N4Ig`, which
  the batch parser uses to find them in pasted Classroom text.
- The JSON is a packed `StudioProjectState`: short keys
  (`t` title, `s` studentName, `e` environment, `a` activeChallengeId,
  `z` stageSize, …), gear as `[gearId, x, y, extras?]` with instance
  ids replaced by list position, cables as `[from, to, x|q|s, extras?]`,
  mixer channels only when changed from defaults (`m`, count in `mc`),
  master bus diffs in `b`. Booleans are 1/0, positions 1 decimal.
- `CH_DEFAULTS`, `MASTER_DEFAULTS` and `CABLE_COLORS` in the codec must
  match `INITIAL_CHANNELS` / `DEFAULT_MASTER_BUS` in `App.tsx`; codes
  leave out values equal to defaults, so changing a default changes
  what old codes decode to.
- Share links (`?plot=`) use the same packed JSON without a checksum.
- Teacher batch grading: `src/services/batchGrading.ts` cleans pasted
  Classroom text (HTML, names, status words, broken lines), pulls out
  every code, decodes, and grades. `BatchGradeModal` + `BatchReviewBar`
  show results and step through each student's plot. CSV export.
- Adding fields: new optional fields are safe (unknown keys pass
  through). Never reuse a short key.

## Design
- Use percentages for grades, not stars.

## Status of earlier wants (checked in repo 2026-10-28)
- Learn modal: done (`LearnModal.tsx`).
- Sandbox default + assignable tasks: done (`?task=` links).
- Expandable canvas: done, room size Standard / Large / Extra Large
  (`stageGeometry.ts`, saved as `stageSize`).
- Field Guide removed: no references left in `src/`.
- Student names in codes: intended. The share modal puts the name in
  the code (`s` key) so batch grading can show who's who.

## Working style
Start from the teaching goal, then shape features around it. Suggest
ideas and angles before building. Ask before big changes.
