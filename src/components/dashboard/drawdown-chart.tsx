"use client";

import {
    Area,
    AreaChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { PortfolioResult, InvestmentMode } from "@/lib/finance";
import { useMemo } from "react";

interface DrawdownChartProps {
    portfolios: Array<{
        name: string;
        portfolio: PortfolioResult;
        color: string;
    }>;
    mode?: InvestmentMode;
}

export function DrawdownChart({ portfolios, mode }: DrawdownChartProps) {
    if (!portfolios.length) return null;

    // Calculate actual drawdowns based on mode
    const getDrawdowns = (portfolio: PortfolioResult) => {
        if ((mode === "recurring" || mode === "hybrid") && portfolio.portValues && portfolio.dates.length === portfolio.portValues.length) {
            let maxSF = -Infinity;
            const actualDrawdowns: { date: string; value: number }[] = [];
            for (let i = 0; i < portfolio.dates.length; i++) {
                const v = portfolio.portValues[i];
                if (v > maxSF) maxSF = v;
                actualDrawdowns.push({ date: portfolio.dates[i], value: maxSF > 0 ? v / maxSF - 1 : 0 });
            }
            return actualDrawdowns;
        }
        return portfolio.drawdowns;
    };

    // Transform data for the chart
    const data = useMemo(() => {
        // Get all unique dates from all portfolios
        const allDates = new Set<string>();
        portfolios.forEach(({ portfolio }) => {
            getDrawdowns(portfolio).forEach(d => allDates.add(d.date));
        });

        // Create data points for each date
        return Array.from(allDates).map(date => {
            const point: any = { date };
            portfolios.forEach(({ portfolio, name }) => {
                const drawdown = getDrawdowns(portfolio).find(d => d.date === date);
                point[name] = drawdown ? drawdown.value * 100 : null;
            });
            return point as Record<string, any>;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) as Array<Record<string, any>>;
    }, [portfolios, mode]);

    // Calculate max drawdown for each portfolio
    const maxDrawdowns = useMemo(() => {
        return portfolios.map(({ portfolio, name }) => {
            const drawdowns = getDrawdowns(portfolio);
            const maxDD = Math.min(...drawdowns.map(d => d.value));
            return {
                name,
                value: maxDD * 100, // Convert to percentage
                color: portfolios.find(p => p.name === name)?.color || '#888888'
            };
        });
    }, [portfolios, mode]);

    const downloadCSV = () => {
        const headers = ['Date', ...portfolios.map(p => p.name)];
        const csv = [
            headers.join(','),
            ...data.map(row => {
                const values = [row.date];
                portfolios.forEach(({ name }) => {
                    const val = row[name];
                    values.push(val !== null && val !== undefined ? Number(val).toFixed(2) : '');
                });
                return values.join(',');
            })
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'drawdowns.csv';
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
                        <CardTitle>Drawdowns</CardTitle>
                        <CardDescription>
                            Historical decline from peak.
                            {maxDrawdowns.length > 0 && (
                                <div className="mt-1 text-xs text-muted-foreground">
                                    Max: {maxDrawdowns.map((dd: { name: string; value: number; color: string }) => (
                                        <span key={dd.name} style={{ color: dd.color }} className="ml-2">
                                            {dd.name}: {dd.value.toFixed(2)}%
                                        </span>
                                    ))}
                                </div>
                            )}
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
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorDrawdown" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="date"
                                stroke="#888888"
                                fontSize={12}
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
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${value.toFixed(0)}%`}
                            />
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <RechartsTooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--card-foreground))' }}
                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                                formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name]}
                                labelFormatter={(label: any) => new Date(label).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
                            />
                            <Legend
                                formatter={(value: string) => {
                                    const dd = maxDrawdowns.find((d: { name: string; value: number }) => d.name === value);
                                    return dd ? `${value} (${dd.value.toFixed(2)}%)` : value;
                                }}
                            />
                            {portfolios.map(({ name, color }) => (
                                <defs key={`gradient-${name}`}>
                                    <linearGradient id={`gradient-${name}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                            ))}
                            {portfolios.map(({ name, color }) => (
                                <Area
                                    key={name}
                                    type="monotone"
                                    dataKey={name}
                                    stroke={color}
                                    strokeWidth={2}
                                    fillOpacity={0.3}
                                    fill={`url(#gradient-${name})`}
                                    name={name}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
