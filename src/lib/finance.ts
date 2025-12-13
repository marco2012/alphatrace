import { ASSET_CATEGORY_OVERRIDES, IT_ANNUAL_CPI } from "./constants";
export * from "./constants";

export type RebalancePeriod = "Monthly" | "Quarterly" | "Annual";
export type InvestmentMode = "lump_sum" | "recurring" | "hybrid";

export function getAssetCategory(name: string): string {
    const n = (name || "").toLowerCase();
    if (ASSET_CATEGORY_OVERRIDES[name]) return ASSET_CATEGORY_OVERRIDES[name];
    if (n.includes("gold")) return "gold";
    if (n.includes("bond") || n.includes("gov") || n.includes("treasury") || n.includes("agg") || n.includes("fixed income")) return "bonds";
    if (n.includes("cash") || n.includes("money market") || n.match(/\bstr\b|overnight|tbill|t-bill|mmf/)) return "cash";
    return "stocks";
}

export const toMonthStr = (d: string | number | Date): string => {
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
}

export function normalizeAndInterpolate(priceTable: any[], startDateStr: string): NormalizedData {
    const dates = priceTable.map(r => toMonthStr(r.Date || r.date || r["Date"])).filter(Boolean).sort();
    const unique = Array.from(new Set(dates)); const first = unique[0]; const last = unique[unique.length - 1];
    const aligned = rangeMonths(startDateStr < first ? startDateStr : first, last);

    const cols = Object.keys(priceTable[0] || {}).filter(k => k.toLowerCase() !== "date");
    const rawByDate: Record<string, Record<string, number | null>> = {};
    for (const row of priceTable) {
        const d = toMonthStr(row.Date || row.date || row["Date"]); if (!rawByDate[d]) rawByDate[d] = {};
        for (const c of cols) { const v = row[c]; rawByDate[d][c] = (v === null || v === undefined || v === "") ? null : Number(v); }
    }

    const series: Record<string, (number | null)[]> = {};
    for (const c of cols) {
        const LIMIT = "2003-01-01";
        const orig = aligned.map(d => rawByDate[d]?.[c] ?? null);
        const firstIdx = orig.findIndex(x => x != null && !isNaN(x as number));
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
        }
        for (let k = 1; k < a.length; k++) if (a[k] == null) a[k] = a[k - 1];
        for (let k = a.length - 2; k >= 0; k--) if (a[k] == null) a[k] = a[k + 1];
        series[c] = a;
    }
    return { dates: aligned, series, columns: cols };
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

export function computePortfolio(dates: string[], series: Record<string, (number | null)[]>, weights: Record<string, number>, rebalance: RebalancePeriod = "Annual"): PortfolioResult {
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
    const idx = [100]; for (const r of portRets) idx.push(idx[idx.length - 1] * (1 + r));
    const idxMap: Record<string, number> = {}; for (let i = 0; i < dates.length; i++) idxMap[dates[i]] = idx[i];
    return { portRets, idxMap, dates, drawdowns: drawdownsFromIndex(idxMap) };
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
