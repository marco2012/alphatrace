"use client";

import { useMemo, useState } from "react";
import { cagr, cagrRecurring, annualVol, averageRollingNCAGR } from "@/lib/finance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ZoomIn, RotateCcw } from "lucide-react";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, ZAxis, Cell, ReferenceArea } from "recharts";

interface RiskReturnScatterChartProps {
    items: {
        name: string;
        color: string;
        result: any; // Using any for simplicity as extracting types from finance.ts might be complex, but ideally should be typed
    }[];
}

type CalculationPeriod = "full" | "10y" | "15y" | "20y";

export function RiskReturnScatterChart({ items }: RiskReturnScatterChartProps) {
    const [period, setPeriod] = useState<CalculationPeriod>("10y");
    const [includeOrigin, setIncludeOrigin] = useState(true);

    // Zoom state
    const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
    const [refAreaRight, setRefAreaRight] = useState<number | null>(null);
    const [refAreaBottom, setRefAreaBottom] = useState<number | null>(null);
    const [refAreaTop, setRefAreaTop] = useState<number | null>(null);

    const [left, setLeft] = useState<number | "auto">("auto");
    const [right, setRight] = useState<number | "auto">("auto");
    const [top, setTop] = useState<number | "auto">("auto");
    const [bottom, setBottom] = useState<number | "auto">("auto");

    const zoom = () => {
        if (refAreaLeft === refAreaRight || refAreaBottom === refAreaTop || refAreaLeft === null || refAreaRight === null || refAreaBottom === null || refAreaTop === null) {
            setRefAreaLeft(null);
            setRefAreaRight(null);
            setRefAreaBottom(null);
            setRefAreaTop(null);
            return;
        }

        // xAxis domain
        let newLeft = Math.min(refAreaLeft, refAreaRight);
        let newRight = Math.max(refAreaLeft, refAreaRight);

        // yAxis domain
        let newBottom = Math.min(refAreaBottom, refAreaTop);
        let newTop = Math.max(refAreaBottom, refAreaTop);

        setLeft(newLeft);
        setRight(newRight);
        setBottom(newBottom);
        setTop(newTop);

        setRefAreaLeft(null);
        setRefAreaRight(null);
        setRefAreaBottom(null);
        setRefAreaTop(null);
    };

    const zoomOut = () => {
        setLeft("auto");
        setRight("auto");
        setTop("auto");
        setBottom("auto");
        setRefAreaLeft(null);
        setRefAreaRight(null);
        setRefAreaBottom(null);
        setRefAreaTop(null);
    };

    const data = useMemo(() => {
        return items.map(item => {
            if (!item.result) return null;
            const r = item.result;

            let cagrValue = 0;
            let volValue = 0;

            if (period === "full") {
                cagrValue = (r.portValues && r.totalInvested && r.portValues.length === r.totalInvested.length)
                    ? cagrRecurring(r.portValues, r.totalInvested)
                    : cagr(Object.keys(r.idxMap).sort().map((d) => ({ value: r.idxMap[d] })));
                volValue = annualVol(r.portRets);
            } else {
                // Rolling calculations
                const years = parseInt(period.slice(0, -1)); // "10y" -> 10

                // Prepare series for rolling calculation
                const series = r.portValues && r.totalInvested
                    ? r.portValues.map((val: number, i: number) => val / r.totalInvested![i]) // Use ROI multiplier for recurring
                    : Object.keys(r.idxMap).sort().map(d => r.idxMap[d]);

                const dates = r.dates || Object.keys(r.idxMap).sort();
                const idxMap: Record<string, number> = {};
                dates.forEach((d: string, i: number) => {
                    idxMap[d] = series[i];
                });

                cagrValue = averageRollingNCAGR(idxMap, years);

                // Calculate Average Rolling Volatility
                const windowMonths = years * 12;
                if (r.portRets.length > windowMonths) {
                    let totalVol = 0;
                    let count = 0;
                    for (let i = 0; i <= r.portRets.length - windowMonths; i++) {
                        const slice = r.portRets.slice(i, i + windowMonths);
                        totalVol += annualVol(slice);
                        count++;
                    }
                    volValue = count > 0 ? totalVol / count : 0;
                } else {
                    volValue = 0; // Not enough data
                }
            }

            return {
                name: item.name,
                x: volValue * 100, // Volatility %
                y: cagrValue * 100, // Return %
                color: item.color,
            };
        }).filter(item => item !== null && (item.x > 0 || item.y !== 0)) as { name: string; x: number; y: number; color: string }[];
    }, [items, period]);

    const minY = useMemo(() => {
        if (data.length === 0) return 0;
        return Math.min(...data.map(d => d.y));
    }, [data]);

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <CardTitle>Risk vs. Return</CardTitle>
                        <CardDescription>
                            {period === "full" ? "Annualized Return (CAGR) vs. Volatility" : `Average Rolling ${period.toUpperCase()} Return vs. Volatility`}
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="origin-mode"
                                checked={includeOrigin}
                                onCheckedChange={setIncludeOrigin}
                            />
                            <Label htmlFor="origin-mode" className="text-sm font-normal text-muted-foreground whitespace-nowrap">Start from 0</Label>
                        </div>
                        <Select value={period} onValueChange={(v: CalculationPeriod) => setPeriod(v)}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Period" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10y">Rolling 10 Years</SelectItem>
                                <SelectItem value="full">Entire Period</SelectItem>
                                <SelectItem value="15y">Rolling 15 Years</SelectItem>
                                <SelectItem value="20y">Rolling 20 Years</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-4 mb-4 justify-center">
                    {data.map((item) => (
                        <div key={item.name} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-xs font-medium text-muted-foreground">{item.name}</span>
                        </div>
                    ))}
                </div>
                <div className="h-[400px] w-full relative group">
                    {(left !== "auto" || bottom !== "auto") && (
                        <div className="absolute right-2 top-2 z-10">
                            <Button
                                variant="secondary"
                                size="sm"
                                className="h-8 px-2 text-xs gap-1 shadow-sm opacity-90 hover:opacity-100"
                                onClick={zoomOut}
                            >
                                <RotateCcw className="w-3 h-3" />
                                Reset Zoom
                            </Button>
                        </div>
                    )}
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart
                            margin={{ top: 20, right: 20, bottom: 40, left: 20 }}
                            onMouseDown={(e: any) => {
                                if (e) {
                                    setRefAreaLeft(e.xValue);
                                    setRefAreaBottom(e.yValue);
                                }
                            }}
                            onMouseMove={(e: any) => {
                                if (e && refAreaLeft !== null) {
                                    setRefAreaRight(e.xValue);
                                    setRefAreaTop(e.yValue);
                                }
                            }}
                            onMouseUp={zoom}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis
                                type="number"
                                dataKey="x"
                                name="Volatility"
                                unit="%"
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                domain={[
                                    left === "auto" ? (includeOrigin ? 0 : "auto") : left,
                                    right
                                ]}
                                allowDataOverflow
                                label={{ value: 'Volatility (Risk)', position: 'insideBottom', offset: -20, fontSize: 12, fill: '#666' }}
                            />
                            <YAxis
                                type="number"
                                dataKey="y"
                                name="Return"
                                unit="%"
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                domain={[
                                    bottom === "auto" ? (includeOrigin ? Math.min(0, minY) : "auto") : bottom,
                                    top
                                ]}
                                allowDataOverflow
                                label={{ value: 'Return (Yield)', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#666' }}
                            />
                            <ZAxis range={[800, 800]} /> {/* Larger dots for better readability */}
                            <RechartsTooltip
                                cursor={{ strokeDasharray: '3 3' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const point = payload[0].payload;
                                        return (
                                            <div className="bg-popover border border-border p-2 rounded shadow-sm text-sm">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: point.color }} />
                                                    <p className="font-semibold">{point.name}</p>
                                                </div>
                                                <p>Return: {point.y.toFixed(2)}%</p>
                                                <p>Volatility: {point.x.toFixed(2)}%</p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Scatter data={data} shape="circle">
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Scatter>

                            {refAreaLeft && refAreaRight ? (
                                <ReferenceArea
                                    x1={refAreaLeft}
                                    x2={refAreaRight}
                                    y1={refAreaBottom!}
                                    y2={refAreaTop!}
                                    strokeOpacity={0.3}
                                    fill="hsl(var(--primary))"
                                    fillOpacity={0.1}
                                />
                            ) : null}
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
