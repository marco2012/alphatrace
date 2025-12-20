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
import { PortfolioResult, computeAnnualReturns, cagr, cagrRecurring } from "@/lib/finance";
import { useMemo } from "react";

interface AnnualReturnsChartProps {
    portfolio: PortfolioResult | null;
}

export function AnnualReturnsChart({ portfolio }: AnnualReturnsChartProps) {
    const data = useMemo(() => {
        if (!portfolio) return [];

        const hasInvested = portfolio.portValues && portfolio.totalInvested && portfolio.portValues.length === portfolio.dates.length;

        if (hasInvested) {
            const yearMap: Record<string, { endVal?: number; endInv?: number }> = {};
            portfolio.dates.forEach((d, i) => {
                const y = new Date(d).getFullYear().toString();
                // Overwrite to get the last value of the year
                yearMap[y] = {
                    endVal: portfolio.portValues![i],
                    endInv: portfolio.totalInvested![i]
                };
            });

            const years = Object.keys(yearMap).sort();
            const result: { year: number; nominal: number }[] = [];

            let prevVal: number | undefined;
            let prevInv: number | undefined;

            for (const y of years) {
                const { endVal, endInv } = yearMap[y];
                if (endVal === undefined || endInv === undefined) continue;

                if (prevVal !== undefined && prevInv !== undefined) {
                    const netContrib = endInv - prevInv;
                    const denominator = prevVal + netContrib;
                    const ret = denominator > 0 ? (endVal / denominator) - 1 : 0;
                    result.push({ year: parseInt(y), nominal: ret });
                } else {
                    // First Year logic
                    // If we assume start val was 0 ?? or StartInv?
                    // Return on Invested Capital for the first period
                    // Simple proxy: EndVal / EndInv - 1. 
                    // This underestimates if market was up and you put money in late.
                    // But strictly, (Ending Value - Total Cost) / Total Cost is the "Total Return" of that first year.
                    const ret = endInv > 0 ? (endVal / endInv) - 1 : 0;
                    result.push({ year: parseInt(y), nominal: ret });
                }

                prevVal = endVal;
                prevInv = endInv;
            }

            return result.map(a => ({
                year: String(a.year),
                value: a.nominal * 100
            }));

        } else {
            const annual = computeAnnualReturns(portfolio.idxMap);
            return annual.map(a => ({
                year: String(a.year),
                value: a.nominal * 100
            }));
        }
    }, [portfolio]);

    if (!portfolio) return null;

    const portfolioCAGR = useMemo(() => {
        if (portfolio.portValues && portfolio.totalInvested && portfolio.portValues.length === portfolio.totalInvested.length) {
            return cagrRecurring(portfolio.portValues, portfolio.totalInvested);
        }
        const values = Object.values(portfolio.idxMap);
        if (values.length < 2) return 0;
        return cagr(values.map((value, index) => ({ value })));
    }, [portfolio]);

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
                    <div>
                        <CardTitle>Annual Returns {portfolioCAGR ? `(${(portfolioCAGR * 100).toFixed(2)}% CAGR)` : ''}</CardTitle>
                        <CardDescription>
                            Year-over-year performance.
                        </CardDescription>
                    </div>
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
