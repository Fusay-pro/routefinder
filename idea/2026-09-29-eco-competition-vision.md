# Campus Eco-Commute Competition — Vision

Date: 2026-09-29

Supersedes [`2026-09-10-routefinder-design.md`](./2026-09-10-routefinder-design.md) as the statement of
*what we are building*. That document remains accurate about *how the machinery works* — routing, the
graph, trip verification — and is still the reference for all of it.

## Problem

Most short trips across campus are made by motorcycle or car when they didn't need to be. The distances
are walkable or cyclable; the habit isn't. Nothing about choosing to walk is visible to anyone else, so
there's no reason to keep choosing it after the novelty wears off.

v1 tried to fix this with points. Points worked — they're awarded, verified against a GPS trace, and
spendable — but they're *solo and invisible*. A student earns 340 points, sees 340 points, and has no
idea whether that's a lot. Nobody has ever been made to walk further by a number only they can see.

Competition is the part that was missing. Strava proved this for running, but Strava is a sport app: it
records workouts, and a workout is a lap that ends where it started. That shape is wrong here. We don't
want people jogging circles for a score — we want the trip to class that would otherwise have been a
motorcycle ride. **The trip has to go somewhere.**

## What the product is

A campus commute competition. You pick where you're going, you walk, run or cycle there, the app
verifies you actually did, and it counts toward your rank.

Two things are ranked, and they are deliberately different questions:

| board | measures | why it exists |
|---|---|---|
| **Distance** | kilometres actually travelled | effort; the honest "who moved the most" |
| **CO2 avoided** | grams of car emissions not emitted | the point of the whole thing |

Each board is split by activity — **on foot** (walking and running) and **cycling** — because a
cyclist's 10km and a walker's 10km are not the same achievement and shouldn't share a column.

Each board is ranked at two levels:

- **Individual** — you against everyone else at the university.
- **Faculty** — Engineering against Law against Medicine, and so on.

The faculty board is the one we expect to actually drive behaviour. An individual leaderboard motivates
the fifty people near the top; a faculty leaderboard gives everyone else a reason to care about their
own contribution, because they're carrying a side.

A note on fairness that the implementation has to respect: **the faculty board is ranked on the average
per active member, not the total.** Ranked on totals, the largest faculty wins permanently and the
board is dead by week two.

## How a trip counts

A trip scores only if all of this holds:

1. It has a **destination**, and the destination is a real distance away. No loops, no laps, no
   pacing back and forth. This is the rule the whole design hangs on.
2. It **stays inside the university zone** — both ends on campus. This is a campus competition; a
   weekend hike elsewhere is someone else's app.
3. The **GPS trace follows the route we suggested** (≥80% of fixes within 25m of it). This already
   exists, and it is what makes looping worthless: a lap doesn't follow a path from A to B.
4. The **average speed is plausible** for the claimed activity, and the trace isn't machine-smooth
   (the signature of a spoofing tool).
5. It's within the **daily limits** — a capped number of scoring trips and a capped scoring distance
   per day.

Rules 3–5 are already built and tested. Rules 1–2 are the additions this pivot needs.

Traces that look spoofed are flagged for human review rather than auto-rejected. That mattered less
when points were private; it matters a lot now that a flagged trip could be someone's faculty beating
another one.

## Scope

**In:**

- Running as a first-class activity alongside walking and cycling.
- Distance and CO2-avoided boards, split by activity, ranked individually and by faculty, over
  week / month / all-time windows.
- Faculty membership: users choose theirs when signing up and request a change afterwards, which an
  admin approves. Self-service reassignment is not offered — otherwise the boards are decided by
  whoever is willing to lie.
- Real travelled distance recorded per trip. v1 computed it and threw it away, keeping only the
  *planned* route distance; a distance board built on that would rank people on routes they asked for
  rather than distance they covered.
- Google Maps as the map and the destination picker.

**Out:**

- **Segments.** Strava's per-segment leaderboards were considered and rejected: a segment is a fixed
  stretch you repeat for a better time, which is exactly the looping behaviour we're designing out.
- **Free-form "hit record and go" activities**, for the same reason.
- Following, friends, kudos, comments, clubs. The faculty is the social unit for now.
- Multiple universities. The zone is one campus. The schema shouldn't make this impossible later, but
  nothing is being built for it now.

## What this replaces

v1 shipped more than routing, and this pivot retires most of it from the product story:

- **Campus wayfinding as the product** — routing is now infrastructure, not the pitch. It still runs on
  our own OSM graph (better pedestrian coverage on campus than Google, and its path is what trip
  verification compares a GPS trace against), but nobody is being sold a better campus map.
- **Parking availability** — **deleted.** Tables, endpoints, repositories, seed data and UI are all
  gone. It was always blocked on sensor hardware nobody has procured, and it has nothing to do with
  competing. It remains in git history if it is ever wanted back.
- **Weather** — **deleted**, same treatment.
- **Points and the redemption catalog** — kept, but as a *second version*. The boards are distance
  and CO2; points keep accruing quietly behind the profile screen and the catalogue still works, but
  nothing in the first version's pitch depends on them. Note that a points balance is a *wallet* that
  redemptions draw down, so it could never have served as a score anyway.

Nothing that the competition needs was deleted. What went is what the competition never used.

## Naming

"RouteFinder" describes the v1 product and not this one. Worth choosing a new name before anyone
outside the team sees it. Nothing below the name depends on the decision.
