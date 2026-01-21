"use client";

import { useState } from "react";
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
import { ChevronDown, ChevronUp, Download } from "lucide-react";
import { PortfolioResult } from "@/lib/finance";

type InflationImpactChartProps = {
    portfolio: PortfolioResult | null;
    cpiMap?: Record<string, number>;
    currency?: "EUR" | "USD";
};

export function InflationImpactChart({ portfolio, cpiMap = {}, currency = "EUR" }: InflationImpactChartProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (!portfolio) return null;

    const isMonetary = !!(portfolio.portValues && portfolio.dates && portfolio.portValues.length === portfolio.dates.length);

    const dates = (portfolio.dates && portfolio.dates.length > 0)
        ? portfolio.dates
        : Object.keys(portfolio.idxMap).sort();

    const nominalSeries = isMonetary
        ? portfolio.portValues!
        : dates.map((d) => portfolio.idxMap[d]);

    const data = dates.map((date, i) => {
        const nominal = nominalSeries[i] ?? 0;
        let real = nominal;
        
        // If we have CPI map, use it. Otherwise no adjustment (or fallback).
        // cpiMap[date] is the CPI index relative to start date=100?
        // Actually buildMonthlyCPI sets start date = 100.
        // So real = nominal / (cpi / 100) = nominal * 100 / cpi
        
        const cpi = cpiMap[date];
        if (cpi && cpi > 0) {
            real = (nominal * 100) / cpi;
        }
        
        return { date, nominal, real };
    });

    const downloadCSV = (e: React.MouseEvent) => {
        e.stopPropagation();
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

    const currencySymbol = currency === "USD" ? "$" : "€";

    return (
        <Card className="col-span-4">
            <CardHeader 
                className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer select-none hover:bg-muted/50 transition-colors rounded-t-lg"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2">
                    {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    <div>
                        <CardTitle>Inflation Impact</CardTitle>
                        <CardDescription>
                            Nominal vs inflation-adjusted growth ({currency} CPI).
                        </CardDescription>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={downloadCSV}>
                    <Download className="h-4 w-4" />
                </Button>
            </CardHeader>
            {isOpen && (
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
                                    if (isMonetary) return `${currencySymbol}${(value / 1000).toFixed(0)}k`;
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
                                        return [`${currencySymbol}${value.toLocaleString("en-IE", { maximumFractionDigits: 0 })}`, label];
                                    }
                                    return [value.toFixed(2), label];
                                }}
                                labelFormatter={(label: any) => new Date(label).toLocaleDateString(undefined, { year: "numeric", month: "long" })}
                            />
                            <Line type="monotone" dataKey="nominal" stroke="#3b82f6" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="real" stroke="#ef4444" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
            )}
        </Card>
    );
}
