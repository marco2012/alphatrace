# Performance Analysis Simplification — Design Spec

**Date:** 2026-05-10  
**Status:** Approved

## Problem

The Performance Analysis section has two UX issues:

1. **Information overload** — 4 separate dense tables with 20+ metrics total make it hard to get a quick read on any strategy.
2. **Weak Best Portfolio card** — raw metric badges ("Sharpe 1.23") don't explain *why* a portfolio won; users have to mentally connect the dots.

## Goals

- Reduce cognitive load for first-time readers without losing data access for power users.
- Make the best-portfolio verdict legible as a plain sentence.
- Optimize for mobile (primary constraint): meaningful data visible without horizontal scroll on small screens.

## Non-Goals

- Removing any existing metric permanently — all current data stays accessible.
- Redesigning charts or non-table sections.

## Design

### 1. Best Overall Portfolio Card

**Change:** Replace the 3 raw metric badges with a two-sentence narrative generated at render time.

**Narrative template:**
> **[Portfolio Name]** is the top-scoring strategy across 5 dimensions.  
> It leads on **[strongest dimension label]** ([formatted value]) and stands out for **[second dimension]** ([value]), while keeping **[third dimension]** at [value].

- Dimension labels (human-readable): "risk-adjusted return", "real purchasing power", "rolling consistency", "drawdown protection", "loss protection"
- Values: formatted metric strings already computed in `metricsTableRows` (e.g. `winner.sharpe10Y`, `winner.maxDD`)
- The top 3 strongest scoring dimensions (already sorted by score in the existing `dims` array) become the three narrative slots
- The existing footnote ("Scored across…") stays, placed below the narrative
- The color dot + portfolio name header row is unchanged

**No new data or scoring logic required** — narrative is assembled from existing `dims` array and `winner` row.

### 2. Unified Performance Table

**Change:** Replace the 4 separate metric cards with a single card containing one table.

#### Columns (default view)

| Column | Mobile (< sm) | Tablet (sm) | Desktop (md+) |
|---|---|---|---|
| Strategy | ✓ sticky | ✓ sticky | ✓ sticky |
| Final Value | hidden | ✓ | ✓ |
| Real TWR | ✓ | ✓ | ✓ |
| Sharpe | hidden | ✓ | ✓ |
| Max DD | ✓ | ✓ | ✓ |
| Vol | hidden | hidden | ✓ |
| P(Loss 10Y) | hidden | hidden | ✓ |

Mobile shows Strategy + Real TWR + Max DD — the two metrics that most directly answer "is this worth it?" and "how bad could it get?".

#### Card header controls

- **Title:** "Performance Summary"
- **"10Y Rolling" switch** — moved here from the old Returns & Growth card. Toggles TWR/Real TWR columns between full-period and 10Y rolling median values (same logic as today).
- **"Show all metrics" button** — toggles visibility of the expanded section below the table.

#### Expanded section ("Show all metrics")

When toggled open, the original 4 cards appear beneath the summary table, unchanged:
- Returns & Growth
- Risk & Consistency
- Drawdown & Recovery
- Investor Outcome

These are hidden by default (`useState(false)`). The toggle button label switches between "Show all metrics" and "Hide details".

#### Sorting

All 6 columns remain sortable (click header), same behavior as today. Sort state is shared with the expanded section tables so rankings stay consistent.

#### Color coding

Carry over from existing implementation:
- Max DD: amber/orange/red by severity
- Sharpe: green ≥ 1, neutral ≥ 0.5, red below
- P(Loss 10Y): green < 2%, amber < 10%, red ≥ 10%

## Files to Change

- `src/components/dashboard/analysis-section.tsx` — all changes are within this file:
  1. Replace Best Portfolio card JSX (~lines 1864–1890) with narrative version
  2. Replace the 4 metric card blocks (~lines 1893–2300+) with the unified table card + expanded section toggle

## Out of Scope

- `finance.ts`, `portfolio-context.tsx`, other components — no changes needed
