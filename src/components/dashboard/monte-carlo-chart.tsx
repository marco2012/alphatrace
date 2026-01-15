"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    Legend,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { NormalizedData, getAssetCategory, runMonteCarlo, findOptimalWeights, pctChangeSeries, computePortfolio, OptimizationType } from "@/lib/finance";
import { Badge } from "@/components/ui/badge";

type MonteCarloChartProps = {
    norm: NormalizedData | null;
    weights: Record<string, number>;
    startDate: string;
    endDate: string;
    rf?: number;
    initialInvestment: number;
    currency?: "EUR" | "USD";
};

export function MonteCarloChart({ norm, weights, startDate, endDate, rf = 0.02, initialInvestment, currency = "EUR" }: MonteCarloChartProps) {
    const [years, setYears] = useState(10);
    const [isLoading, setIsLoading] = useState(false);
    const [simulationData, setSimulationData] = useState<any[]>([]);
    const [optimalData, setOptimalData] = useState<any[]>([]);
    const [optimalWeights, setOptimalWeights] = useState<Record<string, number> | null>(null);
    const [showOptimal, setShowOptimal] = useState(false);
    const [strategy, setStrategy] = useState<OptimizationType>("max_sharpe");

    const currencySymbol = currency === "USD" ? "$" : "€";

    const { availableAssets, canCompute } = useMemo(() => {
        if (!norm) return { availableAssets: [] as string[], canCompute: false };
        // Use all available assets that have data in the series
        const allAssets = Object.keys(norm.series);
        return { availableAssets: allAssets, canCompute: allAssets.length >= 1 };
    }, [norm]);

    const runSim = async () => {
        if (!norm || !canCompute) return;
        setIsLoading(true);

        // Run in timeout to prevent UI freeze
        setTimeout(() => {
            const dates = norm.dates;
            const i0 = dates.findIndex((d) => d >= startDate);
            const i1 = dates.findIndex((d) => d >= (endDate || dates[dates.length - 1]));
            const endIdx = i1 === -1 ? dates.length - 1 : i1;

            // 1. Current Portfolio historical rets
            const currentRes = computePortfolio(
                norm.dates.slice(i0, endIdx + 1),
                norm.series,
                weights,
                "Annual",
                initialInvestment
            );

            const paths = runMonteCarlo(currentRes.portRets, initialInvestment, years, 10000);
            setSimulationData(paths);

            // 2. Find Optimal Portfolio
            // Filter to assets that actually have valid data in the selected range
            const validOptimizationAssets = availableAssets.filter(a => {
                const s = norm.series[a] as number[];
                // Check if asset has valid data at start and end of range (approx check for sufficiency)
                return s[i0] !== null && s[endIdx] !== null;
            });

            if (validOptimizationAssets.length >= 2) {
                const slicedSeries = validOptimizationAssets.map((a) => (norm.series[a] as number[]).slice(i0, endIdx + 1));
                const rets = slicedSeries.map((s) => pctChangeSeries(s));

                const means = rets.map((r) => r.reduce((a, b) => a + b, 0) / r.length);
                const covariance = (a: number[], b: number[], ma: number, mb: number) => {
                    const n = a.length;
                    let s = 0;
                    for (let i = 0; i < n; i++) s += (a[i] - ma) * (b[i] - mb);
                    return s / (n - 1);
                };
                const cov = rets.map((ri, i) => rets.map((rj, j) => covariance(ri, rj, means[i], means[j])));

                // Increase sims to 10000 or 20000 for better convergence with larger asset universe
                const optW = findOptimalWeights(validOptimizationAssets, means, cov, rf, strategy, 25000);
                setOptimalWeights(optW);

                const optRes = computePortfolio(
                    norm.dates.slice(i0, endIdx + 1),
                    norm.series,
                    optW,
                    "Annual",
                    initialInvestment
                );
                const optPaths = runMonteCarlo(optRes.portRets, initialInvestment, years, 10000);
                setOptimalData(optPaths);
            } else {
                setOptimalWeights(null);
                setOptimalData([]);
            }

            setIsLoading(false);
        }, 100);
    };

    useEffect(() => {
        if (canCompute) {
            runSim();
        }
    }, [norm, weights, years, startDate, endDate, initialInvestment, strategy]);

    const chartData = useMemo(() => {
        if (!simulationData.length) return [];
        return simulationData.map((d, i) => {
            const row: any = {
                date: d.date,
                p10: d.p10,
                p25: d.p25,
                p50: d.p50,
                p75: d.p75,
                p90: d.p90,
            };
            if (showOptimal && optimalData[i]) {
                row.opt_p10 = optimalData[i].p10;
                row.opt_p50 = optimalData[i].p50;
                row.opt_p90 = optimalData[i].p90;
            }
            return row;
        });
    }, [simulationData, optimalData, showOptimal]);

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat(currency === "USD" ? "en-US" : "it-IT", { style: "currency", currency: currency, maximumFractionDigits: 0 }).format(v);

    const calcCAGR = (finalVal: number) => {
        if (initialInvestment <= 0 || years <= 0) return 0;
        return (Math.pow(finalVal / initialInvestment, 1 / years) - 1) * 100;
    };

    return (
        <Card className="col-span-4">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Monte Carlo Simulation</CardTitle>
                        <CardDescription>
                            10,000 simulated outcomes for the next {years} years based on historical performance.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Years:</span>
                            <Input
                                type="number"
                                value={years}
                                onChange={(e) => setYears(Math.max(1, Math.min(50, Number(e.target.value))))}
                                className="w-20 h-8"
                            />
                        </div>
                        <Button
                            variant={showOptimal ? "default" : "outline"}
                            size="sm"
                            onClick={() => setShowOptimal(!showOptimal)}
                            disabled={!optimalWeights}
                        >
                            {showOptimal ? "Hide Optimized" : "Show Optimized"}
                        </Button>
                    </div>
                </div>
                {norm && Object.keys(norm.series).length >= 2 && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider w-full mb-1">Optimization Strategy</span>
                        {[
                            { id: "max_sharpe", label: "Max Sharpe", desc: "Best risk-adjusted return" },
                            { id: "max_cagr", label: "Max Return", desc: "Maximum growth potential" },
                            { id: "min_vol", label: "Min Volatility", desc: "Safest, lowest risk" },
                            { id: "balanced", label: "Balanced", desc: "Mix of growth and safety" },
                        ].map((s) => (
                            <Button
                                key={s.id}
                                variant={strategy === s.id ? "default" : "outline"}
                                size="sm"
                                onClick={() => setStrategy(s.id as OptimizationType)}
                                className="h-8 text-xs px-3"
                                title={s.desc}
                            >
                                {s.label}
                            </Button>
                        ))}
                    </div>
                )}
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="h-[400px] flex flex-col items-center justify-center gap-4">
                        <Spinner size="lg" />
                        <span className="text-muted-foreground text-sm">Running 10,000 simulations...</span>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorP50" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                        </linearGradient>
                                        {showOptimal && (
                                            <linearGradient id="colorOptP50" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ea580c" stopOpacity={0.1} />
                                                <stop offset="95%" stopColor="#ea580c" stopOpacity={0} />
                                            </linearGradient>
                                        )}
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis
                                        dataKey="date"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        stroke="#888888"
                                    />
                                    <YAxis
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        stroke="#888888"
                                        tickFormatter={(v) => `${currencySymbol}${(v / 1000).toFixed(0)}k`}
                                    />
                                    <Tooltip
                                        formatter={(value: number) => formatCurrency(value)}
                                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--card-foreground))" }}
                                    />
                                    <Legend />

                                    {/* Current Portfolio Range */}
                                    <Area
                                        type="monotone"
                                        dataKey="p90"
                                        stroke="none"
                                        fill="#4f46e5"
                                        fillOpacity={0.1}
                                        name="Top 10% (Best Case)"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="p10"
                                        stroke="none"
                                        fill="#4f46e5"
                                        fillOpacity={0.1}
                                        name="Bottom 10% (Worst Case)"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="p50"
                                        stroke="#4f46e5"
                                        strokeWidth={3}
                                        fill="url(#colorP50)"
                                        name="Median Outcome"
                                    />

                                    {/* Optimized Portfolio Median */}
                                    {showOptimal && (
                                        <Area
                                            type="monotone"
                                            dataKey="opt_p50"
                                            stroke="#ea580c"
                                            strokeWidth={3}
                                            strokeDasharray="5 5"
                                            fill="url(#colorOptP50)"
                                            name="Optimized Median"
                                        />
                                    )}
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold">Outcome Probability</h3>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Worst Case (10th Percentile):</span>
                                        <div className="text-right">
                                            <div className="font-mono font-medium">{simulationData.length > 0 ? formatCurrency(simulationData[simulationData.length - 1].p10) : "-"}</div>
                                            <div className="text-[10px] text-muted-foreground">CAGR: {simulationData.length > 0 ? calcCAGR(simulationData[simulationData.length - 1].p10).toFixed(2) : "-"}%</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Median Case (50th Percentile):</span>
                                        <div className="text-right">
                                            <div className="font-mono font-medium text-indigo-600">{simulationData.length > 0 ? formatCurrency(simulationData[simulationData.length - 1].p50) : "-"}</div>
                                            <div className="text-[10px] text-indigo-400 font-medium">CAGR: {simulationData.length > 0 ? calcCAGR(simulationData[simulationData.length - 1].p50).toFixed(2) : "-"}%</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Best Case (90th Percentile):</span>
                                        <div className="text-right">
                                            <div className="font-mono font-medium">{simulationData.length > 0 ? formatCurrency(simulationData[simulationData.length - 1].p90) : "-"}</div>
                                            <div className="text-[10px] text-muted-foreground">CAGR: {simulationData.length > 0 ? calcCAGR(simulationData[simulationData.length - 1].p90).toFixed(2) : "-"}%</div>
                                        </div>
                                    </div>
                                </div>
                                {showOptimal && optimalData.length > 0 && (
                                    <div className="pt-2 border-t mt-2 space-y-2">
                                        <div className="flex items-center justify-between text-sm text-orange-600 font-medium">
                                            <span>Optimized Median:</span>
                                            <div className="text-right">
                                                <div className="font-mono">{formatCurrency(optimalData[optimalData.length - 1].p50)}</div>
                                                <div className="text-[10px]">CAGR: {calcCAGR(optimalData[optimalData.length - 1].p50).toFixed(2)}%</div>
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            The optimized portfolio projects a {(((optimalData[optimalData.length - 1].p50 / simulationData[simulationData.length - 1].p50) - 1) * 100).toFixed(1)}% improvement in median final wealth.
                                        </div>
                                    </div>
                                )}
                            </div>

                            {optimalWeights && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-semibold">Suggested Best Allocation</h3>
                                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100 capitalize">
                                            {strategy.replace("_", " ")}
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                        {Object.entries(optimalWeights)
                                            .filter(([, w]) => w > 0.005)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([asset, weight]) => (
                                                <div key={asset} className="flex items-center justify-between text-sm">
                                                    <span className="truncate mr-2" title={asset}>{asset}</span>
                                                    <span className="font-mono font-medium">{(weight * 100).toFixed(1)}%</span>
                                                </div>
                                            ))}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        {strategy === "max_sharpe" && "This allocation maximizes the expected return per unit of risk based on the Sharpe Ratio."}
                                        {strategy === "max_cagr" && "This allocation focuses purely on maximizing historical growth, regardless of volatility."}
                                        {strategy === "min_vol" && "This allocation minimizes historical volatility, prioritizing stability over returns."}
                                        {strategy === "balanced" && "This allocation seeks a balance between strong risk-adjusted returns and low volatility."}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
