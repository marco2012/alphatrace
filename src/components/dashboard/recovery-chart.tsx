"use client";

import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { PortfolioResult, timeToRecoverFromIndex } from "@/lib/finance";
import { useMemo } from "react";

interface TimeToRecoveryChartProps {
    portfolio: PortfolioResult | null;
    items?: Array<{ name: string; color?: string; result: PortfolioResult | null }>;
}

export function TimeToRecoveryChart({ portfolio, items }: TimeToRecoveryChartProps) {
    const isComparison = !!(items && items.length > 1);

    const comparisonData = useMemo(() => {
        if (!isComparison || !items) return [];

        // Build yearly dataset: one row per drawdown start year.
        // For each item, use the max recovery time (months) among episodes starting in that year.
        const perItemByYear: Record<string, Record<string, number>> = {};
        const yearsSet = new Set<string>();

        for (const i of items) {
            if (!i.result) continue;
            const recoveries = timeToRecoverFromIndex(i.result.idxMap);
            const byYear: Record<string, number> = {};

            for (const r of recoveries) {
                if (!r.date) continue;
                const year = new Date(r.date).getFullYear().toString();
                yearsSet.add(year);
                byYear[year] = Math.max(byYear[year] ?? 0, r.months);
            }

            perItemByYear[i.name] = byYear;
        }

        const years = Array.from(yearsSet).sort((a, b) => Number(a) - Number(b));
        return years.map((year) => {
            const row: Record<string, any> = { year };
            for (const i of items) {
                row[i.name] = perItemByYear[i.name]?.[year] ?? 0;
            }
            return row;
        });
    }, [isComparison, items]);

    const episodeData = useMemo(() => {
        if (isComparison) return [];
        if (!portfolio || !portfolio.drawdowns.length) return [];

        const dates = Object.keys(portfolio.idxMap).sort();
        const prices = dates.map(d => portfolio.idxMap[d]);

        const episodes = [];
        let peak = prices[0];
        let peakIndex = 0;

        let inDrawdown = false;
        let ddStartIndex = 0;
        let maxDDInEpisode = 0;

        for (let i = 0; i < prices.length; i++) {
            if (prices[i] > peak) {
                if (inDrawdown) {
                    // Recovery complete
                    const depth = maxDDInEpisode;
                    // Filter out tiny noise drawdowns (<5%)
                    if (depth > 0.05) {
                        episodes.push({
                            start: dates[ddStartIndex],
                            end: dates[i],
                            recoveryTimeMonths: i - ddStartIndex,
                            depth: depth * 100
                        });
                    }
                    inDrawdown = false;
                    maxDDInEpisode = 0;
                }
                peak = prices[i];
                peakIndex = i;
            } else {
                const dd = (peak - prices[i]) / peak;
                if (dd > 0) {
                    if (!inDrawdown) {
                        inDrawdown = true;
                        ddStartIndex = peakIndex;
                    }
                    maxDDInEpisode = Math.max(maxDDInEpisode, dd);
                }
            }
        }

        return episodes.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    }, [portfolio, isComparison]);

    if (!isComparison && !portfolio) return null;

    const downloadCSV = () => {
        const csv = isComparison
            ? [
                ["Year", ...(items || []).map((i) => i.name)],
                ...comparisonData.map((row: any) => [
                    row.year,
                    ...(items || []).map((i) => String(row[i.name] ?? 0)),
                ]),
            ].map((row) => row.join(",")).join("\n")
            : [
                ["Drawdown Start", "Recovery End", "Recovery Time (Months)", "Max Drawdown (%)"],
                ...episodeData.map((row: any) => [row.start, row.end, row.recoveryTimeMonths, row.depth.toFixed(2)]),
            ].map((row) => row.join(",")).join("\n");

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = isComparison ? 'recovery-times-comparison.csv' : 'recovery-times.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    return (
        <Card className="col-span-4 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                    <CardTitle>Drawdown Recovery Time</CardTitle>
                    <CardDescription>
                        Months to recover from major drawdowns ({">"}5%).
                    </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={downloadCSV}>
                    <Download className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent className="pl-2">
                <div className="h-[250px] w-full">
                    {isComparison ? (
                        comparisonData.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-muted-foreground">
                                No items selected.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={comparisonData}>
                                    <XAxis
                                        dataKey="year"
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        interval={0}
                                    />
                                    <YAxis
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        label={{ value: 'Months', angle: -90, position: 'insideLeft' }}
                                    />
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--card-foreground))' }}
                                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                                        formatter={(value: number, name: string) => [`${value} months`, name]}
                                    />
                                    <Legend />
                                    {(items || []).map((i) => (
                                        <Bar
                                            key={i.name}
                                            dataKey={i.name}
                                            fill={i.color || "#3b82f6"}
                                            radius={[4, 4, 0, 0]}
                                        />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        )
                    ) : episodeData.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                            No major drawdowns detected.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={episodeData}>
                                <XAxis
                                    dataKey="start"
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => {
                                        const d = new Date(value);
                                        return `${d.getFullYear()}`;
                                    }}
                                />
                                <YAxis
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    label={{ value: 'Months', angle: -90, position: 'insideLeft' }}
                                />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--card-foreground))' }}
                                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                                    formatter={(value: number, name: string, props: any) => {
                                        if (name === "recoveryTimeMonths") return [`${value} months`, "Recovery Time"];
                                        return [value, name];
                                    }}
                                    labelFormatter={(label) => `Drawdown started: ${new Date(label).toLocaleDateString()}`}
                                />
                                <Bar dataKey="recoveryTimeMonths" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
