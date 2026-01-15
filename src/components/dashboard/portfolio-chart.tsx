"use client";

import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { PortfolioResult } from "@/lib/finance";

interface PortfolioChartProps {
    portfolio: PortfolioResult | null;
    currency?: "EUR" | "USD";
}

export function PortfolioChart({ portfolio, currency = "EUR" }: PortfolioChartProps) {
    if (!portfolio) return null;

    const data = (portfolio.portValues && portfolio.dates && portfolio.portValues.length === portfolio.dates.length)
        ? portfolio.dates.map((date, i) => ({
            date,
            value: portfolio.portValues![i]
        }))
        : Object.keys(portfolio.idxMap).sort().map((date) => ({
            date,
            value: portfolio.idxMap[date]
        }));
    const isMonetary = !!(portfolio.portValues && portfolio.dates && portfolio.portValues.length === portfolio.dates.length);

    const downloadCSV = () => {
        const csv = [
            ['Date', 'Portfolio Value'],
            ...data.map(row => [row.date, row.value.toFixed(2)])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'portfolio-growth.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const currencySymbol = currency === "USD" ? "$" : "€";

    return (
        <Card className="col-span-4">
            <CardHeader className="flex flex-col items-start justify-between gap-3 space-y-0 pb-2 sm:flex-row sm:items-center">
                <div className="min-w-0">
                    <CardTitle>Portfolio Growth</CardTitle>
                    <CardDescription>
                        {isMonetary ? 'Portfolio value over time' : 'Growth of 100 units invested at the start'}.
                    </CardDescription>
                </div>
                <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={downloadCSV}>
                    <Download className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent className="px-2 sm:pl-2">
                <div className="h-[240px] w-full sm:h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 12 }}>
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="date"
                                stroke="#888888"
                                fontSize={12}
                                tickMargin={8}
                                tickLine={false}
                                axisLine={false}
                                minTickGap={30}
                                tickFormatter={(value) => {
                                    const d = new Date(value);
                                    return d.getFullYear().toString();
                                }}
                            />
                            <YAxis
                                stroke="#888888"
                                fontSize={12}
                                tickMargin={8}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => isMonetary ? `${currencySymbol}${(value / 1000).toFixed(0)}k` : value.toFixed(0)}
                                domain={['auto', 'auto']}
                            />
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <RechartsTooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--card-foreground))' }}
                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                                formatter={(value: number) => [
                                    isMonetary ? `${currencySymbol}${value.toLocaleString('en-IE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : value.toFixed(2),
                                    "Value"
                                ]}
                                labelFormatter={(label: any) => new Date(label).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
                            />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke="#8884d8"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorValue)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
