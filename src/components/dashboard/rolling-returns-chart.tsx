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
import { PortfolioResult } from "@/lib/finance";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface RollingReturnsChartProps {
    portfolio: PortfolioResult | null;
}

export function RollingReturnsChart({ portfolio }: RollingReturnsChartProps) {
    const [years, setYears] = useState(10);

    const data = useMemo(() => {
        if (!portfolio) return [];

        const hasInvested = portfolio.portValues && portfolio.totalInvested && portfolio.portValues.length === portfolio.dates.length;

        let seriesValues: number[];
        let investedValues: number[] | undefined;
        let dates: string[];

        if (hasInvested) {
            dates = portfolio.dates;
            seriesValues = portfolio.portValues!;
            investedValues = portfolio.totalInvested!;
        } else {
            const idxArray = Object.keys(portfolio.idxMap).sort().map(d => ({
                date: d,
                value: portfolio.idxMap[d]
            }));
            dates = idxArray.map(x => x.date);
            seriesValues = idxArray.map(x => x.value);
        }

        // Calculate Rolling CAGR
        // years * 12 months
        const period = years * 12;
        if (seriesValues.length < period) return [];

        const result = [];
        for (let i = period; i < seriesValues.length; i++) {
            const date = dates[i];
            const startVal = seriesValues[i - period];
            const endVal = seriesValues[i];

            let cagr = 0;
            if (investedValues) {
                const startInv = investedValues[i - period];
                const endInv = investedValues[i];
                const netContrib = endInv - startInv;
                const denominator = startVal + netContrib;
                if (denominator > 0) {
                    cagr = Math.pow(endVal / denominator, 1 / years) - 1;
                }
            } else {
                // CAGR = (EndValue / StartValue)^(1/n) - 1
                if (startVal > 0) {
                    cagr = Math.pow(endVal / startVal, 1 / years) - 1;
                }
            }

            result.push({
                date: date,
                value: cagr * 100 // percent
            });
        }
        return result;
    }, [portfolio, years]);

    const avgRollingReturn = useMemo(() => {
        if (data.length === 0) return null;
        const sum = data.reduce((acc, d) => acc + d.value, 0);
        return sum / data.length;
    }, [data]);

    if (!portfolio) return null;

    const avgLabel = avgRollingReturn == null ? null : avgRollingReturn.toFixed(2);
    const seriesLabel = avgLabel ? `${years}Y CAGR (avg ${avgLabel}%)` : `${years}Y CAGR`;

    const downloadCSV = () => {
        const csv = [
            ['Date', `${years}-Year Rolling CAGR (%)`],
            ...data.map(row => [row.date, row.value.toFixed(2)])
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
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Rolling Returns</CardTitle>
                    <CardDescription>
                        Annualized return over {years}-year rolling periods{avgLabel ? ` (avg ${avgLabel}%)` : ""}.
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={String(years)} onValueChange={(v) => setYears(Number(v))}>
                        <SelectTrigger className="w-[100px]">
                            <SelectValue placeholder="Years" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1">1 Year</SelectItem>
                            <SelectItem value="3">3 Years</SelectItem>
                            <SelectItem value="5">5 Years</SelectItem>
                            <SelectItem value="10">10 Years</SelectItem>
                            <SelectItem value="15">15 Years</SelectItem>
                            <SelectItem value="20">20 Years</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={downloadCSV}>
                        <Download className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pl-2">
                <div className="h-[250px] w-full">
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
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--card-foreground))' }}
                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                                formatter={(value: number) => [`${value.toFixed(2)}%`, seriesLabel]}
                                labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
                            />
                            <Line
                                type="monotone"
                                dataKey="value"
                                name={seriesLabel}
                                stroke="#d97706"
                                strokeWidth={2}
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
