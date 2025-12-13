"use client";

import {
    Line,
    LineChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    Legend,
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

        // Convert portfolio idxMap to array of {date: string, value: number}
        const idxArray = Object.keys(portfolio.idxMap).sort().map(d => ({
            date: d,
            value: portfolio.idxMap[d]
        }));

        // Calculate Rolling CAGR
        // years * 12 months
        const period = years * 12;
        if (idxArray.length < period) return [];

        const result = [];
        for (let i = period; i < idxArray.length; i++) {
            const start = idxArray[i - period];
            const end = idxArray[i];

            // CAGR = (EndValue / StartValue)^(1/n) - 1
            const cagr = Math.pow(end.value / start.value, 1 / years) - 1;

            result.push({
                date: end.date,
                value: cagr * 100 // percent
            });
        }
        return result;
    }, [portfolio, years]);

    if (!portfolio) return null;

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
                        Annualized return over {years}-year rolling periods.
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
                        <Download className="mr-2 h-4 w-4" /> CSV
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
                            <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--card-foreground))' }}
                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                                formatter={(value: number) => [`${value.toFixed(2)}%`, `${years}-Year CAGR`]}
                                labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
                            />
                            <Line
                                type="monotone"
                                dataKey="value"
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
