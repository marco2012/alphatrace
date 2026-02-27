"use client";

import { useEffect, useMemo, useState, useCallback, memo } from "react";
import {
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Scatter,
    ScatterChart,
    Tooltip,
    XAxis,
    YAxis,
    ZAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, RotateCcw, Save, Settings, X, TrendingUp, ShieldCheck, Info, ChevronDown, ChevronUp } from "lucide-react";
import { NormalizedData, getAssetCategory, pctChangeSeries } from "@/lib/finance";
import { usePortfolio } from "@/context/portfolio-context";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type FrontierPoint = {
    vol: number;
    ret: number;
    x: number;
    y: number;
    sharpe: number;
    weights: Record<string, number>;
    composition: Record<string, number>;
    label: string;
    z: number;
};

function getStrategyStats(
    weights: number[],
    assetRets: number[][],
    years: number = 10,
    rf: number = 0.02,
    mode: "lump_sum" | "recurring" | "hybrid" = "lump_sum",
    initialInvestment: number = 100000,
    monthlyInvestment: number = 1000,
    rolling: boolean = true
) {
    if (!assetRets || assetRets.length === 0 || !assetRets[0]) return null;
    const nPeriods = assetRets[0].length;
    const nAssets = weights.length;
    const window = years * 12;

    const portRets = new Float64Array(nPeriods);
    for (let t = 0; t < nPeriods; t++) {
        let r = 0;
        for (let i = 0; i < nAssets; i++) {
            r += weights[i] * assetRets[i][t];
        }
        portRets[t] = r;
    }

    const calculateCagr = (retsSlice: Float64Array | number[]) => {
        if (mode === "lump_sum") {
            let growth = 1;
            for (let t = 0; t < retsSlice.length; t++) growth *= (1 + retsSlice[t]);
            const yrs = retsSlice.length / 12;
            if (yrs <= 0) return 0;
            return Math.pow(growth, 1 / yrs) - 1;
        } else {
            const init = mode === "recurring" ? 0 : initialInvestment;
            const monthly = monthlyInvestment;
            let totalValue = init;
            for (let t = 0; t < retsSlice.length; t++) {
                totalValue = totalValue * (1 + retsSlice[t]) + monthly;
            }
            const totalInvested = init + monthly * retsSlice.length;
            const yrs = retsSlice.length / 12;
            if (yrs <= 0 || totalInvested <= 0) return 0;
            return Math.pow(totalValue / totalInvested, 1 / yrs) - 1;
        }
    };

    let avgCagr = 0;
    let avgVol = 0;
    const sqrt12 = Math.sqrt(12);

    if (rolling) {
        if (nPeriods < window) return null;
        let sumCagr = 0;
        let sumVol = 0;
        let count = 0;

        for (let i = 0; i <= nPeriods - window; i++) {
            const retsSlice = portRets.subarray(i, i + window);
            sumCagr += calculateCagr(retsSlice);

            let m = 0;
            for (let j = 0; j < window; j++) m += retsSlice[j];
            m /= window;
            let s = 0;
            for (let j = 0; j < window; j++) {
                const d = retsSlice[j] - m;
                s += d * d;
            }
            s /= (window - 1);
            sumVol += Math.sqrt(s) * sqrt12;
            count++;
        }
        avgCagr = count > 0 ? sumCagr / count : 0;
        avgVol = count > 0 ? sumVol / count : 0;
    } else {
        avgCagr = calculateCagr(portRets);
        let m = 0;
        for (let j = 0; j < nPeriods; j++) m += portRets[j];
        m /= nPeriods;
        let s = 0;
        for (let j = 0; j < nPeriods; j++) {
            const d = portRets[j] - m;
            s += d * d;
        }
        s /= (nPeriods - 1);
        avgVol = Math.sqrt(Math.max(s, 0)) * sqrt12;
    }

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

const CustomTooltip = memo(({ active, payload, highlights, currentPoint, interactivePoint, saveCustomPortfolio, onClose }: any) => {
    if (!active || !payload?.length) return null;
    const p = payload[0]?.payload as FrontierPoint;
    if (!p) return null;

    let displayLabel = p.label;
    const matchHighlight = highlights.find((h: FrontierPoint) => isSamePoint(h, p));
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
        if (weight < 0.001) return; 
        const cat = getAssetCategory(asset);
        if (!groupedAssets[cat]) groupedAssets[cat] = [];
        groupedAssets[cat].push({ name: asset, weight });
    });

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
                <div className="flex items-center justify-between mb-1">
                    <div className="font-semibold text-sm">{displayLabel}</div>
                    <div className="flex gap-1">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                                e.stopPropagation();
                                const name = prompt("Enter a name for this portfolio:", displayLabel);
                                if (name) {
                                    saveCustomPortfolio(name, p.weights);
                                }
                            }}
                            title="Save Portfolio"
                        >
                            <Save className="h-4 w-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose?.();
                            }}
                            title="Close"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
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
});
CustomTooltip.displayName = "CustomTooltip";

export function EfficientFrontierChart({ norm, weights, startDate, endDate, rf = 0.02 }: EfficientFrontierChartProps) {
    const [points, setPoints] = useState<FrontierPoint[]>([]);
    const [frontier, setFrontier] = useState<FrontierPoint[]>([]);
    const [highlights, setHighlights] = useState<FrontierPoint[]>([]);
    const [currentPoint, setCurrentPoint] = useState<FrontierPoint | null>(null);
    const [topSimulations, setTopSimulations] = useState<FrontierPoint[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [focusedSeries, setFocusedSeries] = useState<string | null>(null);
    const [useRollingStats, setUseRollingStats] = useState(true);
    const [simCount, setSimCount] = useState(2000);
    const [constraints, setConstraints] = useState<Record<string, number>>({});

    const { saveCustomPortfolio, investmentMode, initialInvestment, monthlyInvestment } = usePortfolio();

    const [interactiveWeights, setInteractiveWeights] = useState<Record<string, number>>({});

    const [isInteractiveExpanded, setIsInteractiveExpanded] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 640);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const [tooltipState, setTooltipState] = useState<{ active: boolean; payload: any[]; coordinate: { x: number; y: number } | undefined }>({
        active: false,
        payload: [],
        coordinate: undefined,
    });

    const handlePointClick = useCallback((data: any, _index: number, e: React.MouseEvent) => {
        const { cx, cy, x, y } = data;

        if (e && e.stopPropagation) e.stopPropagation();

        setTooltipState({
            active: true,
            payload: [data], 
            coordinate: { x: cx ?? x, y: cy ?? y },
        });
    }, []);

    const closeTooltip = useCallback(() => {
        setTooltipState(prev => ({ ...prev, active: false }));
    }, []);

    const { activeAssets, assetCount, canCompute } = useMemo(() => {
        if (!norm) return { activeAssets: [] as string[], assetCount: 0, canCompute: false };
        const activeAssets = Object.entries(weights)
            .filter(([, w]) => (w ?? 0) > 0)
            .map(([k]) => k)
            .filter((k) => norm.series[k] != null);
        const assetCount = activeAssets.length;
        return { activeAssets, assetCount, canCompute: assetCount >= 2 };
    }, [norm, weights]);

    useEffect(() => {
        if (activeAssets.length > 0 && Object.keys(constraints).length === 0) {
            const defaults: Record<string, number> = {};
            activeAssets.forEach(a => {
                const lower = a.toLowerCase();
                if (lower.includes("gold")) defaults[a] = 15;
                else if (lower.includes("dbmf")) defaults[a] = 20;
            });
            if (Object.keys(defaults).length > 0) {
                setConstraints(defaults);
            }
        }
    }, [activeAssets, constraints]);

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
        setTopSimulations([]);
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

        setTimeout(() => {
            try {
                const buildWeightsMap = (wVec: number[]) => {
                    const out: Record<string, number> = {};
                    for (let i = 0; i < activeAssets.length; i++) out[activeAssets[i]] = wVec[i] || 0;
                    return out;
                };

                const statsToPoint = (label: string, wVec: number[]) => {
                    let vol, ret, sharpe;

                    const stats = getStrategyStats(
                        wVec,
                        assetRets,
                        10,
                        rf,
                        investmentMode,
                        initialInvestment,
                        monthlyInvestment,
                        useRollingStats
                    );

                    if (!stats) {
                        // This branch usually shouldn't be hit if useRollingStats is true but nPeriods < window
                        // or if useRollingStats is false (but we updated getStrategyStats to handle rolling=false)
                        const st = portfolioStats(wVec, means, cov);
                        vol = st.annualVol;
                        ret = st.annualReturn;
                        sharpe = vol > 0 ? (ret - rf) / vol : 0;
                    } else {
                        vol = stats.annualVol;
                        ret = stats.annualReturn;
                        sharpe = stats.sharpe;
                    }

                    const wMap = buildWeightsMap(wVec);
                    return {
                        label,
                        vol: vol * 100,
                        ret: ret * 100,
                        x: vol * 100,
                        y: ret * 100,
                        z: 20,
                        sharpe,
                        weights: wMap,
                        composition: wMap,
                    };
                };

                const wRaw = activeAssets.map((a) => weights[a] ?? 0);
                const wSum = wRaw.reduce((a, b) => a + b, 0) || 1;
                const wCur = wRaw.map((w) => w / wSum);
                const curPoint = { ...statsToPoint("Original Portfolio", wCur), z: 100 };
                setCurrentPoint(curPoint);

                const sims: FrontierPoint[] = [];
                const maxConstraints = activeAssets.map(a => (constraints[a] ?? 100) / 100);

                for (let i = 0; i < simCount; i++) {
                    let w: number[] = [];
                    let valid = false;
                    let attempts = 0;

                    while (!valid && attempts < 100) {
                        const rands = new Array(activeAssets.length).fill(0).map(() => Math.random());
                        const s = rands.reduce((a, b) => a + b, 0) || 1;
                        w = rands.map((x) => x / s);

                        valid = true;
                        for (let j = 0; j < w.length; j++) {
                            if (w[j] > maxConstraints[j] + 0.0001) { 
                                valid = false;
                                break;
                            }
                        }
                        attempts++;
                    }

                    if (valid) {
                        sims.push(statsToPoint("Simulated", w));
                    }
                }

                if (sims.length === 0) {
                    console.warn("No valid portfolios found with current constraints.");
                }

                const sorted = [...sims].sort((a, b) => a.x - b.x);
                const fr: FrontierPoint[] = [];
                let best = -Infinity;
                for (const p of sorted) {
                    if (p.y > best) {
                        fr.push({ ...p, label: "Efficient Frontier", z: 30 });
                        best = p.y;
                    }
                }

                const bestCagr = sims.reduce((best, p) => (p.y > best.y ? p : best), sims[0]);
                const bestSharpe = sims.reduce((best, p) => (p.sharpe > best.sharpe ? p : best), sims[0]);
                const minRisk = sims.reduce((best, p) => (p.x < best.x ? p : best), sims[0]);

                const betterSims = sims.filter(p => p.y > curPoint.y && p.x < curPoint.x)
                    .sort((a, b) => b.y - a.y)
                    .slice(0, 3);
                setTopSimulations(betterSims);

                const displaySims = sims.length > 1000
                    ? sims.sort(() => 0.5 - Math.random()).slice(0, 1000)
                    : sims;

                setPoints(displaySims);
                setFrontier(fr);

                const newHighlights = [];
                if (bestCagr) newHighlights.push({ ...bestCagr, label: "Highest CAGR", z: 80 });
                if (bestSharpe) newHighlights.push({ ...bestSharpe, label: "Highest Sharpe", z: 80 });
                if (minRisk) newHighlights.push({ ...minRisk, label: "Lowest Risk", z: 80 });

                setHighlights(newHighlights);
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

        const stats = getStrategyStats(
            normalized,
            assetRets,
            10,
            rf,
            investmentMode,
            initialInvestment,
            monthlyInvestment,
            useRollingStats
        );

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

        const weightsObj = activeAssets.reduce((acc, asset, i) => {
            acc[asset] = normalized[i];
            return acc;
        }, {} as Record<string, number>);

        return {
            label: "Interactive",
            vol: vol * 100,
            ret: ret * 100,
            x: vol * 100,
            y: ret * 100,
            z: 90,
            sharpe,
            weights: weightsObj,
            composition: weightsObj,
        };
    }, [means, cov, activeAssets, rf, useRollingStats, assetRets, investmentMode, initialInvestment, monthlyInvestment]);

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

            const raw = entries.map(([asset, w]) => ({
                asset,
                val: (w / sum) * 100
            }));

            const rounded = raw.map(item => ({
                asset: item.asset,
                val: Math.floor(item.val)
            }));

            const currentSum = rounded.reduce((a, b) => a + b.val, 0);
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

        const vols = allPoints.map(p => p.x);
        const rets = allPoints.map(p => p.y);

        const minVol = Math.min(...vols);
        const maxVol = Math.max(...vols);
        const minRet = Math.min(...rets);
        const maxRet = Math.max(...rets);

        const xPad = (maxVol - minVol) * 0.1 || 1;
        const yPad = (maxRet - minRet) * 0.1 || 1;

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
            ...points.map((p) => [p.label, p.x.toFixed(4), p.y.toFixed(4), p.sharpe.toFixed(6)]),
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
        <Card className="col-span-4 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                    <CardTitle className="text-xl font-bold">Efficient Frontier</CardTitle>
                    <CardDescription>
                        Explore the risk/return spectrum through random simulation ({assetCount} assets).
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 gap-1.5">
                                <Settings className="h-3.5 w-3.5" />
                                Simulation
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-4" align="end">
                            <div className="grid gap-5">
                                <div className="space-y-1">
                                    <h4 className="font-semibold leading-none">Simulation Parameters</h4>
                                    <p className="text-[11px] text-muted-foreground">
                                        Customize the Monte Carlo engine and asset limits.
                                    </p>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <Label htmlFor="sim-count" className="text-xs font-medium">Sample Size</Label>
                                        <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{simCount} sims</span>
                                    </div>
                                    <Slider
                                        id="sim-count"
                                        min={500}
                                        max={10000}
                                        step={500}
                                        value={[simCount]}
                                        onValueChange={(vals) => setSimCount(vals[0])}
                                        className="py-1"
                                    />
                                </div>
                                <div className="space-y-3 border-t pt-3">
                                    <div className="flex items-center gap-1.5">
                                        <Label className="text-xs font-semibold">Asset Constraints (%)</Label>
                                        <TooltipProvider>
                                            <UITooltip>
                                                <TooltipTrigger>
                                                    <Info className="h-3 w-3 text-muted-foreground" />
                                                </TooltipTrigger>
                                                <TooltipContent className="max-w-[200px] text-[10px]">
                                                    Maximum weight allowed for each asset in simulations.
                                                </TooltipContent>
                                            </UITooltip>
                                        </TooltipProvider>
                                    </div>
                                    <div className="grid gap-2.5 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                                        {activeAssets.map((asset) => (
                                            <div key={asset} className="flex items-center gap-3">
                                                <Label htmlFor={`constraint-${asset}`} className="text-[10px] flex-1 truncate text-muted-foreground" title={asset}>
                                                    {asset}
                                                </Label>
                                                <div className="flex items-center gap-1 w-16 shrink-0">
                                                    <Input
                                                        id={`constraint-${asset}`}
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        className="h-7 text-[10px] px-1.5"
                                                        value={constraints[asset] ?? 100}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value);
                                                            setConstraints(prev => ({
                                                                ...prev,
                                                                [asset]: isNaN(val) ? 100 : Math.max(0, Math.min(100, val))
                                                            }));
                                                        }}
                                                    />
                                                    <span className="text-[9px] text-muted-foreground">%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-2 border-t pt-3">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="flex-1 text-[11px] h-8"
                                        onClick={() => setConstraints({})}
                                    >
                                        Reset Limits
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="flex-1 text-[11px] h-8 shadow-sm"
                                        onClick={compute}
                                    >
                                        Run Simulation
                                    </Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <div className="flex items-center space-x-2 mr-2 bg-muted/50 px-2 py-1 rounded-md border border-border/50">
                        <Switch id="rolling-stats" checked={useRollingStats} onCheckedChange={setUseRollingStats} className="scale-75 origin-right" />
                        <Label htmlFor="rolling-stats" className="text-[10px] font-medium whitespace-nowrap cursor-pointer">10y Rolling</Label>
                    </div>
                    <Button variant="outline" size="sm" onClick={downloadCSV} disabled={points.length === 0} className="h-8 w-8 p-0">
                        <Download className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pt-2">
                {points.length > 0 && activeAssets.length > 0 && (
                    <div className="mb-6">
                        <div 
                            className="mb-3 flex items-center justify-between px-2 cursor-pointer hover:bg-muted/50 rounded-md py-1 transition-colors"
                            onClick={() => setIsInteractiveExpanded(!isInteractiveExpanded)}
                        >
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Interactive Portfolio Locator</div>
                                {isInteractiveExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                            </div>
                            {isInteractiveExpanded && (
                                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                    <Button variant="outline" size="sm" onClick={normalizeWeights} className="h-7 text-[10px] px-2 font-medium">
                                        Normalize Weights
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={resetWeights} className="h-7 text-[10px] px-2 text-muted-foreground hover:text-foreground">
                                        <RotateCcw className="h-3 w-3 mr-1" />
                                        Reset
                                    </Button>
                                </div>
                            )}
                        </div>
                        {isInteractiveExpanded && (
                            <>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 px-2">
                                    {activeAssets.map(asset => {
                                        const value = (interactiveWeights[asset] || 0) * 100;
                                        return (
                                            <div key={asset} className="rounded-lg border bg-muted/20 p-3 transition-colors hover:bg-muted/30">
                                                <div className="mb-2 flex items-center justify-between">
                                                    <div className="text-[11px] font-medium truncate text-muted-foreground pr-2" title={asset}>{asset}</div>
                                                    <div className="text-xs font-bold text-primary tabular-nums">{Math.round(value)}%</div>
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
                                    <div className="mt-4 mx-2 rounded-lg bg-orange-50/50 dark:bg-orange-950/10 border border-orange-100 dark:border-orange-900/30 p-3 text-sm">
                                        <div className="flex flex-wrap items-center justify-between gap-4">
                                            <div className="text-[11px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest">Interactive Result</div>
                                            <div className="flex gap-6">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-muted-foreground uppercase tracking-tighter">Exp. Return</span>
                                                    <span className="text-sm font-bold tabular-nums">{interactivePoint.ret.toFixed(2)}%</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-muted-foreground uppercase tracking-tighter">Annual Risk</span>
                                                    <span className="text-sm font-bold tabular-nums">{interactivePoint.vol.toFixed(2)}%</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-muted-foreground uppercase tracking-tighter">Sharpe Ratio</span>
                                                    <span className="text-sm font-bold tabular-nums">{interactivePoint.sharpe.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                <div className="h-[400px] w-full mt-2 border rounded-xl bg-muted/5 p-2 relative">
                    {points.length === 0 || !currentPoint ? (
                        <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
                            {isLoading ? (
                                <>
                                    <Spinner size="lg" className="text-primary" />
                                    <div className="text-sm font-medium animate-pulse uppercase tracking-widest">Generating Frontier...</div>
                                </>
                            ) : (
                                <>
                                    <div className="text-center max-w-[280px]">
                                        <div className="mb-4 flex justify-center">
                                            <div className="rounded-full bg-muted p-4">
                                                <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
                                            </div>
                                        </div>
                                        <p className="text-sm mb-6 leading-relaxed">Ready to simulate thousands of portfolios to find the efficient frontier.</p>
                                        <Button onClick={compute} disabled={!canCompute} size="lg" className="w-full shadow-lg">
                                            Initialize Simulation
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="relative h-full w-full">
                            {isLoading && (
                                <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-[1px] rounded-lg">
                                    <div className="flex flex-col items-center gap-3">
                                        <Spinner size="md" className="text-primary" />
                                        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Recomputing...</span>
                                    </div>
                                </div>
                            )}
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart 
                                    margin={{ top: 20, right: 30, bottom: 30, left: 30 }}
                                    style={{ outline: 'none' }} 
                                    onClick={() => closeTooltip()}
                                >
                                    <defs>
                                        <style>{`
                                            .recharts-surface:focus { outline: none !important; }
                                            .recharts-layer:focus { outline: none !important; }
                                            path:focus { outline: none !important; }
                                        `}</style>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.1} />
                                    <XAxis
                                        type="number"
                                        dataKey="x"
                                        stroke="hsl(var(--muted-foreground))"
                                        fontSize={11}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                                        name="Risk"
                                        label={{ value: "Risk (Annualized Volatility)", position: "insideBottom", offset: -15, fontSize: 10, fontWeight: 500, fill: "hsl(var(--muted-foreground))" }}
                                        domain={xDomain}
                                        allowDataOverflow
                                    />
                                    <YAxis
                                        type="number"
                                        dataKey="y"
                                        stroke="hsl(var(--muted-foreground))"
                                        fontSize={11}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                                        name="Return"
                                        label={{ value: "Expected Return (CAGR)", angle: -90, position: "insideLeft", offset: 10, fontSize: 10, fontWeight: 500, fill: "hsl(var(--muted-foreground))" }}
                                        domain={yDomain}
                                        allowDataOverflow
                                    />
                                    <ZAxis type="number" range={[20, 120]} />
                                    <Tooltip
                                        active={tooltipState.active}
                                        position={{ x: 0, y: 0 }}
                                        cursor={false}
                                        content={
                                            <CustomTooltip
                                                active={tooltipState.active}
                                                payload={tooltipState.payload}
                                                highlights={highlights}
                                                currentPoint={currentPoint}
                                                interactivePoint={interactivePoint}
                                                saveCustomPortfolio={saveCustomPortfolio}
                                                onClose={closeTooltip}
                                            />
                                        }
                                    />
                                    <Legend
                                        layout={isMobile ? "horizontal" : "vertical"}
                                        align={isMobile ? "center" : "right"}
                                        verticalAlign={isMobile ? "bottom" : "middle"}
                                        onClick={handleLegendClick}
                                        iconType="circle"
                                        iconSize={8}
                                        wrapperStyle={{
                                            cursor: 'pointer',
                                            userSelect: 'none',
                                            paddingLeft: isMobile ? '0' : '30px',
                                            paddingTop: isMobile ? '10px' : '0',
                                            fontSize: '10px',
                                            fontWeight: 500,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em'
                                        }}
                                    />
                                    <Scatter
                                        name="Simulated"
                                        data={points}
                                        fill="hsl(var(--muted-foreground))"
                                        opacity={0.3}
                                        legendType="none"
                                        hide={focusedSeries !== null}
                                        onClick={handlePointClick}
                                    />
                                    <Scatter
                                        name="Frontier"
                                        data={frontier}
                                        fill="hsl(var(--primary))"
                                        line={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '4 4' }}
                                        legendType="none"
                                        hide={focusedSeries !== null}
                                        onClick={handlePointClick}
                                    />
                                    {interactivePoint && (
                                        <Scatter
                                            name={`Locator (${interactivePoint.ret.toFixed(1)}%)`}
                                            data={[interactivePoint]}
                                            fill="#f97316"
                                            shape="circle"
                                            legendType="none"
                                            hide={focusedSeries !== null}
                                            onClick={handlePointClick}
                                        />
                                    )}
                                    <Scatter
                                        name={`Current Portfolio (${currentPoint.ret.toFixed(1)}%)`}
                                        data={[currentPoint]}
                                        fill="#ef4444"
                                        shape="diamond"
                                        z={100}
                                        hide={focusedSeries !== null && focusedSeries !== `Current Portfolio (${currentPoint.ret.toFixed(1)}%)`}
                                        onClick={handlePointClick}
                                    />
                                    <Scatter
                                        name={(() => {
                                            const p = highlights.find((h) => h.label === "Highest CAGR");
                                            return p ? `Max CAGR (${p.ret.toFixed(1)}%)` : "Max CAGR";
                                        })()}
                                        data={highlights.filter((p) => p.label === "Highest CAGR")}
                                        fill="#22c55e"
                                        hide={focusedSeries !== null && !focusedSeries.includes("Max CAGR")}
                                        onClick={handlePointClick}
                                    />
                                    <Scatter
                                        name={(() => {
                                            const p = highlights.find((h) => h.label === "Highest Sharpe");
                                            return p ? `Max Sharpe (${p.ret.toFixed(1)}%)` : "Max Sharpe";
                                        })()}
                                        data={highlights.filter((p) => p.label === "Highest Sharpe")}
                                        fill="#a855f7"
                                        hide={focusedSeries !== null && !focusedSeries.includes("Max Sharpe")}
                                        onClick={handlePointClick}
                                    />
                                    <Scatter
                                        name={(() => {
                                            const p = highlights.find((h) => h.label === "Lowest Risk");
                                            return p ? `Min Risk (${p.ret.toFixed(1)}%)` : "Min Risk";
                                        })()}
                                        data={highlights.filter((p) => p.label === "Lowest Risk")}
                                        fill="#f59e0b"
                                        hide={focusedSeries !== null && !focusedSeries.includes("Min Risk")}
                                        onClick={handlePointClick}
                                    />
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {topSimulations.length > 0 && (
                    <div className="mt-8 px-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="bg-green-100 dark:bg-green-900/30 p-1.5 rounded-md">
                                    <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                                </div>
                                <div className="flex flex-col">
                                    <h4 className="text-sm font-bold">Optimized Simulation Candidates</h4>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Better performance than current allocation</p>
                                </div>
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                            {topSimulations.map((sim, idx) => (
                                <div key={idx} className="relative rounded-xl border border-border/60 bg-gradient-to-br from-card to-muted/20 p-4 transition-all hover:shadow-md hover:border-primary/20 group">
                                    <div className="absolute -right-2 -top-2 p-3 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                                        <ShieldCheck className="h-16 w-16 text-primary rotate-12" />
                                    </div>
                                    <div className="mb-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="text-[10px] font-black h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                                                {idx + 1}
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Proposal</span>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="h-7 w-7 p-0 rounded-full bg-background/50 backdrop-blur-sm shadow-sm"
                                            onClick={() => {
                                                const name = prompt("Enter a name for this optimized portfolio:", `Optimized Candidate ${idx + 1}`);
                                                if (name) saveCustomPortfolio(name, sim.weights);
                                            }}
                                            title="Save Candidate"
                                        >
                                            <Save className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">CAGR</span>
                                            <span className="text-base font-black text-green-600 dark:text-green-400 tabular-nums">+{sim.ret.toFixed(2)}%</span>
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">Risk</span>
                                            <span className="text-base font-black text-blue-600 dark:text-blue-400 tabular-nums">{sim.vol.toFixed(2)}%</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 pt-3 border-t border-border/40">
                                        <span className="text-[9px] text-muted-foreground font-bold uppercase block tracking-tighter">Allocation Strategy</span>
                                        <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                                            {Object.entries(sim.composition)
                                                .sort(([, a], [, b]) => b - a)
                                                .filter(([, w]) => w > 0.0001)
                                                .map(([asset, weight]) => (
                                                    <div key={asset} className="flex justify-between text-[10px] items-center">
                                                        <span className="truncate pr-2 text-muted-foreground font-medium" title={asset}>{asset}</span>
                                                        <span className="font-mono bg-background px-1 rounded border border-border/50">{(weight * 100).toFixed(0)}%</span>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
