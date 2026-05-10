"use client";

import {
    Line,
    LineChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
    ReferenceLine
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { PortfolioResult, rollingTWRR } from "@/lib/finance";
import { ChartWrapper } from "./chart-wrapper";
import { usePortfolio } from "@/context/portfolio-context";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

interface RollingReturnsChartProps {
    portfolio: PortfolioResult | null;
}

export function RollingReturnsChart({ portfolio }: RollingReturnsChartProps) {
    const { investmentMode } = usePortfolio();
    const showSecondary = investmentMode === "recurring" || investmentMode === "hybrid";
    const [years, setYears] = useState(10);

    const data = useMemo(() => {
        if (!portfolio) return [];
        const twrrPoints = rollingTWRR(portfolio.dates, portfolio.portRets, years);
        const twrrMap = new Map(twrrPoints.map(pt => [pt.date, pt.value * 100]));
        return twrrPoints.map(pt => ({
            date: pt.date,
            value: pt.value * 100,
            // Keep secondary series for recurring/hybrid as a duplicate of the canonical
            // TWR stream so visuals/export stay aligned with key-metric methodology.
            twrr: showSecondary ? (twrrMap.get(pt.date) ?? null) : null,
        }));
    }, [portfolio, years, showSecondary]);

    const avgRollingReturn = useMemo(() => {
        if (data.length === 0) return null;
        const sum = data.reduce((acc, d) => acc + d.value, 0);
        return sum / data.length;
    }, [data]);

    if (!portfolio) return null;

    const avgLabel = avgRollingReturn == null ? null : avgRollingReturn.toFixed(2);
    const seriesLabel = avgLabel ? `${years}Y TWR (avg ${avgLabel}%)` : `${years}Y TWR`;

    const downloadCSV = () => {
        const headers = ['Date', `${years}-Year Rolling TWR (%)`];
        if (showSecondary) {
            headers.push(`${years}-Year Rolling TWRR (%)`);
        }

        const csv = [
            headers,
            ...data.map(row => {
                const rowData = [row.date, row.value.toFixed(2)];
                if (showSecondary) {
                    rowData.push(row.twrr != null ? row.twrr.toFixed(2) : "");
                }
                return rowData;
            })
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rolling-returns-${years}years.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    return (
        <Card className="col-span-4 lg:col-span-2">
            <CardHeader className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <CardTitle>Rolling Returns</CardTitle>
                    <CardDescription>
                        Annualized return over {years}-year rolling periods{avgLabel ? ` (avg ${avgLabel}%)` : ""}.
                    </CardDescription>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Period (Years):</span>
                    <Input
                        type="number"
                        value={years}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            if (val > 0) setYears(val);
                        }}
                        className="w-[80px] h-9"
                        min={1}
                        max={50}
                    />
                    <Button variant="outline" size="sm" onClick={downloadCSV}>
                        <Download className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pl-2">
                <div className="overflow-x-auto">
                    <ChartWrapper className="h-[380px] sm:h-[320px] md:h-[250px] w-full min-w-[560px] md:min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data}>
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
                                domain={['auto', 'auto']}
                            />
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <ReferenceLine y={0} stroke="#ef4444" strokeWidth={2} />
                            <RechartsTooltip
                                wrapperStyle={{ zIndex: 30, pointerEvents: "none" }}
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    borderColor: 'hsl(var(--border))',
                                    color: 'hsl(var(--card-foreground))',
                                    maxWidth: "min(80vw, 240px)",
                                    fontSize: 12
                                }}
                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                                formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name]}
                                labelFormatter={(label: string | number) => new Date(label).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
                            />
                            <Line
                                type="monotone"
                                dataKey="value"
                                name={seriesLabel}
                                stroke="#d97706"
                                strokeWidth={2}
                                dot={false}
                            />
                            {showSecondary && (
                                <Line
                                    type="monotone"
                                    dataKey="twrr"
                                    name={`${years}Y TWRR`}
                                    stroke="#2563eb"
                                    strokeWidth={2}
                                    dot={false}
                                    connectNulls={false}
                                />
                            )}
                            </LineChart>
                        </ResponsiveContainer>
                    </ChartWrapper>
                </div>
            </CardContent>
        </Card>
    );
}
