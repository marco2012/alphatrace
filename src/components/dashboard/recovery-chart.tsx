"use client";

import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { PortfolioResult } from "@/lib/finance";
import { useMemo } from "react";

interface TimeToRecoveryChartProps {
    portfolio: PortfolioResult | null;
}

export function TimeToRecoveryChart({ portfolio }: TimeToRecoveryChartProps) {
    const data = useMemo(() => {
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

    }, [portfolio]);

    if (!portfolio) return null;

    const downloadCSV = () => {
        const csv = [
            ['Drawdown Start', 'Recovery End', 'Recovery Time (Months)', 'Max Drawdown (%)'],
            ...data.map(row => [row.start, row.end, row.recoveryTimeMonths, row.depth.toFixed(2)])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'recovery-times.csv';
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
                    <Download className="mr-2 h-4 w-4" /> CSV
                </Button>
            </CardHeader>
            <CardContent className="pl-2">
                <div className="h-[250px] w-full">
                    {data.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                            No major drawdowns detected.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data}>
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
