"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Download } from "lucide-react";
import { NormalizedData, getAssetCategory, pctChangeSeries } from "@/lib/finance";

type FrontierPoint = {
    vol: number;
    ret: number;
    sharpe: number;
    weights: Record<string, number>;
    composition: Record<string, number>;
    label: string;
};

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

export function EfficientFrontierChart({ norm, weights, startDate, endDate, rf = 0.02 }: EfficientFrontierChartProps) {
    const [points, setPoints] = useState<FrontierPoint[]>([]);
    const [frontier, setFrontier] = useState<FrontierPoint[]>([]);
    const [highlights, setHighlights] = useState<FrontierPoint[]>([]);
    const [currentPoint, setCurrentPoint] = useState<FrontierPoint | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setPoints([]);
        setFrontier([]);
        setHighlights([]);
        setCurrentPoint(null);
    }, [norm, weights, startDate, endDate, rf]);

    const { activeAssets, assetCount, canCompute } = useMemo(() => {
        if (!norm) return { activeAssets: [] as string[], assetCount: 0, canCompute: false };
        const activeAssets = Object.entries(weights)
            .filter(([, w]) => (w ?? 0) > 0)
            .map(([k]) => k)
            .filter((k) => norm.series[k] != null);
        const assetCount = activeAssets.length;
        return { activeAssets, assetCount, canCompute: assetCount >= 2 };
    }, [norm, weights]);

    const compute = async () => {
        if (!norm) return;
        if (activeAssets.length < 2) return;

        setIsLoading(true);

        try {
            const dates = norm.dates;
            const lastDate = endDate || dates[dates.length - 1];
            const i0 = dates.findIndex((d) => d >= startDate);
            const i1 = dates.findIndex((d) => d >= lastDate);
            const endIdx = i1 === -1 ? dates.length - 1 : i1;

            const slicedSeries = activeAssets.map((a) => (norm.series[a] as number[]).slice(i0, endIdx + 1));
            const rets = slicedSeries.map((s) => pctChangeSeries(s));
            const n = rets[0]?.length || 0;
            if (n < 12) return;

            const means = rets.map((r) => mean(r));
            const cov = rets.map((ri, i) => rets.map((rj, j) => covariance(ri, rj, means[i], means[j])));

            const buildComposition = (wVec: number[]) => {
                const comp: Record<string, number> = {};
                for (let i = 0; i < activeAssets.length; i++) {
                    const cat = getAssetCategory(activeAssets[i]) || "stocks";
                    comp[cat] = (comp[cat] || 0) + (wVec[i] || 0);
                }
                return comp;
            };

            const buildWeightsMap = (wVec: number[]) => {
                const out: Record<string, number> = {};
                for (let i = 0; i < activeAssets.length; i++) out[activeAssets[i]] = wVec[i] || 0;
                return out;
            };

            const statsToPoint = (label: string, wVec: number[]) => {
                const st = portfolioStats(wVec, means, cov);
                const vol = st.annualVol;
                const ret = st.annualReturn;
                const sharpe = vol > 0 ? (ret - rf) / vol : 0;
                return {
                    label,
                    vol: vol * 100,
                    ret: ret * 100,
                    sharpe,
                    weights: buildWeightsMap(wVec),
                    composition: buildComposition(wVec),
                };
            };

            const wRaw = activeAssets.map((a) => weights[a] ?? 0);
            const wSum = wRaw.reduce((a, b) => a + b, 0) || 1;
            const wCur = wRaw.map((w) => w / wSum);
            const curPoint = statsToPoint("My Portfolio", wCur);
            setCurrentPoint(curPoint);

            const SIMS = 2000;
            const sims: FrontierPoint[] = [];
            for (let k = 0; k < SIMS; k++) {
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
                    fr.push(p);
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
    };

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
                    <Button variant="outline" size="sm" onClick={compute} disabled={!canCompute || isLoading}>
                        {isLoading ? <Spinner size="sm" className="mr-2" /> : null}
                        Compute
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadCSV} disabled={points.length === 0}>
                        <Download className="mr-2 h-4 w-4" /> CSV
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pl-2">
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
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--card-foreground))" }}
                                    itemStyle={{ color: "hsl(var(--foreground))" }}
                                    content={({ active, payload }: any) => {
                                        if (!active || !payload?.length) return null;
                                        const p = payload[0]?.payload as FrontierPoint;
                                        if (!p) return null;
                                        const comp = Object.entries(p.composition || {})
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([k, v]) => `${k}: ${(v * 100).toFixed(0)}%`)
                                            .join(" • ");
                                        return (
                                            <div className="rounded-md border bg-card p-2 text-card-foreground shadow-sm">
                                                <div className="text-sm font-medium">{p.label}</div>
                                                <div className="text-xs text-muted-foreground">CAGR: {p.ret.toFixed(2)}%</div>
                                                <div className="text-xs text-muted-foreground">Sharpe: {p.sharpe.toFixed(2)}</div>
                                                <div className="text-xs text-muted-foreground">Risk: {p.vol.toFixed(2)}%</div>
                                                <div className="mt-1 text-xs text-muted-foreground">{comp}</div>
                                            </div>
                                        );
                                    }}
                                />
                                <Legend />
                                <Scatter name="Simulated" data={points} fill="#94a3b8" />
                                <Scatter name="Frontier" data={frontier} fill="#3b82f6" />
                                <Scatter name="My Portfolio" data={[currentPoint]} fill="#ef4444" />
                                <Scatter
                                    name="Highest CAGR"
                                    data={highlights.filter((p) => p.label === "Highest CAGR")}
                                    fill="#22c55e"
                                />
                                <Scatter
                                    name="Highest Sharpe"
                                    data={highlights.filter((p) => p.label === "Highest Sharpe")}
                                    fill="#a855f7"
                                />
                                <Scatter
                                    name="Lowest Risk"
                                    data={highlights.filter((p) => p.label === "Lowest Risk")}
                                    fill="#f59e0b"
                                />
                            </ScatterChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
