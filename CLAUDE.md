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
- The only thing kept in the browser is an autosave of the student's
  own plot (localStorage keys `audioplot:v1:autosave:<task or sandbox>`,
  `src/utils/autosave.ts`), stored in the code format and never with the
  student's name. It is never sent anywhere. On load, a "Restore your
  last session?" prompt offers Restore or Start Fresh; autosave stays
  off until they answer. Not used for shared-plot (`?plot=`) links or
  while the teacher steps through batch review or while in Learn. The
  leave-page warning appears only if the browser can't save.
- Every task and the sandbox keep their own saved plot: the plot on screen
  is saved under the ACTIVE task's slot, switching tasks saves first and
  then restores the target's saved plot (finished tasks come back exactly
  as left, with no second celebration), and the sandbox always returns its
  own plot or an empty one. `audioplot:v1:done` records tasks that reached
  90% (ids and percentages only). The Tasks window shows Completed /
  Continue / Start over; the finish window offers Start New Task (opens
  that same Tasks window), Open Sandbox, and Share & Submit.
- The PDF stage plot (`pdfExportService.ts`) draws the XLR runs the same way
  as the screen (inputs on a trunk under the snake, outputs along the walls).
  Share & Submit has "Include on the stage plot" checkboxes (Cables, Snake,
  Mics; Snake off also drops the input list). On the plot, mics use generic
  names (LDC, SDC, Kick Drum Mic, Tom Mic); the SM58/SM57 keep theirs.
- Share & Submit has "Restore progress from a code": paste the last
  code and it replaces the plot (asks first if the plot has work). For a
  different computer or a cleared browser. It reads the code with the
  same forgiving parser as batch grading.
- Learn progress is also kept in the browser (`audioplot:v1:learn`,
  `src/utils/learnProgress.ts`): furthest step, Think First picks, and
  whether Learn is done. No name.
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
- Learn: a guided, hands-on build (see the Learn section). The older
  Four Questions modal (`LearnModal.tsx`) stays as a quick reference,
  opened from the Learn panel and the grading panel.
- The studio/stage canvas needs a way to expand for more
  instruments/gear. Not a zoom-in.

## Grading
- This app is where the code compression and the teacher batch grade
  report were first built; SynthLab and MixerLab follow its approach.
  Keep the code format stable. Old student codes should keep working.
- Teacher side: paste a whole class's codes, see grading results, and
  pull up each student's work one at a time. The Teacher Code Check box
  in Share & Submit takes one code or many and always opens the batch
  view; there is no separate single-code check.

## Signal flow simulation
Signal path: source → mic/DI/amp → snake input → mixer channel →
master bus → snake outputs (MAIN L/R, MON 1/2) → PA / monitors.
- Mics capture a source acoustically, not by cable. A mic is tied to a
  source by `latchedSourceInstanceId` (an instance id, `'room'`, or
  `'drummer'`), or failing that by distance (within ~140px of an
  instrument or amp).
- Cables are `xlr`, `quarter_inch`, `speaker` or `breakout` (Laptop / Phone only). Each cable is checked
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
  plays a synced 4-bar (~10.67 s) MP3 stem per instrument (`public/audio/`)
  only on channels that pass that check, then applies gain, fader,
  pan, mute/solo, and master trim/fader/dim/mono, with a limiter.
  Channels with fader ≤ 5 or muted are silent. Students hear their
  mistakes.
- Loop levels: every loop is measured at load (LUFS, `loudness.ts`) and
  brought to the same perceived loudness, so a NEW loop dropped into
  `public/audio/` balances itself. `STEM_MIX_OFFSET_DB` in the engine holds
  the few judgment calls (kick and basses up for laptop speakers, sax
  down); adjust there. Loops that would clip are never boosted.
- Faders: ONE law in `src/utils/faderLaw.ts` (75 = 0 dB, top +6, straight
  line down to -48 dB, bottom off). The label, the audio, the scope and
  the meters all use it, so "-15 dB" on the label is -15 dB in the audio.
  Channel meters read the real post-fader level (-48 to 0 dBFS).
- The Master mix spectrum has Hz gridlines and labels (log scale, 40 Hz
  to 16 kHz).
- XLR cable drawing (`src/components/canvas/cableRouting.ts`): all XLR
  runs are laid out together. Inputs rise straight from their gear to a
  shared trunk just downstage of the snake and ride it in a tight bundle
  (lanes ordered so bundled runs don't cross; out-of-order patching
  still crosses near the snake, which is realistic). Outputs leave the
  side of the snake: MAIN L down the left wall, MAIN R the right, MON
  runs down the nearer wall and along the downstage edge to wedges.
  Cables are clipped at the snake box edge (they plug in from outside,
  nothing runs under it) and the shared trunk sits just in front of it.
  The snake box size and socket positions in `canvasMath.ts` are MEASURED
  from the drawn box (live 500x175, studio 336x165): if `SnakeBox.tsx`
  changes size or padding, measure them again or cables will aim wrong.
  Gaff tape (`GaffTape.tsx`: black like venues use, set `TAPE_TONE` to
  'white' for white; nearly straight tears) goes across bundles and
  never covers an unpatch ✕. Tape sits at fixed spots along the stage
  (every 170 units), so moving one mic doesn't shift tape elsewhere;
  1/4" cables are never taped (they hang loose). The ✕ shows only on
  hover or while that cable's gear is selected. Input ✕s sit on each
  cable's drop a short way out from the snake, sliding until they are
  clear of every piece of gear and of each other (`cableRouting.ts`).
  1/4" runs keep their
  drooping curve.
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
- Instruments (and amps) a challenge gives can't be deleted or swapped
  out on the canvas, and the grader's Instruments category checks they
  are all still there (`givenInstrumentCounts` /
  `lockedGivenInstruments`). Before this, deleting them scored 100%.
- Task ids are saved in student codes. Never rename or remove one.
  Old codes with no task id grade as the open task for their
  environment (`resolveTaskId`).

## Grading rubric (`evaluateStudioSetup`)
Instruments 20, signal chain 25, mic choice 25, phantom power 15,
stands/accessories 10, mixer routing 5; live stage adds PA 10 and
monitors 10. Percentage = earned ÷ possible (n/a categories skipped).
Letter bands: A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, F below. Grades are
always recomputed from the decoded plot, never read from the code.
Signal chain = 20 for instrument chains + 5 for XLR. The 20 is 5 per
working chain for up to 4 instruments; a setup with fewer than 4 splits
the 20 among its instruments (2 instruments = 10 each), so small
challenges can reach 100%. Setups of 4+ score as before.

## Learn (`src/data/learnSteps.ts`, `src/components/LearnPanel.tsx`)
- One module, 11 steps, four separate players: a singer and an acoustic
  guitarist record in the studio (steps 1-6), then play a gig joined by
  an electric guitarist and a drummer (live, steps 7-11; only the kick
  is mic'd, to keep it short). Steps: source, pick the mic, cable +
  phantom, acoustic guitar DI *and* mic, stands + pop filter,
  headphones; live condenser → SM58, guitar → amp → SM57, kick Beta 52A,
  PA on MAIN L/R, wedge on MON 1/2 (wedge sharing, daisy chains and
  IEMs are mentioned, not required).
- Each step has missions checked live on the real canvas (reusing
  `validateChannelSignalChain` and the grader's category scores), so
  Learn can't disagree with grading. No points or percentages appear in
  Learn; finishing the steps is what counts.
- "Think First" (a why question, explain-and-continue on a wrong pick)
  only where the reason is the lesson: steps 2, 3, 4, 7, 8, 9.
- Learn runs on its own plot. The student's plot is set aside and
  restored on Exit; autosave is paused. Learn's instruments can't be
  deleted. Each step's `solve` (the step done right) rebuilds the start
  of any step, so students can resume or jump back.
- Finishing sets `learnDone`, which goes in the code (`ld`) and shows as
  "Learn done" in batch grading and the CSV.

## Quiz Mode (`src/quiz/`, hidden link `/quiz`)
- Nothing in the app links to it. `/quiz` draws a random gig; `/quiz?t=<id>` picks a named
  one (`QUIZ_TEMPLATES`: coffeehouse, rock, worship, jazz, school-dance). No source is a
  featured pairing. Never
  rename a template id or change the draw order: codes rebuild the gig from the seed.
- Source names in the prompt come from the equipment locker (`SOURCE_LABELS` reads the
  gear catalog: Voice, Keyboard, Acoustic Piano, Hi-Hats...), so they match what students drag in.
- Random gigs are versioned (`QUIZ_VERSION`, saved in the code as `v`); never change a version's
  draw, so old codes rebuild the same gig. v1 = first draw. v2 = Voice in at least 75% (about 88%).
  v3 (current) = the DJ Rig is out of the quiz (non-standard), and a Laptop / Phone playing backing
  tracks joins about 1 gig in 4 (connected only by Stereo Breakout into a Stereo DI or two mono DIs).
  v1/v2 codes with a DJ Rig still grade; their gigs read "A band and a DJ" or "DJ set with live players".
- `school-dance` is Laptop / Phone + kit from v3 on (it was DJ Rig + kit before; `before3`).
- Live stage only. Three parts: Plan it (build from scratch), Fix it (the same band set up
  by "someone else" with 3-4 seeded faults), Explain it (two written answers). Weights
  50 / 30 / 20; Part 3 is scored by the teacher in the batch view.
- No coaching while it runs (`QuietChecksContext`): no "!" badges, no mixer chain warnings,
  no signal-path HUD, and refused cables say only "That connection isn't possible."
- Part 1 checklist per source (`evaluatePlan`): right input (mic / DI / direct), cabled to
  the snake, 48V only where needed, stereo on two channels (DJ Rig, Laptop / Phone; keys on one channel
  are fine), own channel with no doubles, plus no extra/dead channels, PA speakers on MAIN
  L/R and stage monitors on MON 1/2 (submitting without either gets a reminder first).
  Students see the % and Pass / Partly / Missed (green / yellow / red) per source, no reasons.
- After each part's submit: "Take another pass (half credit for fixes)" or "Show me what I
  missed". First try counts in full, anything fixed on the second pass earns half
  (`combineAttempts`); either way they then see what they missed in plain words. Second
  attempts ride in the code as `p1r` / `p2r`. "Piano" accepts an acoustic piano with mics or a
  keyboard into a DI. The kit is kick + snare + hi-hat (3 sources).
- Part 2 faults (`buildFixScenario`): mostly on the plot (unpatched, wrong mic, no mic, mic
  on an electric instrument, missing DI, DJ Rig half connected, instrument cable unplugged,
  a PA speaker or the monitor unplugged); the mixer gets one fault, or two of four, never the
  majority (`MIXER_FAULTS`: muted, soloed, gain zero, fader down, 48V off, panned hard, main
  down, DJ gain too high). One per source. Score = faults fixed + "left everything else
  working". Part 2 has a Line check: students tick each source once they hear it on its own
  channel (their own tick, not graded; unticked ones get a reminder at submit; kept as `lc`).
- The code records when Part 1 started (`st`) and when the quiz was finished (`fn`). The batch
  view and CSV show both and the minutes taken, to help spot retakes in another window
  (there is no way to block them without logins). Random `/quiz` gives a retake a new gig.
- Kept in the browser as `audioplot:v1:quiz` (seed, part, frozen plots, answers; never the
  name). The code's main plot is Part 1; `qz` holds the record with Part 2 packed inside.
- Batch view: quiz codes show Part 1 · Part 2 %, a Part 3 box (in the tab only, goes into
  the CSV), a class summary of the most-missed checks and faults, and a review panel with
  the regenerated gig and a Part 1 / Part 2 plot switch (`QuizReviewPanel.tsx`).

## Live soundcheck needs somewhere to hear it
On the live stage, soundcheck is silent until a PA speaker is cabled to MAIN L/R or a wedge /
IEM transmitter to MON 1/2 (`hasLiveOutputs`). The mixer still runs (meters move); the audio
engine's output gate is closed and a notice explains why. Learn is exempt (its PA comes later).

## DJ Rig, Stereo DI, Stereo Breakout
- `inst_dj_rig`: laptop + controller, one stereo line-level source. Its XLR outs go straight
  to two snake inputs (L/R), or its 1/4" booth outs go into a Stereo DI or two mono DIs (no
  breakout: that's not how a DJ controller is hooked up); first patch sets gain to 54 since line level is ~12 dB hot
  (`LINE_LEVEL_BOOST` in the audio engine). Its sound is built in the browser from the
  kick, snare, bass and keys loops (`DERIVED_STEMS`), so no extra download.
- `gear_di_stereo`: shows in the locker once keys, a DJ Rig, a Laptop / Phone or a Stereo DI is on the plot. Stereo gear
  (`isStereoGearId`) can hold two mixer channels; the lower is labelled L, the higher R.
  Its badge on the plot shows both ("CH 3 & 4"). A stereo source only counts as wired when
  both sides reach the snake on their own XLR runs (Stereo DI: both outputs; DJ Rig / Laptop:
  two channels in total). Keys on one mono DI stay fine.
- `inst_computer` (Laptop / Phone): only a 1/8" headphone out, so it works ONLY through the
  Stereo Breakout into a Stereo DI or into two mono DIs (one leg each). Plays a backing
  track built from the piano, bass and acoustic guitar loops. In the quiz pool (v3) at 25%.
- Cable type `breakout` (code letter `b`): Stereo Breakout, 1/8" TRS to two 1/4". Appears
  under the 1/4" hook only while a Laptop / Phone is on the plot; it only goes from that into
  DI(s) (the snake takes XLR). Two ends: one Stereo DI takes both, or two
  mono DIs take one each (labelled L/R in cabling order); a third leg is refused. `isDiBoxId` treats the mono and stereo DI alike in every check.

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
- `ld` = learnDone (added Nov 2026; older codes don't have it).
- `qz` = Quiz Mode record; cable letter `b` = Stereo Breakout (both Nov 2026).
- Adding fields: new optional fields are safe (unknown keys pass
  through). Never reuse a short key.

## Design
- Use percentages for grades, not stars.

## Status of earlier wants (checked in repo 2026-10-28)
- Learn: guided build done (Nov 2026); Four Questions modal kept as reference.
- Sandbox default + assignable tasks: done (`?task=` links).
- Expandable canvas: done, room size Standard / Large / Extra Large
  (`stageGeometry.ts`, saved as `stageSize`).
- Field Guide removed: no references left in `src/`.
- Student names in codes: intended. The share modal puts the name in
  the code (`s` key) so batch grading can show who's who.

## Ideas for later
- Rider / input list challenge: students get a band's real-style input
  list ("CH 1 Kick – Beta 52 …") and build the stage to match, or build
  a plot and write its input list. Wanted, not now.
- Other real-world ideas floated: an 8-input budget (more sources than
  inputs, students choose), and "engineer's notes" after soundcheck
  (fix things that work but are wrong for the gig).

## Working style
Start from the teaching goal, then shape features around it. Suggest
ideas and angles before building. Ask before big changes.
