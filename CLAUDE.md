# AudioPlot

## Purpose
A studio and stage plot designer and signal flow simulator. Students
learn how audio gear connects and how signal moves through a studio
or stage setup, by building plots themselves. Drills are the means;
the goal is students designing real setups with understanding.

## Hard rules
- Never store student data of any kind, not even names. No backend.
- Students show work with a base64 code pasted into Google Classroom.
- Must run well on Chromebooks and stay lightweight.
- Repo: github.com/mr-comiskey-music-ed/AudioPlot. Deployed on Vercel
  at its own mrcomiskey.com subdomain. Work on a branch and don't
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

## Design
- Use percentages for grades, not stars.

## Wanted, not confirmed done (check the repo first)
- Learn modal
- Ungraded sandbox as the default, with teacher-assignable tasks
- Expandable canvas
- Removing the Field Guide

## Working style
Start from the teaching goal, then shape features around it. Suggest
ideas and angles before building. Ask before big changes.
