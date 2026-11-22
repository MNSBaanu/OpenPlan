# How OpenPlan calculates dates

OpenPlan schedules with the **critical path method**: it works out the earliest every task can happen, then works backwards to find the latest dates that still meet the finish. The difference is each task's slack, and the tasks with none are the critical path.

## Working days first

Dates are counted in **working days**, not calendar days. The project's calendar comes from Project settings:

- **Working week** — which weekdays count (Monday–Friday by default).
- **Hours per day** — used for work and cost, not for dates; a "3d" task takes three working days however long the day is.
- **Holidays** — single dates nobody works, counted as non-working days.

So a 6-day task starting on a Friday finishes a week later on Friday: one day worked, the weekend skipped, then five more.

## Links and lag

A task's **Predecessors** cell holds links like `3`, `3SS+2d`, `5FF-1`. The type says which dates line up:

| Link | Meaning |
|---|---|
| **FS** | Finish → Start: the successor starts when the predecessor finishes (the default; `3` means `3FS`). |
| **SS** | Start → Start: they start together (or after lag). |
| **FF** | Finish → Finish: they finish together (or after lag). |
| **SF** | Start → Finish: the successor finishes when the predecessor starts — rare. |

**Lag** waits extra working days: `3FS+2d` starts two working days after task 3 finishes. Negative lag overlaps tasks.

## Forward pass: earliest dates

Starting from the project start date, each task is placed as early as its links allow — its **earliest start**. Add its duration in working days to get the **earliest finish**. A task with several predecessors starts only after all of them allow it.

## Backward pass: latest dates

From the project's earliest finish, OpenPlan walks the links in reverse to find each task's **latest start** and **latest finish** — the dates it must hit to keep the project on time.

## Slack and the critical path

**Total slack** is how far a task can slip before the project finish moves — latest minus earliest. Tasks with **zero slack are critical** (shown in red): delaying any of them delays the whole project. **Free slack** is how far a task can slip before it pushes only its own successor, not the project.

## Constraints

A constraint pins a date: **Start no earlier than** (e.g. "the site opens 1 June") or **Start/Finish no later than**, **Must start/finish on**, and **As late as possible**. They only ever move a task, never the calendar around it — so a constraint that fights the links is flagged as a conflict instead of silently dropping a link.

## A worked example

Project start **Monday 2 March 2026**, working Monday–Friday, no holidays:

| # | Task | Duration | Depends on | Start | Finish | Slack | Critical |
|---|------|---------:|------------|-------|--------|------:|:--------:|
| 1 | Design | 3d | — | Mon 2 Mar | Wed 4 Mar | 0 | ✓ |
| 2 | Build | 5d | 1 | Thu 5 Mar | Wed 11 Mar | 0 | ✓ |
| 3 | Test | 2d | 2 | Thu 12 Mar | Fri 13 Mar | 0 | ✓ |
| 4 | Document | 2d | 1 | Thu 5 Mar | Fri 6 Mar | 5 | |
| 5 | Launch (milestone) | 0d | 3, 4 | Fri 13 Mar | Fri 13 Mar | 0 | ✓ |

Build and Test each wait for their FS link — Build's Thursday start crosses the weekend to finish Wednesday. Document also starts Thursday after Design, but it only needs to be done before Launch on Friday 13th, so it carries **5 working days of slack**. Slip Document more than that and Launch moves; Design, Build and Test are the critical path — slip any of them by a day and the project finishes a day later.
