# TWRR Calculation — Design Spec
**Date:** 2026-04-06  
**Status:** Approved

## Overview

Add Time-Weighted Rate of Return (TWRR) to AlphaTrace for DCA and Hybrid investment modes. TWRR isolates market performance from the timing of contributions, giving a truer picture of investment manager performance.

## Context

AlphaTrace already computes `portRets[]` in `computeRecurringPortfolio` and `computeHybridPortfolio` as:

```
periodReturn = (valueAfterReturns - totalValueBefore) / totalValueBefore
```

Where `valueAfterReturns` is portfolio value after market returns but **before** the new monthly contribution is added. This means each `portRets[t]` is already a cash-flow-neutral sub-period return — exactly what TWRR needs. No changes to existing computation functions required.

The existing `cagrRecurring()` uses `(FinalValue / TotalInvested)^(1/years) - 1`, which is a money-weighted approximation that conflates contribution timing with market returns. TWRR is the correct complement.

## Scope

Only applies to **DCA** and **Hybrid** modes. For lump sum, TWRR = CAGR (no cash flows), so no display needed.

## Implementation

### 1. `twrr()` — `/src/lib/finance.ts`

Geometrically links sub-period returns and annualizes:

```ts
export function twrr(portRets: number[], years: number): number {
    if (portRets.length === 0 || years <= 0) return 0;
    const cumulative = portRets.reduce((acc, r) => acc * (1 + r), 1) - 1;
    return Math.pow(1 + cumulative, 1 / years) - 1;
}
```

### 2. `rollingTWRR()` — `/src/lib/finance.ts`

Rolling N-year annualized TWRR from period returns:

```ts
export function rollingTWRR(dates: string[], portRets: number[], years: number): { date: string; value: number }[] {
    const w = years * 12;
    const out = [];
    for (let i = w; i < portRets.length; i++) {
        const windowRets = portRets.slice(i - w, i);
        const cum = windowRets.reduce((acc, r) => acc * (1 + r), 1) - 1;
        out.push({ date: dates[i], value: Math.pow(1 + cum, 1 / years) - 1 });
    }
    return out;
}
```

### 3. Metrics Card — `/src/components/dashboard/metrics-cards.tsx`

- Add TWRR card alongside existing CAGR card
- Visible only when mode is DCA or Hybrid
- Format as percentage, same style as other return metrics
- Tooltip: "Time-Weighted Rate of Return — measures market performance independent of contribution timing"

### 4. Rolling Returns Chart

- Add rolling 10-year TWRR series to the existing rolling returns chart
- Visible only when mode is DCA or Hybrid
- Uses `rollingTWRR(dates, portRets, 10)`

## Files Changed

| File | Change |
|------|--------|
| `src/lib/finance.ts` | Add `twrr()` and `rollingTWRR()` |
| `src/components/dashboard/metrics-cards.tsx` | Add TWRR metric card (DCA/Hybrid only) |
| Rolling returns chart component | Add TWRR series (DCA/Hybrid only) |

## Non-Goals

- No TWRR for lump sum mode
- No changes to existing CAGR calculations
- No new data structures or computation pipeline changes
