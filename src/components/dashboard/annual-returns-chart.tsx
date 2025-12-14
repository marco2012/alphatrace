"use client";

import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
    Cell
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { PortfolioResult, computeAnnualReturns } from "@/lib/finance";
import { useMemo } from "react";

interface AnnualReturnsChartProps {
    portfolio: PortfolioResult | null;
}

export function AnnualReturnsChart({ portfolio }: AnnualReturnsChartProps) {
    const data = useMemo(() => {
        if (!portfolio) return [];
        const annual = computeAnnualReturns(portfolio.idxMap);
        return annual.map(a => ({
            year: a.year,
            value: a.nominal * 100
        }));
    }, [portfolio]);

    if (!portfolio) return null;

    const downloadCSV = () => {
        const csv = [
            ['Year', 'Annual Return (%)'],
            ...data.map(row => [row.year, (row.value).toFixed(2)])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'annual-returns.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    return (
        <Card className="col-span-4 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                    <CardTitle>Annual Returns</CardTitle>
                    <CardDescription>
                        Year-over-year performance.
                    </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={downloadCSV}>
                    <Download className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent className="pl-2">
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <XAxis
                                dataKey="year"
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${value.toFixed(0)}%`}
                            />
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <RechartsTooltip
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--card-foreground))' }}
                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                                formatter={(value: number) => [`${value.toFixed(2)}%`, "Return"]}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.value >= 0 ? "#22c55e" : "#ef4444"} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
