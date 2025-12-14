"use client";

import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { PortfolioResult } from "@/lib/finance";

type InflationImpactChartProps = {
    portfolio: PortfolioResult | null;
    annualInflation?: number;
};

export function InflationImpactChart({ portfolio, annualInflation = 0.02 }: InflationImpactChartProps) {
    if (!portfolio) return null;

    const monthlyInflation = Math.pow(1 + annualInflation, 1 / 12) - 1;

    const isMonetary = !!(portfolio.portValues && portfolio.dates && portfolio.portValues.length === portfolio.dates.length);

    const dates = (portfolio.dates && portfolio.dates.length > 0)
        ? portfolio.dates
        : Object.keys(portfolio.idxMap).sort();

    const nominalSeries = isMonetary
        ? portfolio.portValues!
        : dates.map((d) => portfolio.idxMap[d]);

    const data = dates.map((date, i) => {
        const inflationIndex = Math.pow(1 + monthlyInflation, i);
        const nominal = nominalSeries[i] ?? 0;
        const real = inflationIndex > 0 ? nominal / inflationIndex : nominal;
        return { date, nominal, real };
    });

    const downloadCSV = () => {
        const csv = [
            ["Date", "Nominal", "Real"],
            ...data.map((row) => [row.date, row.nominal.toFixed(6), row.real.toFixed(6)]),
        ]
            .map((row) => row.join(","))
            .join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "inflation-impact.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    return (
        <Card className="col-span-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                    <CardTitle>Inflation Impact</CardTitle>
                    <CardDescription>
                        Nominal vs inflation-adjusted growth (assumes {(annualInflation * 100).toFixed(1)}% annual inflation).
                    </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={downloadCSV}>
                    <Download className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent className="pl-2">
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis
                                dataKey="date"
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                minTickGap={30}
                                tickFormatter={(value) => new Date(value).getFullYear().toString()}
                            />
                            <YAxis
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(v) => {
                                    const value = Number(v);
                                    if (isMonetary) return `€${(value / 1000).toFixed(0)}k`;
                                    return value.toFixed(0);
                                }}
                                domain={["auto", "auto"]}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--card-foreground))" }}
                                itemStyle={{ color: "hsl(var(--foreground))" }}
                                formatter={(value: number, name: string) => {
                                    const label = name === "nominal" ? "Nominal" : "Real";
                                    if (isMonetary) {
                                        return [`€${value.toLocaleString("en-IE", { maximumFractionDigits: 0 })}`, label];
                                    }
                                    return [value.toFixed(2), label];
                                }}
                                labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { year: "numeric", month: "long" })}
                            />
                            <Line type="monotone" dataKey="nominal" stroke="#3b82f6" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="real" stroke="#ef4444" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
