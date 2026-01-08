import { ASSET_CATEGORY_OVERRIDES, IT_ANNUAL_CPI, ASSET_TER_MAPPING } from "./constants";
export * from "./constants";

export type RebalancePeriod = "Monthly" | "Quarterly" | "Annual";
export type InvestmentMode = "lump_sum" | "recurring" | "hybrid";
export type YearSelection = 1 | 3 | 5 | 10 | 15 | 20 | 25 | 30 | "MAX" | "dotcom_crash" | "financial_crisis" | "covid_crash" | "2000s";

export function getAssetTER(name: string): number {
    const n = (name || "").replace(/\s*\((USD|EUR|Local)\)$/i, "");
    return ASSET_TER_MAPPING[n] || 0;
}

export function getAssetCategory(name: string): string {
    const n = (name || "").toLowerCase();
    if (ASSET_CATEGORY_OVERRIDES[name]) return ASSET_CATEGORY_OVERRIDES[name];
    if (n.includes("gold")) return "gold";
    if (n.includes("bond") || n.includes("gov") || n.includes("treasury") || n.includes("agg") || n.includes("fixed income")) return "bonds";
    if (n.includes("cash") || n.includes("money market") || n.match(/\bstr\b|overnight|tbill|t-bill|mmf/)) return "cash";
    if (n.includes("managed futures") || n.includes("alternative") || n.includes("short-term treasury") || n.includes("volatility")) return "alternatives";
    return "stocks";
}

export const toMonthStr = (d: string | number | Date): string => {
    if (typeof d === 'string' && /^\d{4}-\d{1,2}(?:-\d{1,2})?/.test(d)) {
        const parts = d.split('-');
        const y = parts[0];
        const m = parts[1].padStart(2, '0');
        return `${y}-${m}-01`;
    }
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = (dt.getMonth() + 1).toString().padStart(2, "0");
    return `${y}-${m}-01`;
};

export const addMonths = (dStr: string, n: number): string => {
    const d = new Date(dStr);
    const nd = new Date(d.getFullYear(), d.getMonth() + n, 1);
    return toMonthStr(nd);
};

export const monthsBetween = (startStr: string, endStr: string): number => {
    const s = new Date(startStr), e = new Date(endStr);
    return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
};

export const formatMonthsAsYearsAndMonths = (months: number): string => {
    if (months === 0) return "0 months";
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years === 0) {
        return `${months} month${months !== 1 ? 's' : ''}`;
    } else if (remainingMonths === 0) {
        return `${years} year${years !== 1 ? 's' : ''}`;
    } else {
        return `${years} year${years !== 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
    }
};

export const rangeMonths = (startStr: string, endStr: string): string[] => {
    const out = [], n = monthsBetween(startStr, endStr);
    for (let i = 0; i <= n; i++) out.push(addMonths(startStr, i));
    return out;
};

export function buildItalyMonthlyCPI(dates: string[]): Record<string, number> {
    const out: Record<string, number> = {}; if (!dates.length) return out; out[dates[0]] = 100;
    for (let i = 1; i < dates.length; i++) {
        const y = new Date(dates[i]).getFullYear();
        const r = IT_ANNUAL_CPI[y] ?? 0;
        const monthlyFactor = Math.pow(1 + r / 100, 1 / 12);
        out[dates[i]] = out[dates[i - 1]] * monthlyFactor;
    } return out;
}

export function stdev(arr: number[]): number {
    if (!arr.length) return 0; const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    const v = arr.reduce((s, x) => s + Math.pow(x - m, 2), 0) / (arr.length - 1 || 1); return Math.sqrt(Math.max(v, 0));
}

export function cagr(indexSeries: { value: number }[]): number {
    if (!indexSeries.length) return 0; const s = indexSeries[0].value, e = indexSeries[indexSeries.length - 1].value;
    const yrs = (indexSeries.length - 1) / 12; if (yrs <= 0 || s <= 0) return 0; return Math.pow(e / s, 1 / yrs) - 1;
}

export function cagrRecurring(portValues: number[], totalInvested: number[]): number {
    if (!portValues.length || !totalInvested.length) return 0;
    const finalValue = portValues[portValues.length - 1];
    const totalInv = totalInvested[totalInvested.length - 1];
    const months = portValues.length - 1;
    const years = months / 12;
    if (years <= 0 || totalInv <= 0) return 0;
    return Math.pow(finalValue / totalInv, 1 / years) - 1;
}

export function annualVol(mrets: number[]): number { return stdev(mrets) * Math.sqrt(12); }

export function sharpe(mrets: number[], rf = 0): number {
    const rfM = rf / 12; const ex = mrets.map(r => r - rfM); const mean = ex.reduce((a, b) => a + b, 0) / ex.length;
    const sd = stdev(mrets); return sd === 0 ? 0 : (mean / sd) * Math.sqrt(12);
}

export function sortino(mrets: number[], rf = 0): number {
    const rfM = rf / 12; const dn = mrets.filter(r => r < rfM); const dd = stdev(dn);
    const mean = (mrets.reduce((a, b) => a + b, 0) / mrets.length) - rfM; return dd === 0 ? 0 : (mean / dd) * Math.sqrt(12);
}

export interface DrawdownPoint {
    date: string;
    value: number;
}

export function drawdownsFromIndex(idxMap: Record<string, number>): DrawdownPoint[] {
    let maxSF = -Infinity; const out: DrawdownPoint[] = []; Object.keys(idxMap).forEach(d => {
        const v = idxMap[d]; if (v > maxSF) maxSF = v; out.push({ date: d, value: v / maxSF - 1 });
    }); return out;
}

export function maxDrawdown(drawdowns: DrawdownPoint[]): number {
    if (!drawdowns.length) return 0;
    return drawdowns.reduce((min, d) => Math.min(min, d.value), 0);
}

export function ulcerIndex(drawdowns: DrawdownPoint[]): number {
    if (!drawdowns.length) return 0;
    const squaredSum = drawdowns.reduce((sum, d) => sum + Math.pow(d.value * 100, 2), 0);
    return Math.sqrt(squaredSum / drawdowns.length);
}

export function calmar(cagrValue: number, maxDDValue: number): number {
    const absMaxDD = Math.abs(maxDDValue);
    if (absMaxDD === 0) return 0;
    return cagrValue / absMaxDD;
}

export interface RecoveryInfo {
    date: string | null; // Drawdown start date
    recoveryDate: string;
    months: number;
    drawdownDepth: number;
    ongoing?: boolean;
}

export function timeToRecoverFromIndex(idxMap: Record<string, number>): RecoveryInfo[] {
    const entries = Object.entries(idxMap).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const dates = entries.map(e => e[0]);
    const vals = entries.map(e => e[1]);

    const recoveries: RecoveryInfo[] = [];
    let peakValue = -Infinity;
    let peakDate: string | null = null;
    let inDrawdown = false;
    let drawdownStartDate: string | null = null;
    let drawdownStartValue: number | null = null;
    let minValueDuringDrawdown: number | null = null;

    for (let i = 0; i < dates.length; i++) {
        const currentValue = vals[i];
        const currentDate = dates[i];

        if (currentValue > peakValue) {
            if (inDrawdown && drawdownStartDate && drawdownStartValue !== null) {
                const recoveryMonths = monthsBetween(drawdownStartDate, currentDate);
                const drawdownDepth = minValueDuringDrawdown !== null
                    ? Math.abs((drawdownStartValue - minValueDuringDrawdown) / drawdownStartValue)
                    : 0;
                recoveries.push({
                    date: drawdownStartDate,
                    recoveryDate: currentDate,
                    months: recoveryMonths,
                    drawdownDepth: drawdownDepth
                });
            }
            peakValue = currentValue;
            peakDate = currentDate;
            inDrawdown = false;
            drawdownStartDate = null;
            drawdownStartValue = null;
            minValueDuringDrawdown = null;
        } else if (currentValue < peakValue) {
            if (!inDrawdown) {
                inDrawdown = true;
                drawdownStartDate = peakDate || currentDate;
                drawdownStartValue = peakValue;
                minValueDuringDrawdown = currentValue;
            } else {
                if (minValueDuringDrawdown !== null && currentValue < minValueDuringDrawdown) {
                    minValueDuringDrawdown = currentValue;
                }
            }
        }
    }

    if (inDrawdown && drawdownStartDate && drawdownStartValue !== null) {
        const lastDate = dates[dates.length - 1];
        const lastValue = vals[vals.length - 1];
        const recoveryMonths = monthsBetween(drawdownStartDate, lastDate);
        const finalMinValue = minValueDuringDrawdown !== null && lastValue < minValueDuringDrawdown
            ? lastValue
            : (minValueDuringDrawdown !== null ? minValueDuringDrawdown : lastValue);
        const drawdownDepth = Math.abs((drawdownStartValue - finalMinValue) / drawdownStartValue);
        recoveries.push({
            date: drawdownStartDate,
            recoveryDate: lastDate,
            months: recoveryMonths,
            drawdownDepth: drawdownDepth,
            ongoing: true
        });
    }

    return recoveries;
}

export function pctChangeSeries(vals: number[]): number[] { const out = []; for (let i = 1; i < vals.length; i++) { out.push((vals[i] - vals[i - 1]) / vals[i - 1]); } return out; }

export interface NormalizedData {
    dates: string[];
    series: Record<string, (number | null)[]>;
    columns: string[];
    firstValidDates: Record<string, string>;
    lastValidDates: Record<string, string>;
}

export function normalizeAndInterpolate(priceTable: any[], startDateStr: string): NormalizedData {
    const dates = priceTable.map(r => toMonthStr(r.Date || r.date || r["Date"])).filter(Boolean).sort();
    const unique = Array.from(new Set(dates)); const first = unique[0]; const last = unique[unique.length - 1];
    const aligned = rangeMonths(startDateStr < first ? startDateStr : first, last);

    const cols = Object.keys(priceTable[0] || {}).filter(k => k.toLowerCase() !== "date");
    const rawByDate: Record<string, Record<string, number | null>> = {};
    const rawDates = priceTable.map(r => toMonthStr(r.Date || r.date || r["Date"])).filter(Boolean).sort();

    for (const row of priceTable) {
        const d = toMonthStr(row.Date || row.date || row["Date"]); if (!rawByDate[d]) rawByDate[d] = {};
        for (const c of cols) { const v = row[c]; rawByDate[d][c] = (v === null || v === undefined || v === "") ? null : Number(v); }
    }

    const series: Record<string, (number | null)[]> = {};
    const firstValidDates: Record<string, string> = {};
    const lastValidDates: Record<string, string> = {};

    for (const c of cols) {
        const LIMIT = "2003-01-01";
        // To find true valid range, we look at the raw data relative to the aligned range, or just raw data?
        // We'll look at the 'aligned' range because that's the universe we return.

        const orig = aligned.map(d => rawByDate[d]?.[c] ?? null);
        const firstIdx = orig.findIndex(x => x != null && !isNaN(x as number));

        // Find last valid index
        let lastIdx = -1;
        for (let k = orig.length - 1; k >= 0; k--) {
            if (orig[k] != null && !isNaN(orig[k] as number)) {
                lastIdx = k;
                break;
            }
        }

        if (firstIdx !== -1) firstValidDates[c] = aligned[firstIdx];
        if (lastIdx !== -1) lastValidDates[c] = aligned[lastIdx];

        let scaled = Array.from(orig);
        if (firstIdx >= 0) { const base = orig[firstIdx]!; scaled = orig.map(x => (x == null || isNaN(x as number)) ? null : (x / base) * 100); }
        const a = scaled.slice();
        let i = 0; while (i < a.length) {
            if (a[i] == null) {
                let j = i + 1; while (j < a.length && a[j] == null) j++;
                if (i > 0 && j < a.length) {
                    const v0 = a[i - 1] as number, v1 = a[j] as number; const steps = j - i + 1;
                    for (let k = 1; k < steps; k++) a[i + k - 1] = v0 + (v1 - v0) * (k / steps); i = j; continue;
                }
            }
            i++;
        }
        const sIdx = aligned.findIndex(d => d >= startDateStr);
        const lIdx = aligned.findIndex(d => d >= LIMIT);
        const clampIdx = Math.min(firstIdx === -1 ? aligned.length - 1 : firstIdx, lIdx === -1 ? aligned.length - 1 : lIdx);
        if (sIdx !== -1 && firstIdx > sIdx) {
            const endI = Math.max(firstIdx, clampIdx); const endVal = a[firstIdx] as number; const steps = endI - sIdx;
            if (steps > 0) { for (let k = 0; k <= steps; k++) { const t = k / steps; a[sIdx + k] = 100 + (endVal - 100) * t; } }
            // If we artificially backfilled, the 'firstValidDates' remains the 'real' one we found earlier. Good.
        }
        for (let k = 1; k < a.length; k++) if (a[k] == null) a[k] = a[k - 1];
        for (let k = a.length - 2; k >= 0; k--) if (a[k] == null) a[k] = a[k + 1];
        series[c] = a;
    }
    return { dates: aligned, series, columns: cols, firstValidDates, lastValidDates };
}

export interface PortfolioResult {
    portRets: number[];
    idxMap: Record<string, number>;
    dates: string[];
    drawdowns: DrawdownPoint[];
    totalInvested?: number[];
    portValues?: number[];
    normalizedIndex?: number[];
}

export function computePortfolio(
    dates: string[],
    series: Record<string, (number | null)[]>,
    weights: Record<string, number>,
    rebalance: RebalancePeriod = "Annual",
    initialInvestment: number = 100000
): PortfolioResult {
    const cols = Object.keys(series);
    const wVec = cols.map(c => weights[c] ?? 0);
    const wSum = wVec.reduce((a, b) => a + b, 0) || 1;
    const targetW = wVec.map(w => w / wSum);

    const assetRets = cols.map(c => pctChangeSeries(series[c] as number[]));
    const N = assetRets[0]?.length || 0;
    const step = rebalance === "Monthly" ? 1 : rebalance === "Quarterly" ? 3 : 12;
    let curW = targetW.slice();
    const portRets: number[] = [];
    for (let t = 0; t < N; t++) {
        let r = 0; for (let i = 0; i < cols.length; i++) r += (curW[i] || 0) * (assetRets[i][t] || 0);
        portRets.push(r);
        let nv: number[] = []; for (let i = 0; i < cols.length; i++) nv.push((curW[i] || 0) * (1 + (assetRets[i][t] || 0)));
        const s = nv.reduce((a, b) => a + b, 0) || 1; nv = nv.map(v => v / s);
        if ((t + 1) % step === 0) curW = targetW.slice(); else curW = nv;
    }

    // Monetary portfolio value series (so charts and metrics can reflect the initial investment).
    const portValues = [initialInvestment];
    for (const r of portRets) portValues.push(portValues[portValues.length - 1] * (1 + r));

    const totalInvested = new Array(portValues.length).fill(initialInvestment);

    // Keep idxMap as the main time series (scale-invariant analytics like drawdowns and returns still work).
    const idxMap: Record<string, number> = {};
    for (let i = 0; i < dates.length; i++) idxMap[dates[i]] = portValues[i];

    // Also provide a normalized index for cases where a 100-based view is useful.
    const normalizedIndex = [100];
    for (const r of portRets) normalizedIndex.push(normalizedIndex[normalizedIndex.length - 1] * (1 + r));

    return {
        portRets,
        idxMap,
        dates,
        drawdowns: drawdownsFromIndex(idxMap),
        totalInvested,
        portValues,
        normalizedIndex,
    };
}

export function computeRecurringPortfolio(dates: string[], series: Record<string, (number | null)[]>, weights: Record<string, number>, rebalance: RebalancePeriod = "Annual", monthlyInvestment: number = 1000): PortfolioResult {
    const cols = Object.keys(series);
    const wVec = cols.map(c => weights[c] ?? 0);
    const wSum = wVec.reduce((a, b) => a + b, 0) || 1;
    const targetW = wVec.map(w => w / wSum);

    const assetRets = cols.map(c => pctChangeSeries(series[c] as number[]));
    const N = assetRets[0]?.length || 0;
    const step = rebalance === "Monthly" ? 1 : rebalance === "Quarterly" ? 3 : 12;

    let holdings = new Array(cols.length).fill(0);
    let totalValue = monthlyInvestment;
    const portValues = [monthlyInvestment];
    const portRets: number[] = [];
    const totalInvested = [monthlyInvestment];

    for (let i = 0; i < cols.length; i++) {
        holdings[i] = monthlyInvestment * targetW[i];
    }

    for (let t = 0; t < N; t++) {
        let valueAfterReturns = 0;
        for (let i = 0; i < cols.length; i++) {
            holdings[i] *= (1 + (assetRets[i][t] || 0));
            valueAfterReturns += holdings[i];
        }

        const investmentAmount = monthlyInvestment;
        for (let i = 0; i < cols.length; i++) {
            holdings[i] += investmentAmount * targetW[i];
        }
        const newTotalValue = valueAfterReturns + investmentAmount;

        const periodReturn = totalValue > 0 ? (valueAfterReturns - totalValue) / totalValue : 0;
        portRets.push(periodReturn);

        totalValue = newTotalValue;
        portValues.push(totalValue);
        totalInvested.push(totalInvested[totalInvested.length - 1] + investmentAmount);

        if ((t + 1) % step === 0 && totalValue > 0) {
            for (let i = 0; i < cols.length; i++) {
                holdings[i] = totalValue * targetW[i];
            }
        }
    }

    const normalizedIdx = [100];
    for (let i = 0; i < portRets.length; i++) {
        normalizedIdx.push(normalizedIdx[normalizedIdx.length - 1] * (1 + portRets[i]));
    }

    const idxMap: Record<string, number> = {};
    for (let i = 0; i < dates.length; i++) {
        idxMap[dates[i]] = normalizedIdx[i];
    }

    return {
        portRets,
        idxMap,
        dates,
        drawdowns: drawdownsFromIndex(idxMap),
        totalInvested,
        portValues,
        normalizedIndex: normalizedIdx
    };
}

export function computeHybridPortfolio(dates: string[], series: Record<string, (number | null)[]>, weights: Record<string, number>, rebalance: RebalancePeriod = "Annual", initialInvestment: number = 100000, monthlyInvestment: number = 1000): PortfolioResult {
    const cols = Object.keys(series);
    const wVec = cols.map(c => weights[c] ?? 0);
    const wSum = wVec.reduce((a, b) => a + b, 0) || 1;
    const targetW = wVec.map(w => w / wSum);

    const assetRets = cols.map(c => pctChangeSeries(series[c] as number[]));
    const N = assetRets[0]?.length || 0;
    const step = rebalance === "Monthly" ? 1 : rebalance === "Quarterly" ? 3 : 12;

    let holdings = new Array(cols.length).fill(0);
    let totalValue = initialInvestment;
    const portValues = [initialInvestment];
    const portRets: number[] = [];
    const totalInvested = [initialInvestment];

    for (let i = 0; i < cols.length; i++) {
        holdings[i] = initialInvestment * targetW[i];
    }

    for (let t = 0; t < N; t++) {
        let valueAfterReturns = 0;
        for (let i = 0; i < cols.length; i++) {
            holdings[i] *= (1 + (assetRets[i][t] || 0));
            valueAfterReturns += holdings[i];
        }

        const investmentAmount = monthlyInvestment;
        for (let i = 0; i < cols.length; i++) {
            holdings[i] += investmentAmount * targetW[i];
        }
        const newTotalValue = valueAfterReturns + investmentAmount;

        const periodReturn = totalValue > 0 ? (valueAfterReturns - totalValue) / totalValue : 0;
        portRets.push(periodReturn);

        totalValue = newTotalValue;
        portValues.push(totalValue);
        totalInvested.push(totalInvested[totalInvested.length - 1] + investmentAmount);

        if ((t + 1) % step === 0 && totalValue > 0) {
            for (let i = 0; i < cols.length; i++) {
                holdings[i] = totalValue * targetW[i];
            }
        }
    }

    const normalizedIdx = [100];
    for (let i = 0; i < portRets.length; i++) {
        normalizedIdx.push(normalizedIdx[normalizedIdx.length - 1] * (1 + portRets[i]));
    }

    const idxMap: Record<string, number> = {};
    for (let i = 0; i < dates.length; i++) {
        idxMap[dates[i]] = normalizedIdx[i];
    }

    return {
        portRets,
        idxMap,
        dates,
        drawdowns: drawdownsFromIndex(idxMap),
        totalInvested,
        portValues,
        normalizedIndex: normalizedIdx
    };
}

export function computeAnnualReturns(idxMap: Record<string, number>): { year: number; nominal: number }[] {
    const entries = Object.entries(idxMap).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const byY: Record<number, { d: string; v: number }[]> = {}; for (const [d, v] of entries) { const y = new Date(d).getFullYear(); if (!byY[y]) byY[y] = []; byY[y].push({ d, v }); }
    const res = []; const years = Object.keys(byY).map(Number).sort((a, b) => a - b); let prev = null;
    for (const y of years) {
        const arr = byY[y].sort((a, b) => (a.d < b.d ? -1 : 1)); const last = arr[arr.length - 1].v;
        if (prev != null) res.push({ year: y, nominal: (last - prev) / prev }); prev = last;
    }
    return res;
}

export function rollingNCAGR(idxMap: Record<string, number>, years: number): { date: string; value: number }[] {
    const entries = Object.entries(idxMap).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const dates = entries.map(e => e[0]), vals = entries.map(e => e[1]);
    const w = years * 12, out = []; for (let i = 0; i + w < vals.length; i++) { const c = Math.pow(vals[i + w] / vals[i], 1 / years) - 1; out.push({ date: dates[i], value: c }); }
    return out;
}

export function averageRollingNCAGR(idxMap: Record<string, number>, years: number): number {
    const rollingValues = rollingNCAGR(idxMap, years);
    if (!rollingValues.length) return 0;
    const sum = rollingValues.reduce((acc, item) => acc + item.value, 0);
    return sum / rollingValues.length;
}

export function averageRolling10YearCAGR(portfolio: PortfolioResult): number {
    // Use monetary series if available, otherwise use normalized index
    const series = portfolio.portValues && portfolio.totalInvested
        ? portfolio.portValues.map((val, i) => val / portfolio.totalInvested![i] * 100)
        : portfolio.normalizedIndex || Object.values(portfolio.idxMap);

    const idxMap: Record<string, number> = {};
    for (let i = 0; i < portfolio.dates.length; i++) {
        idxMap[portfolio.dates[i]] = series[i];
    }

    return averageRollingNCAGR(idxMap, 10);
}

export function slicePortfolioResult(res: PortfolioResult, startDate: string, endDate: string, baseValue: number = 10000): PortfolioResult {
    // Find indices
    const sIdx = res.dates.findIndex(d => d >= startDate);
    let eIdx = -1;
    // Find last index <= endDate
    for (let i = res.dates.length - 1; i >= 0; i--) {
        if (res.dates[i] <= endDate) {
            eIdx = i;
            break;
        }
    }

    if (sIdx === -1 || eIdx === -1 || sIdx > eIdx) {
        return res;
    }

    const newDates = res.dates.slice(sIdx, eIdx + 1);

    // Calculate scale factor to rebase to baseValue
    let scale = 1.0;

    // Determine scale from portValues if available, or idxMap
    if (res.portValues && res.portValues.length > sIdx) {
        const startVal = res.portValues[sIdx];
        if (startVal > 0) scale = baseValue / startVal;
    } else {
        const startKey = res.dates[sIdx];
        const startVal = res.idxMap[startKey];
        if (startVal > 0) scale = baseValue / startVal;
    }

    // Slice and scale arrays
    const newPortValues = res.portValues
        ? res.portValues.slice(sIdx, eIdx + 1).map(v => v * scale)
        : undefined;

    const newTotalInvested = res.totalInvested
        ? res.totalInvested.slice(sIdx, eIdx + 1).map(v => v * scale)
        : undefined;

    // Slice and scale idxMap
    const newIdxMap: Record<string, number> = {};
    for (const d of newDates) {
        if (newPortValues) {
            const idx = newDates.indexOf(d);
            if (idx !== -1) newIdxMap[d] = newPortValues[idx];
        } else {
            // Safety fallback, though usually if no portValues, we rely on idxMap
            newIdxMap[d] = res.idxMap[d] * scale;
        }
    }

    // Fallback if portValues was missing but we used idxMap for scaling
    if (!newPortValues) {
        // Logic above handles it (newIdxMap filled from idxMap * scale)
    }

    // Slice portRets
    const newPortRets = res.portRets.slice(sIdx, eIdx);

    // Recompute drawdowns for this specific window
    const newDrawdowns = drawdownsFromIndex(newIdxMap);

    // Recompute normalizedIndex (start at 100)
    const newNormalizedIndex = [100];
    for (const r of newPortRets) {
        newNormalizedIndex.push(newNormalizedIndex[newNormalizedIndex.length - 1] * (1 + r));
    }

    return {
        ...res,
        dates: newDates,
        idxMap: newIdxMap,
        portValues: newPortValues,
        totalInvested: newTotalInvested,
        portRets: newPortRets,
        drawdowns: newDrawdowns,
        normalizedIndex: newNormalizedIndex
    };
}

export function computeBeta(portRets: number[], benchmarkRets: number[]): number {
    if (portRets.length === 0 || portRets.length !== benchmarkRets.length) return 0;

    const meanPort = portRets.reduce((a, b) => a + b, 0) / portRets.length;
    const meanBenchmark = benchmarkRets.reduce((a, b) => a + b, 0) / benchmarkRets.length;

    let covariance = 0;
    let varianceBenchmark = 0;

    for (let i = 0; i < portRets.length; i++) {
        const diffPort = portRets[i] - meanPort;
        const diffBenchmark = benchmarkRets[i] - meanBenchmark;
        covariance += diffPort * diffBenchmark;
        varianceBenchmark += diffBenchmark * diffBenchmark;
    }

    if (varianceBenchmark === 0) return 0;
    return covariance / varianceBenchmark;
}

export function computeRollingBeta(
    portRets: number[],
    benchmarkRets: number[],
    dates: string[],
    windowMonths: number
): { date: string; value: number }[] {
    if (portRets.length !== benchmarkRets.length || portRets.length < windowMonths) return [];

    const result = [];
    // portRets[i] is return from dates[i] to dates[i+1]? 
    // Actually in computePortfolio, portRets has length N, dates has length N+1.
    // portRets[t] matches transition from dates[t] to dates[t+1].

    for (let i = windowMonths; i <= portRets.length; i++) {
        const windowPort = portRets.slice(i - windowMonths, i);
        const windowBenchmark = benchmarkRets.slice(i - windowMonths, i);
        const beta = computeBeta(windowPort, windowBenchmark);
        result.push({
            date: dates[i], // The date at the end of the window
            value: beta
        });
    }
    return result;
}

export interface MonteCarloPath {
    date: string;
    p10: number;
    p50: number;
    p90: number;
    p25: number;
    p75: number;
}

export function runMonteCarlo(
    historicalRets: number[],
    initialInvestment: number,
    years: number,
    simulations: number = 10000
): MonteCarloPath[] {
    if (historicalRets.length === 0) return [];

    const monthlyResults: number[][] = Array.from({ length: years * 12 + 1 }, () => []);

    for (let s = 0; s < simulations; s++) {
        let currentVal = initialInvestment;
        monthlyResults[0].push(currentVal);
        for (let m = 1; m <= years * 12; m++) {
            // Bootstrap resampling: pick a random month's return from history
            const randomRet = historicalRets[Math.floor(Math.random() * historicalRets.length)];
            currentVal *= (1 + randomRet);
            monthlyResults[m].push(currentVal);
        }
    }

    const paths: MonteCarloPath[] = [];
    const startDate = new Date();

    for (let m = 0; m <= years * 12; m++) {
        const sorted = monthlyResults[m].sort((a, b) => a - b);
        const date = new Date(startDate.getFullYear(), startDate.getMonth() + m, 1);
        const dateStr = date.toISOString().split("T")[0].substring(0, 7); // YYYY-MM

        paths.push({
            date: dateStr,
            p10: sorted[Math.floor(simulations * 0.1)],
            p25: sorted[Math.floor(simulations * 0.25)],
            p50: sorted[Math.floor(simulations * 0.5)],
            p75: sorted[Math.floor(simulations * 0.75)],
            p90: sorted[Math.floor(simulations * 0.9)],
        });
    }

    return paths;
}

export type OptimizationType = "max_sharpe" | "max_cagr" | "min_vol" | "balanced";

export function findOptimalWeights(
    activeAssets: string[],
    means: number[],
    cov: number[][],
    rf: number,
    type: OptimizationType = "max_sharpe",
    sims: number = 5000
): Record<string, number> {
    let bestScore = -Infinity;
    let bestWeights: number[] = [];

    for (let i = 0; i < sims; i++) {
        const rands = activeAssets.map(() => Math.random());
        const sum = rands.reduce((a, b) => a + b, 0);
        const w = rands.map(x => x / sum);

        let mu = 0;
        for (let j = 0; j < w.length; j++) mu += w[j] * means[j];

        let v = 0;
        for (let j = 0; j < w.length; j++) {
            for (let k = 0; k < w.length; k++) {
                v += w[j] * w[k] * cov[j][k];
            }
        }

        const annualReturn = Math.pow(1 + mu, 12) - 1;
        const annualVol = Math.sqrt(Math.max(v, 0) * 12);
        const sharpeRatio = annualVol > 0 ? (annualReturn - rf) / annualVol : 0;

        let score = 0;
        switch (type) {
            case "max_sharpe":
                score = sharpeRatio;
                break;
            case "max_cagr":
                score = annualReturn;
                break;
            case "min_vol":
                score = -annualVol;
                break;
            case "balanced":
                // 50% weight on sharpe, 50% on minimizing volatility relative to return
                score = sharpeRatio * 0.5 + (annualReturn / (annualVol + 0.1));
                break;
        }

        if (score > bestScore) {
            bestScore = score;
            bestWeights = w;
        }
    }

    const result: Record<string, number> = {};
    activeAssets.forEach((asset, idx) => {
        result[asset] = bestWeights[idx];
    });
    return result;
}
