"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Scatter,
    ScatterChart,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Download, RotateCcw } from "lucide-react";
import { NormalizedData, getAssetCategory, pctChangeSeries } from "@/lib/finance";

type FrontierPoint = {
    vol: number;
    ret: number;
    sharpe: number;
    weights: Record<string, number>;
    composition: Record<string, number>;
    label: string;
};

function getRollingStats(weights: number[], assetRets: number[][], years: number = 10, rf: number = 0.02) {
    if (!assetRets || assetRets.length === 0 || !assetRets[0]) return null;
    const nPeriods = assetRets[0].length;
    const nAssets = weights.length;
    const window = years * 12;
    
    if (nPeriods < window) return null;

    const portRets = new Float64Array(nPeriods);
    for (let t = 0; t < nPeriods; t++) {
        let r = 0;
        for (let i = 0; i < nAssets; i++) {
            r += weights[i] * assetRets[i][t];
        }
        portRets[t] = r;
    }

    const prices = new Float64Array(nPeriods + 1);
    prices[0] = 1;
    for (let t = 0; t < nPeriods; t++) {
        prices[t+1] = prices[t] * (1 + portRets[t]);
    }
    
    let sumCagr = 0;
    let count = 0;
    
    for (let i = 0; i <= nPeriods - window; i++) {
        const valStart = prices[i];
        const valEnd = prices[i + window];
        // handle div by zero just in case, though prices[0]=1 and prices are usually > 0
        if (valStart <= 0) continue; 
        const cagr = Math.pow(valEnd / valStart, 1 / years) - 1;
        sumCagr += cagr;
        count++;
    }
    const avgCagr = count > 0 ? sumCagr / count : 0;

    let sumVol = 0;
    const sqrt12 = Math.sqrt(12);
    
    for (let i = 0; i <= nPeriods - window; i++) {
        let m = 0;
        for (let j = 0; j < window; j++) {
            m += portRets[i+j];
        }
        m /= window;
        
        let s = 0;
        for (let j = 0; j < window; j++) {
            const d = portRets[i+j] - m;
            s += d*d;
        }
        s /= (window - 1);
        const vol = Math.sqrt(s) * sqrt12;
        sumVol += vol;
    }
    const avgVol = count > 0 ? sumVol / count : 0;
    
    const sharpe = avgVol > 0 ? (avgCagr - rf) / avgVol : 0;
    
    return { annualReturn: avgCagr, annualVol: avgVol, sharpe };
}

type EfficientFrontierChartProps = {
    norm: NormalizedData | null;
    weights: Record<string, number>;
    startDate: string;
    endDate: string;
    rf?: number;
};

function mean(xs: number[]) {
    if (!xs.length) return 0;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function covariance(a: number[], b: number[], ma: number, mb: number) {
    const n = Math.min(a.length, b.length);
    if (n <= 1) return 0;
    let s = 0;
    for (let i = 0; i < n; i++) s += (a[i] - ma) * (b[i] - mb);
    return s / (n - 1);
}

function portfolioStats(weights: number[], means: number[], cov: number[][]) {
    let mu = 0;
    for (let i = 0; i < weights.length; i++) mu += weights[i] * means[i];

    let v = 0;
    for (let i = 0; i < weights.length; i++) {
        for (let j = 0; j < weights.length; j++) {
            v += weights[i] * weights[j] * cov[i][j];
        }
    }

    const annualReturn = Math.pow(1 + mu, 12) - 1;
    const annualVol = Math.sqrt(Math.max(v, 0) * 12);

    return { annualReturn, annualVol };
}

function isSamePoint(p1: FrontierPoint, p2: FrontierPoint) {
    return Math.abs(p1.vol - p2.vol) < 0.0001 && Math.abs(p1.ret - p2.ret) < 0.0001;
}

export function EfficientFrontierChart({ norm, weights, startDate, endDate, rf = 0.02 }: EfficientFrontierChartProps) {
    const [points, setPoints] = useState<FrontierPoint[]>([]);
    const [frontier, setFrontier] = useState<FrontierPoint[]>([]);
    const [highlights, setHighlights] = useState<FrontierPoint[]>([]);
    const [currentPoint, setCurrentPoint] = useState<FrontierPoint | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [focusedSeries, setFocusedSeries] = useState<string | null>(null);
    const [useRollingStats, setUseRollingStats] = useState(true);

    const [interactiveWeights, setInteractiveWeights] = useState<Record<string, number>>({});

    const { activeAssets, assetCount, canCompute } = useMemo(() => {
        if (!norm) return { activeAssets: [] as string[], assetCount: 0, canCompute: false };
        const activeAssets = Object.entries(weights)
            .filter(([, w]) => (w ?? 0) > 0)
            .map(([k]) => k)
            .filter((k) => norm.series[k] != null);
        const assetCount = activeAssets.length;
        return { activeAssets, assetCount, canCompute: assetCount >= 2 };
    }, [norm, weights]);

    const { assetRets, means, cov } = useMemo(() => {
        if (!norm || activeAssets.length < 2) return { assetRets: [], means: [], cov: [] };

        const dates = norm.dates;
        const lastDate = endDate || dates[dates.length - 1];
        const i0 = dates.findIndex((d) => d >= startDate);
        const i1 = dates.findIndex((d) => d >= lastDate);
        const endIdx = i1 === -1 ? dates.length - 1 : i1;

        const slicedSeries = activeAssets.map((a) => (norm.series[a] as number[]).slice(i0, endIdx + 1));
        const rets = slicedSeries.map((s) => pctChangeSeries(s));
        const n = rets[0]?.length || 0;
        if (n < 12) return { assetRets: [], means: [], cov: [] };

        const meansCalc = rets.map((r) => mean(r));
        const covCalc = rets.map((ri, i) => rets.map((rj, j) => covariance(ri, rj, meansCalc[i], meansCalc[j])));

        return { assetRets: rets, means: meansCalc, cov: covCalc };
    }, [norm, activeAssets, startDate, endDate]);

    useEffect(() => {
        setPoints([]);
        setFrontier([]);
        setHighlights([]);
        setCurrentPoint(null);
        setInteractiveWeights({});
        setFocusedSeries(null);
    }, [norm, weights, startDate, endDate, rf, useRollingStats]);
    
    useEffect(() => {
        if (activeAssets.length > 0 && Object.keys(interactiveWeights).length === 0) {
            const initial: Record<string, number> = {};
            activeAssets.forEach(asset => {
                initial[asset] = weights[asset] || 0;
            });
            setInteractiveWeights(initial);
        }
    }, [activeAssets, weights, interactiveWeights]);


    const compute = async () => {
        if (!norm || activeAssets.length < 2 || assetRets.length === 0) return;

        setIsLoading(true);
        setFocusedSeries(null);

        // Defer to allow UI update
        setTimeout(() => {
            try {
                const buildWeightsMap = (wVec: number[]) => {
                    const out: Record<string, number> = {};
                    for (let i = 0; i < activeAssets.length; i++) out[activeAssets[i]] = wVec[i] || 0;
                    return out;
                };

                const statsToPoint = (label: string, wVec: number[]) => {
                    let vol, ret, sharpe;
                    
                    if (useRollingStats) {
                        const stats = getRollingStats(wVec, assetRets, 10, rf);
                        if (!stats) {
                            // Fallback
                            const st = portfolioStats(wVec, means, cov);
                            vol = st.annualVol;
                            ret = st.annualReturn;
                            sharpe = vol > 0 ? (ret - rf) / vol : 0;
                        } else {
                            vol = stats.annualVol;
                            ret = stats.annualReturn;
                            sharpe = stats.sharpe;
                        }
                    } else {
                        const st = portfolioStats(wVec, means, cov);
                        vol = st.annualVol;
                        ret = st.annualReturn;
                        sharpe = vol > 0 ? (ret - rf) / vol : 0;
                    }

                    const wMap = buildWeightsMap(wVec);
                    return {
                        label,
                        vol: vol * 100,
                        ret: ret * 100,
                        sharpe,
                        weights: wMap,
                        composition: wMap,
                    };
                };

                const wRaw = activeAssets.map((a) => weights[a] ?? 0);
                const wSum = wRaw.reduce((a, b) => a + b, 0) || 1;
                const wCur = wRaw.map((w) => w / wSum);
                const curPoint = statsToPoint("Original Portfolio", wCur);
                setCurrentPoint(curPoint);

                const SIMS = 2000;
                const sims: FrontierPoint[] = [];
                for (let i = 0; i < SIMS; i++) {
                    const rands = new Array(activeAssets.length).fill(0).map(() => Math.random());
                    const s = rands.reduce((a, b) => a + b, 0) || 1;
                    const w = rands.map((x) => x / s);
                    sims.push(statsToPoint("Simulated", w));
                }

                const sorted = [...sims].sort((a, b) => a.vol - b.vol);
                const fr: FrontierPoint[] = [];
                let best = -Infinity;
                for (const p of sorted) {
                    if (p.ret > best) {
                        fr.push({ ...p, label: "Efficient Frontier" });
                        best = p.ret;
                    }
                }

                const bestCagr = sims.reduce((best, p) => (p.ret > best.ret ? p : best), sims[0]);
                const bestSharpe = sims.reduce((best, p) => (p.sharpe > best.sharpe ? p : best), sims[0]);
                const minRisk = sims.reduce((best, p) => (p.vol < best.vol ? p : best), sims[0]);

                setPoints(sims);
                setFrontier(fr);
                setHighlights([
                    { ...bestCagr, label: "Highest CAGR" },
                    { ...bestSharpe, label: "Highest Sharpe" },
                    { ...minRisk, label: "Lowest Risk" },
                ]);
            } finally {
                setIsLoading(false);
            }
        }, 0);
    };


    const calculateInteractivePoint = useCallback((weights: Record<string, number>) => {
        if (!means.length || !cov.length || activeAssets.length === 0) return null;
        
        const wVec = activeAssets.map(asset => weights[asset] || 0);
        const sum = wVec.reduce((a, b) => a + b, 0);
        if (sum === 0) return null;
        
        const normalized = wVec.map(w => w / sum);
        let vol, ret, sharpe;

        if (useRollingStats) {
            const stats = getRollingStats(normalized, assetRets, 10, rf);
            if (!stats) {
                const st = portfolioStats(normalized, means, cov);
                vol = st.annualVol;
                ret = st.annualReturn;
                sharpe = vol > 0 ? (ret - rf) / vol : 0;
            } else {
                vol = stats.annualVol;
                ret = stats.annualReturn;
                sharpe = stats.sharpe;
            }
        } else {
            const st = portfolioStats(normalized, means, cov);
            vol = st.annualVol;
            ret = st.annualReturn;
            sharpe = vol > 0 ? (ret - rf) / vol : 0;
        }
        
        const weightsObj = activeAssets.reduce((acc, asset, i) => {
            acc[asset] = normalized[i];
            return acc;
        }, {} as Record<string, number>);

        return {
            label: "Interactive",
            vol: vol * 100,
            ret: ret * 100,
            sharpe,
            weights: weightsObj,
            composition: weightsObj,
        };
    }, [means, cov, activeAssets, rf, useRollingStats, assetRets]);
    
    const interactivePoint = useMemo(() => 
        calculateInteractivePoint(interactiveWeights),
        [interactiveWeights, calculateInteractivePoint]
    );
    
    const handleWeightChange = useCallback((asset: string, value: number) => {
        setInteractiveWeights(prev => ({
            ...prev,
            [asset]: Math.round(value) / 100,
        }));
    }, []);
    
    const resetWeights = useCallback(() => {
        const initial: Record<string, number> = {};
        activeAssets.forEach(asset => {
            initial[asset] = Math.round((weights[asset] || 0) * 100) / 100;
        });
        setInteractiveWeights(initial);
    }, [activeAssets, weights]);
    
    const normalizeWeights = useCallback(() => {
        setInteractiveWeights(prev => {
            const entries = Object.entries(prev);
            const sum = entries.reduce((a, b) => a + b[1], 0);
            if (sum === 0) return prev;
            
            // Largest Remainder Method to ensure integer percentages summing to 100
            const raw = entries.map(([asset, w]) => ({
                asset,
                val: (w / sum) * 100
            }));
            
            const rounded = raw.map(item => ({
                asset: item.asset,
                val: Math.floor(item.val)
            }));
            
            let currentSum = rounded.reduce((a, b) => a + b.val, 0);
            const diff = 100 - currentSum;
            
            if (diff > 0) {
                const remainders = raw.map((item, i) => ({
                    index: i,
                    rem: item.val - rounded[i].val
                })).sort((a, b) => b.rem - a.rem);
                
                for (let i = 0; i < diff; i++) {
                    rounded[remainders[i].index].val++;
                }
            }
            
            const normalized: Record<string, number> = {};
            rounded.forEach(item => {
                normalized[item.asset] = item.val / 100;
            });
            return normalized;
        });
    }, []);

    const { xDomain, yDomain } = useMemo(() => {
        if (points.length === 0) return { xDomain: [0, 'auto'] as [number, 'auto'], yDomain: [0, 'auto'] as [number, 'auto'] };
        
        const allPoints = [...points, ...highlights];
        if (currentPoint) allPoints.push(currentPoint);
        if (interactivePoint) allPoints.push(interactivePoint);
        
        const vols = allPoints.map(p => p.vol);
        const rets = allPoints.map(p => p.ret);
        
        const minVol = Math.min(...vols);
        const maxVol = Math.max(...vols);
        const minRet = Math.min(...rets);
        const maxRet = Math.max(...rets);
        
        // Add some padding
        const xPad = (maxVol - minVol) * 0.1;
        const yPad = (maxRet - minRet) * 0.1;
        
        return {
            xDomain: [Math.max(0, minVol - xPad), maxVol + xPad] as [number, number],
            yDomain: [minRet - yPad, maxRet + yPad] as [number, number]
        };
    }, [points, highlights, currentPoint, interactivePoint]);

    const handleLegendClick = useCallback((e: any) => {
        const name = e.value;
        setFocusedSeries(prev => prev === name ? null : name);
    }, []);

    const downloadCSV = () => {
        const csv = [
            ["Label", "Volatility (%)", "CAGR/Return (%)", "Sharpe"],
            ...points.map((p) => [p.label, p.vol.toFixed(4), p.ret.toFixed(4), p.sharpe.toFixed(6)]),
        ]
            .map((row) => row.join(","))
            .join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "efficient-frontier.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    return (
        <Card className="col-span-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                    <CardTitle>Efficient Frontier</CardTitle>
                    <CardDescription>
                        Risk/return trade-off from simulated portfolios ({assetCount} assets).
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center space-x-2 mr-2">
                        <Switch id="rolling-stats" checked={useRollingStats} onCheckedChange={setUseRollingStats} />
                        <Label htmlFor="rolling-stats" className="text-xs whitespace-nowrap">Use 10y Rolling</Label>
                    </div>
                    <Button variant="outline" size="sm" onClick={downloadCSV} disabled={points.length === 0}>
                        <Download className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pl-2">
                {points.length > 0 && activeAssets.length > 0 && (
                    <div className="mb-4 pr-2">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="text-sm font-medium">Interactive Portfolio Locator</div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={normalizeWeights}>
                                    Normalize to 100%
                                </Button>
                                <Button variant="outline" size="sm" onClick={resetWeights}>
                                    <RotateCcw className="h-4 w-4 mr-1" />
                                    Reset
                                </Button>
                            </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {activeAssets.map(asset => {
                                const value = (interactiveWeights[asset] || 0) * 100;
                                return (
                                    <div key={asset} className="rounded-md border p-3">
                                        <div className="mb-2 flex items-center justify-between">
                                            <div className="text-sm font-medium truncate">{asset}</div>
                                            <div className="text-sm font-bold text-primary ml-2">{Math.round(value)}%</div>
                                        </div>
                                        <Slider
                                            value={[value]}
                                            onValueChange={(vals) => handleWeightChange(asset, vals[0])}
                                            max={100}
                                            step={1}
                                            className="w-full"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        {interactivePoint && (
                            <div className="mt-3 rounded-md bg-muted p-3 text-sm">
                                <div className="font-medium mb-1">Current Interactive Portfolio:</div>
                                <div className="grid grid-cols-3 gap-2 text-muted-foreground">
                                    <div>Return: <span className="font-medium text-foreground">{interactivePoint.ret.toFixed(2)}%</span></div>
                                    <div>Risk: <span className="font-medium text-foreground">{interactivePoint.vol.toFixed(2)}%</span></div>
                                    <div>Sharpe: <span className="font-medium text-foreground">{interactivePoint.sharpe.toFixed(2)}</span></div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                <div className="h-[350px] w-full">
                    {points.length === 0 || !currentPoint ? (
                        <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
                            {isLoading ? (
                                <>
                                    <Spinner size="lg" />
                                    <div>Computing efficient frontier...</div>
                                </>
                            ) : (
                                <>
                                    <div>Click Compute to generate the efficient frontier.</div>
                                    <Button onClick={compute} disabled={!canCompute} size="lg">
                                        Compute
                                    </Button>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="relative h-full w-full">
                            {isLoading && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Spinner size="sm" />
                                        <span>Recomputing...</span>
                                    </div>
                                </div>
                            )}
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis
                                        type="number"
                                        dataKey="vol"
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                                        name="Volatility"
                                        label={{ value: "Risk (Annualized Volatility)", position: "insideBottom", offset: -5 }}
                                        domain={xDomain}
                                    />
                                    <YAxis
                                        type="number"
                                        dataKey="ret"
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                                        name="Return"
                                        label={{ value: "CAGR / Annual Return", angle: -90, position: "insideLeft" }}
                                        domain={yDomain}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--card-foreground))" }}
                                        itemStyle={{ color: "hsl(var(--foreground))" }}
                                        content={({ active, payload }: any) => {
                                            if (!active || !payload?.length) return null;
                                            const p = payload[0]?.payload as FrontierPoint;
                                            if (!p) return null;
                                            
                                            // Determine correct label if matching a special point
                                            let displayLabel = p.label;
                                            const matchHighlight = highlights.find(h => isSamePoint(h, p));
                                            if (matchHighlight) displayLabel = matchHighlight.label;
                                            else if (currentPoint && isSamePoint(currentPoint, p)) displayLabel = currentPoint.label;
                                            else if (interactivePoint && isSamePoint(interactivePoint, p)) displayLabel = interactivePoint.label;

                                            const CATEGORY_COLORS: Record<string, string> = {
                                                stocks: "text-blue-500",
                                                bonds: "text-green-500",
                                                gold: "text-yellow-500",
                                                cash: "text-gray-500",
                                                alternatives: "text-purple-500",
                                            };
                                            const DEFAULT_COLOR = "text-muted-foreground";

                                            const groupedAssets: Record<string, { name: string; weight: number }[]> = {};
                                            Object.entries(p.composition || {}).forEach(([asset, weight]) => {
                                                if (weight < 0.001) return; // Hide negligible weights
                                                const cat = getAssetCategory(asset);
                                                if (!groupedAssets[cat]) groupedAssets[cat] = [];
                                                groupedAssets[cat].push({ name: asset, weight });
                                            });

                                            // Sort categories (custom order if desired, or alphabetical)
                                            // Preferred order: Stocks, Bonds, Gold, Alts, Cash
                                            const catOrder = ["stocks", "bonds", "gold", "alternatives", "cash"];
                                            const categories = Object.keys(groupedAssets).sort((a, b) => {
                                                const ia = catOrder.indexOf(a);
                                                const ib = catOrder.indexOf(b);
                                                if (ia !== -1 && ib !== -1) return ia - ib;
                                                if (ia !== -1) return -1;
                                                if (ib !== -1) return 1;
                                                return a.localeCompare(b);
                                            });

                                            categories.forEach(cat => {
                                                groupedAssets[cat].sort((a, b) => b.weight - a.weight);
                                            });

                                            return (
                                                <div className="rounded-md border bg-card p-3 text-card-foreground shadow-lg min-w-[320px] max-w-[450px]">
                                                    <div className="mb-2 border-b pb-2">
                                                        <div className="font-semibold text-sm">{displayLabel}</div>
                                                        <div className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground">
                                                            <div className="flex flex-col items-start">
                                                                <span className="text-[10px] uppercase tracking-wider">CAGR</span>
                                                                <span className="font-medium text-foreground">{p.ret.toFixed(2)}%</span>
                                                            </div>
                                                            <div className="flex flex-col items-start">
                                                                <span className="text-[10px] uppercase tracking-wider">Risk</span>
                                                                <span className="font-medium text-foreground">{p.vol.toFixed(2)}%</span>
                                                            </div>
                                                            <div className="flex flex-col items-start">
                                                                <span className="text-[10px] uppercase tracking-wider">Sharpe</span>
                                                                <span className="font-medium text-foreground">{p.sharpe.toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-3 text-xs">
                                                        {categories.map(cat => (
                                                            <div key={cat}>
                                                                <div className={`mb-1 flex items-center gap-1.5 font-semibold capitalize ${CATEGORY_COLORS[cat] || DEFAULT_COLOR}`}>
                                                                    <div className={`h-1.5 w-1.5 rounded-full bg-current`} />
                                                                    {cat}
                                                                </div>
                                                                <div className="pl-3 space-y-1">
                                                                    {groupedAssets[cat].map(asset => (
                                                                        <div key={asset.name} className="flex justify-between gap-4">
                                                                            <span className="text-muted-foreground" title={asset.name}>{asset.name}</span>
                                                                            <span className="font-medium tabular-nums whitespace-nowrap">{(asset.weight * 100).toFixed(1)}%</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    />
                                    <Legend verticalAlign="bottom" onClick={handleLegendClick} wrapperStyle={{ cursor: 'pointer', userSelect: 'none' }} />
                                    <Scatter name="Simulated" data={points} fill="#94a3b8" legendType="none" hide={focusedSeries !== null} />
                                    <Scatter name="Frontier" data={frontier} fill="#3b82f6" legendType="none" hide={focusedSeries !== null} />
                                    {interactivePoint && (
                                        <Scatter
                                            name={`Interactive (${interactivePoint.ret.toFixed(2)}%)`}
                                            data={[interactivePoint]}
                                            fill="#f97316"
                                            shape="circle"
                                            legendType="none"
                                            hide={focusedSeries !== null}
                                        />
                                    )}
                                    <Scatter
                                        name={`Original Portfolio (${currentPoint.ret.toFixed(2)}%)`}
                                        data={[currentPoint]}
                                        fill="#ef4444"
                                        shape="diamond"
                                        hide={focusedSeries !== null && focusedSeries !== `Original Portfolio (${currentPoint.ret.toFixed(2)}%)`}
                                    />
                                    <Scatter
                                        name={(() => {
                                            const p = highlights.find((h) => h.label === "Highest CAGR");
                                            return p ? `Highest CAGR (${p.ret.toFixed(2)}%)` : "Highest CAGR";
                                        })()}
                                        data={highlights.filter((p) => p.label === "Highest CAGR")}
                                        fill="#22c55e"
                                        hide={focusedSeries !== null && focusedSeries !== (highlights.find((h) => h.label === "Highest CAGR") ? `Highest CAGR (${highlights.find((h) => h.label === "Highest CAGR")!.ret.toFixed(2)}%)` : "Highest CAGR")}
                                    />
                                    <Scatter
                                        name={(() => {
                                            const p = highlights.find((h) => h.label === "Highest Sharpe");
                                            return p ? `Highest Sharpe (${p.ret.toFixed(2)}%)` : "Highest Sharpe";
                                        })()}
                                        data={highlights.filter((p) => p.label === "Highest Sharpe")}
                                        fill="#a855f7"
                                        hide={focusedSeries !== null && focusedSeries !== (highlights.find((h) => h.label === "Highest Sharpe") ? `Highest Sharpe (${highlights.find((h) => h.label === "Highest Sharpe")!.ret.toFixed(2)}%)` : "Highest Sharpe")}
                                    />
                                    <Scatter
                                        name={(() => {
                                            const p = highlights.find((h) => h.label === "Lowest Risk");
                                            return p ? `Lowest Risk (${p.ret.toFixed(2)}%)` : "Lowest Risk";
                                        })()}
                                        data={highlights.filter((p) => p.label === "Lowest Risk")}
                                        fill="#f59e0b"
                                        hide={focusedSeries !== null && focusedSeries !== (highlights.find((h) => h.label === "Lowest Risk") ? `Lowest Risk (${highlights.find((h) => h.label === "Lowest Risk")!.ret.toFixed(2)}%)` : "Lowest Risk")}
                                    />
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
