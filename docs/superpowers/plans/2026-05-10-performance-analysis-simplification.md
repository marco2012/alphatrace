# Performance Analysis Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 4 dense metric tables with a single 6-column summary table (mobile-optimized), add a "Show all metrics" toggle to reveal full detail, and rewrite the Best Overall Portfolio card as a plain-English narrative.

**Architecture:** All changes are confined to `src/components/dashboard/analysis-section.tsx`. No new files, no new data logic. The existing `metricsTableRows` array already contains all required fields. The 4 existing detail cards are kept intact but hidden behind a toggle.

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS, shadcn/ui

---

## File Map

| File | Changes |
|---|---|
| `src/components/dashboard/analysis-section.tsx` | (1) Add `showAllMetrics` state. (2) Replace Best Portfolio badges with narrative. (3) Insert unified summary table card. (4) Wrap 4 existing detail cards in toggle. (5) Move 10Y Rolling switch to summary card header. |

---

## Task 1: Add `showAllMetrics` state + replace Best Portfolio narrative

**Files:**
- Modify: `src/components/dashboard/analysis-section.tsx`

### Context

The `useState` declarations are around line 225. The Best Portfolio card JSX is around lines 1864–1890. The `dims` array (top 3 scoring dimensions, sorted descending by score) is already computed just above the `return` statement in the scorecard IIFE.

### Steps

- [ ] **Step 1: Add `showAllMetrics` state**

Find this block (around line 229):
```tsx
const [showRollingMetrics, setShowRollingMetrics] = useState(true);
```

Add one line immediately after it:
```tsx
const [showAllMetrics, setShowAllMetrics] = useState(false);
```

- [ ] **Step 2: Replace the Best Portfolio card JSX**

Find the entire `return (...)` block inside the Best Portfolio scorecard IIFE (the block starting with `<div className="rounded-xl border bg-emerald-50..."`). It currently ends with the `</div>` before `);` at around line 1890.

Replace it with:
```tsx
const [d1, d2, d3] = dims;
const narrative = `It leads on ${d1.label} (${d1.value}) and stands out for ${d2.label} (${d2.value}), while keeping ${d3.label} at ${d3.value}.`;

return (
    <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 p-4 sm:p-5">
        <div className="flex items-center gap-3 min-w-0 mb-2">
            <div
                className="w-3 h-3 rounded-full shrink-0 ring-2 ring-emerald-400"
                style={{ backgroundColor: item?.color ?? "#10b981" }}
            />
            <div className="min-w-0">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Best Overall Portfolio</p>
                <p className="text-base font-bold text-emerald-900 dark:text-emerald-100 truncate">
                    {winner.name} is the top-scoring strategy across 5 dimensions.
                </p>
            </div>
        </div>
        <p className="text-sm text-emerald-800 dark:text-emerald-200 leading-relaxed">{narrative}</p>
        <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-2">
            Scored across risk-adjusted return, real return, consistency, drawdown, and loss probability. {rows.length} strategies compared.
        </p>
    </div>
);
```

- [ ] **Step 3: Verify the build compiles**

```bash
pnpm build 2>&1 | tail -20
```

Expected: no TypeScript errors. Warnings about bundle size are fine.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/analysis-section.tsx
git commit -m "feat: replace best portfolio badges with plain-English narrative"
```

---

## Task 2: Add unified Performance Summary table card

**Files:**
- Modify: `src/components/dashboard/analysis-section.tsx`

### Context

The unified table card goes **between** the Best Portfolio scorecard block and the Returns & Growth card (currently around line 1893). It uses the existing `metricsTableRows`, `slicedItems`, `makeKey`, `handleSort`, `sortConfig`, `currency`, `showRollingMetrics`, and `setShowRollingMetrics` — all already in scope.

### Responsive column visibility

| Column | Mobile `<sm` | Tablet `sm` | Desktop `md+` |
|---|---|---|---|
| Strategy | ✓ (sticky) | ✓ (sticky) | ✓ (sticky) |
| Final Value | hidden | ✓ | ✓ |
| Real TWR | ✓ | ✓ | ✓ |
| Sharpe | hidden | ✓ | ✓ |
| Max DD | ✓ | ✓ | ✓ |
| Vol | hidden | hidden | ✓ |
| P(Loss 10Y) | hidden | hidden | ✓ |

### Steps

- [ ] **Step 1: Insert the summary card**

Find the comment `{/* ── Returns & Growth ──` (around line 1893). Insert the following block **immediately before** that comment:

```tsx
{/* ── Performance Summary ─────────────────────────── */}
{validItems.length > 0 && (
    <Card key={`metrics-summary-${calcKey}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 flex-wrap gap-2">
            <div>
                <CardTitle className="text-base">Performance Summary</CardTitle>
                <CardDescription className="text-xs">Key metrics — Real TWR, Sharpe, Max DD, Vol, P(Loss 10Y)</CardDescription>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Switch id="rolling-mode-summary" checked={showRollingMetrics} onCheckedChange={setShowRollingMetrics} />
                    <Label htmlFor="rolling-mode-summary" className="text-xs">10Y Rolling</Label>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground h-7 px-2"
                    onClick={() => setShowAllMetrics(prev => !prev)}
                >
                    {showAllMetrics ? "Hide details" : "Show all metrics"}
                </Button>
            </div>
        </CardHeader>
        <CardContent className="p-0 pt-0">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-muted/30">
                            <th className="text-left py-2 px-3 sm:px-4 font-medium text-muted-foreground sticky left-0 bg-muted/30 min-w-[120px] sm:min-w-[160px]">Strategy</th>
                            <th className="text-right py-2 px-3 font-medium text-muted-foreground whitespace-nowrap hidden sm:table-cell">Final Value</th>
                            <th
                                className="text-right py-2 px-3 font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap cursor-pointer hover:text-emerald-900"
                                onClick={() => handleSort(showRollingMetrics ? "medianRollingReal10YTWRValue" : "realCAGRValue")}
                            >
                                Real TWR{" "}
                                {sortConfig?.key === (showRollingMetrics ? "medianRollingReal10YTWRValue" : "realCAGRValue") && (sortConfig.direction === "asc" ? "↑" : "↓")}
                            </th>
                            <th
                                className="text-right py-2 px-3 font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground hidden sm:table-cell"
                                onClick={() => handleSort(showRollingMetrics ? "sharpe10YValue" : "sharpeValue")}
                            >
                                Sharpe{" "}
                                {sortConfig?.key === (showRollingMetrics ? "sharpe10YValue" : "sharpeValue") && (sortConfig.direction === "asc" ? "↑" : "↓")}
                            </th>
                            <th
                                className="text-right py-2 px-3 font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground"
                                onClick={() => handleSort("maxDDValue")}
                            >
                                Max DD{" "}
                                {sortConfig?.key === "maxDDValue" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                            </th>
                            <th
                                className="text-right py-2 px-3 font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground hidden md:table-cell"
                                onClick={() => handleSort("volValue")}
                            >
                                Vol{" "}
                                {sortConfig?.key === "volValue" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                            </th>
                            <th
                                className="text-right py-2 px-3 font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground hidden md:table-cell"
                                onClick={() => handleSort("probLoss10YValue")}
                            >
                                P(Loss 10Y){" "}
                                {sortConfig?.key === "probLoss10YValue" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {metricsTableRows.map(row => (
                            <tr key={row.key} className="border-b border-muted/40 last:border-0 hover:bg-muted/20 transition-colors">
                                <td className="py-2.5 px-3 sm:px-4 font-medium sticky left-0 bg-background">
                                    <div className="flex items-center gap-2 min-w-0">
                                        {(() => {
                                            const item = slicedItems.find(si => makeKey(si) === row.key);
                                            return item ? <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} /> : null;
                                        })()}
                                        <span className="truncate text-xs sm:text-sm">{row.name}</span>
                                    </div>
                                </td>
                                <td className="text-right py-2.5 px-3 font-medium text-xs hidden sm:table-cell">
                                    {(currency === "USD" ? "$" : "€") + row.finalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </td>
                                <td className="text-right py-2.5 px-3 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                                    {showRollingMetrics ? row.medianRollingReal10YTWR : row.realCAGR}
                                </td>
                                <td className={`text-right py-2.5 px-3 text-xs font-medium hidden sm:table-cell ${
                                    (showRollingMetrics ? row.sharpe10YValue : row.sharpeValue) >= 1
                                        ? "text-emerald-600"
                                        : (showRollingMetrics ? row.sharpe10YValue : row.sharpeValue) >= 0.5
                                            ? "text-foreground"
                                            : "text-red-500"
                                }`}>
                                    {showRollingMetrics ? row.sharpe10Y : row.sharpe}
                                </td>
                                <td className={`text-right py-2.5 px-3 text-xs font-medium ${
                                    Math.abs(row.maxDDValue) < 0.15
                                        ? "text-amber-500"
                                        : Math.abs(row.maxDDValue) < 0.3
                                            ? "text-orange-600"
                                            : "text-red-700"
                                }`}>
                                    {row.maxDD}
                                </td>
                                <td className="text-right py-2.5 px-3 text-xs hidden md:table-cell">{row.vol}</td>
                                <td className={`text-right py-2.5 px-3 text-xs hidden md:table-cell ${
                                    row.probLoss10YValue > 0.1
                                        ? "text-red-600"
                                        : row.probLoss10YValue > 0.02
                                            ? "text-amber-500"
                                            : "text-emerald-600"
                                }`}>
                                    {row.probLoss10Y}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </CardContent>
    </Card>
)}
```

- [ ] **Step 2: Verify the build compiles**

```bash
pnpm build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/analysis-section.tsx
git commit -m "feat: add unified performance summary table with mobile-responsive columns"
```

---

## Task 3: Wrap existing 4 detail cards in toggle + remove duplicate 10Y Rolling switch

**Files:**
- Modify: `src/components/dashboard/analysis-section.tsx`

### Context

The 4 detail cards span approximately lines 1893–2154:
- **Returns & Growth** card — has a `<Switch>` + `<Label>` for "10Y Rolling" in its `<CardHeader>`. This switch duplicates the one now in the summary card header and must be **removed** from here.
- **Risk & Consistency** card
- **Drawdown & Recovery** card
- **Investor Outcome** section

All 4 blocks get wrapped in `{showAllMetrics && (<> ... </>)}`.

### Steps

- [ ] **Step 1: Wrap the 4 cards in the toggle**

Find the opening comment `{/* ── Returns & Growth ──` and the closing `})()}` of the Investor Outcome block (around line 2154). Wrap the entire span with:

```tsx
{showAllMetrics && (
    <>
        {/* ── Returns & Growth ── (existing card, unchanged) */}
        {/* ── Risk & Consistency ── (existing card, unchanged) */}
        {/* ── Drawdown & Recovery ── (existing card, unchanged) */}
        {/* Investor Outcome (existing section, unchanged) */}
    </>
)}
```

In practice: add `{showAllMetrics && (<>` before the first card's opening `{validItems.length > 0 && (` (the Returns & Growth card) and add `</>)}` after the closing `})()}` of the Investor Outcome block.

- [ ] **Step 2: Remove the duplicate 10Y Rolling switch from Returns & Growth card**

Inside the Returns & Growth `<CardHeader>`, find and delete only:
```tsx
<div className="flex items-center gap-2">
    <Switch id="rolling-mode" checked={showRollingMetrics} onCheckedChange={setShowRollingMetrics} />
    <Label htmlFor="rolling-mode" className="text-xs">10Y Rolling</Label>
</div>
```

The `showRollingMetrics` state itself stays — it's now controlled by the switch in the summary card header. Only the duplicate JSX element is deleted.

- [ ] **Step 3: Verify the build compiles with no errors**

```bash
pnpm build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 4: Start dev server and verify manually**

```bash
pnpm dev
```

Check in browser:
1. With 1 portfolio: Best Portfolio card hidden (correct — only shown when `validItems.length > 1`). Summary table visible with 3 columns on mobile viewport (Strategy, Real TWR, Max DD).
2. With 2+ portfolios: Best Portfolio narrative card shows. Summary table shows. "Show all metrics" button reveals the 4 detail cards below. "Hide details" collapses them.
3. Toggle "10Y Rolling" in the summary card header — Real TWR and Sharpe columns update in the summary table.
4. On mobile (375px viewport in devtools): only Strategy, Real TWR, Max DD columns visible without horizontal scroll.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/analysis-section.tsx
git commit -m "feat: hide detail tables behind 'Show all metrics' toggle, remove duplicate switch"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Narrative card ✓, unified table ✓, 6 correct columns ✓, mobile responsive visibility ✓, "Show all metrics" toggle ✓, 10Y Rolling switch moved ✓
- [x] **No placeholders:** All code is complete, no TBDs
- [x] **Type consistency:** `row.medianRollingReal10YTWR` (string), `row.medianRollingReal10YTWRValue` (number), `row.sharpe10Y` (string), `row.sharpe10YValue` (number) — verified against lines 945–982 of analysis-section.tsx
- [x] **State name:** `showAllMetrics` / `setShowAllMetrics` used consistently across all tasks
- [x] **Sort keys:** `medianRollingReal10YTWRValue`, `sharpe10YValue`, `realCAGRValue`, `sharpeValue`, `maxDDValue`, `volValue`, `probLoss10YValue` — all verified in the existing `handleSort` pattern
