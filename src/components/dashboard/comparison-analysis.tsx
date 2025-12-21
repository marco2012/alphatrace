"use client";

import { useMemo, useState } from "react";
import { usePortfolio, SavedPortfolio } from "@/context/portfolio-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Download } from "lucide-react";
import { PortfolioResult, cagr, cagrRecurring, annualVol, sharpe, sortino, maxDrawdown, averageRolling10YearCAGR, calmar, ulcerIndex } from "@/lib/finance";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    ResponsiveContainer
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip as UITooltip, TooltipContent as UITooltipContent, TooltipTrigger as UITooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { AnnualReturnsChart } from "@/components/dashboard/annual-returns-chart";
import { DrawdownChart } from "@/components/dashboard/drawdown-chart";
import { RollingReturnsChart } from "@/components/dashboard/rolling-returns-chart";
import { TimeToRecoveryChart } from "@/components/dashboard/recovery-chart";

type ComparisonItem = {
    id: string;
    type: 'portfolio' | 'asset';
    name: string;
    color: string;
    result: PortfolioResult | null;
};

const COLORS = [
    "#2563eb", // blue-600
    "#dc2626", // red-600
    "#16a34a", // green-600
    "#d97706", // amber-600
    "#9333ea", // purple-600
    "#0891b2", // cyan-600
    "#db2777", // pink-600
    "#4f46e5", // indigo-600
    "#059669", // emerald-600
    "#ea580c", // orange-600
    "#7c3aed", // violet-600
    "#e11d48", // rose-600
];

const METRIC_EXPLANATIONS = {
    cagrValue: "Compound Annual Growth Rate. The geometric progression ratio that provides a constant rate of return over the time period.",
    volValue: "Annualized Volatility. A statistical measure of the dispersion of returns, representing the risk/variability of the investment.",
    sharpeValue: "Sharpe Ratio. Measures the performance of an investment compared to a risk-free asset, after adjusting for its risk.",
    sortinoValue: "Sortino Ratio. A variation of the Sharpe ratio that only considers downside volatility (negative returns).",
    maxDDValue: "Maximum Drawdown. The maximum observed loss from a peak to a trough of a portfolio, before a new peak is attained.",
    calmarValue: "Calmar Ratio. Measures the risk-adjusted return relative to the maximum drawdown.",
    ulcerIndexValue: "Ulcer Index. Measures the depth and duration of drawdowns from earlier highs.",
    avgRolling10YearCAGRValue: "Average 10Y Rolling CAGR. The average of all possible 10-year rolling Compound Annual Growth Rates."
};

const getNextColor = (items: ComparisonItem[]) => {
    const usedColors = new Set(items.map(i => i.color));
    const available = COLORS.filter(c => !usedColors.has(c));
    if (available.length > 0) return available[0];
    return COLORS[items.length % COLORS.length];
};

export function ComparisonAnalysis() {
    const {
        savedPortfolios,
        columns: assets,
        computeCustomPortfolio,
        computeAssetPortfolio,
        weights: currentWeights
    } = usePortfolio();

    const [selectedItems, setSelectedItems] = useState<ComparisonItem[]>([
        {
            id: 'current',
            type: 'portfolio',
            name: 'Current Portfolio',
            color: COLORS[0],
            result: null // Computed on fly
        }
    ]);

    const [itemToAdd, setItemToAdd] = useState<string>("");
    const [typeToAdd, setTypeToAdd] = useState<'portfolio' | 'asset'>('portfolio');

    // Compute results for selected items
    const itemsWithResults = useMemo(() => {
        return selectedItems.map(item => {
            let result: PortfolioResult | null = null;
            if (item.id === 'current') {
                result = computeCustomPortfolio(currentWeights);
            } else if (item.type === 'portfolio') {
                const p = savedPortfolios.find(sp => sp.id === item.id);
                if (p) result = computeCustomPortfolio(p.weights);
            } else if (item.type === 'asset') {
                result = computeAssetPortfolio(item.id);
            }
            return { ...item, result };
        });
    }, [selectedItems, savedPortfolios, currentWeights, computeCustomPortfolio, computeAssetPortfolio]);

    const handleAddItem = () => {
        if (!itemToAdd) return;

        let newItem: ComparisonItem | null = null;

        if (typeToAdd === 'portfolio') {
            const p = savedPortfolios.find(sp => sp.id === itemToAdd);
            if (p) {
                newItem = {
                    id: p.id,
                    type: 'portfolio',
                    name: p.name,
                    color: getNextColor(selectedItems),
                    result: null
                };
            }
        } else {
            // Asset
            newItem = {
                id: itemToAdd,
                type: 'asset',
                name: itemToAdd,
                color: getNextColor(selectedItems),
                result: null
            };
        }

        if (newItem && !selectedItems.find(i => i.id === newItem!.id && i.type === newItem!.type)) {
            setSelectedItems([...selectedItems, newItem]);
        }
        setItemToAdd("");
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...selectedItems];
        newItems.splice(index, 1);
        setSelectedItems(newItems);
    };

    const handleClearAll = () => {
        setSelectedItems([
            {
                id: 'current',
                type: 'portfolio',
                name: 'Current Portfolio',
                color: COLORS[0],
                result: null
            }
        ]);
        setItemToAdd("");
    };

    const downloadComparisonCSV = () => {
        const headers = ['Date', ...itemsWithResults.map(item => item.name)];
        const csv = [
            headers.join(','),
            ...chartData.map(row => {
                const values = itemsWithResults.map(item =>
                    row[item.name] !== undefined ? row[item.name].toFixed(2) : ''
                );
                return [row.date, ...values].join(',');
            })
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'comparison-growth.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    // Prepare Chart Data
    const chartData = useMemo(() => {
        if (!itemsWithResults.length || !itemsWithResults[0].result) return [];

        const base = itemsWithResults[0].result;
        const dates = (base.portValues && base.dates && base.portValues.length === base.dates.length)
            ? base.dates
            : Object.keys(base.idxMap).sort();

        const seriesByName: Record<string, Record<string, number>> = {};
        for (const item of itemsWithResults) {
            const r = item.result;
            if (!r) continue;
            if (r.portValues && r.dates && r.portValues.length === r.dates.length) {
                seriesByName[item.name] = r.dates.reduce((acc, d, i) => {
                    acc[d] = r.portValues![i];
                    return acc;
                }, {} as Record<string, number>);
            } else {
                seriesByName[item.name] = r.idxMap;
            }
        }

        return dates.map((date) => {
            const point: any = { date };
            for (const item of itemsWithResults) {
                const v = seriesByName[item.name]?.[date];
                if (v !== undefined) point[item.name] = v;
            }
            return point;
        });
    }, [itemsWithResults]);

    const currentItem = itemsWithResults.find(item => item.id === 'current');

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Compare</CardTitle>
                        <CardDescription>Compare saved portfolios and assets.</CardDescription>
                    </div>
                    {selectedItems.length > 1 && (
                        <Button variant="outline" size="sm" onClick={handleClearAll} className="text-destructive hover:text-destructive">
                            Clear All
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="space-y-2 w-full md:w-[200px]">
                            <Label>Type</Label>
                            <Select value={typeToAdd} onValueChange={(v: any) => setTypeToAdd(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="portfolio">Saved Portfolio</SelectItem>
                                    <SelectItem value="asset">Asset</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2 w-full md:w-[300px]">
                            <Label>Item</Label>
                            <Select value={itemToAdd} onValueChange={setItemToAdd}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select item..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {typeToAdd === 'portfolio' ? (
                                        savedPortfolios.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                        ))
                                    ) : (
                                        assets.map(a => (
                                            <SelectItem key={a} value={a}>{a}</SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button onClick={handleAddItem} disabled={!itemToAdd}>
                            <Plus className="h-4 w-4 mr-2" /> Add
                        </Button>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                        {selectedItems.map((item, idx) => (
                            <Badge key={`${item.type}-${item.id}`} variant="outline" className="pl-2 pr-1 py-1 flex items-center gap-1" style={{ borderColor: item.color }}>
                                <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: item.color }}></span>
                                {item.name}
                                <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 hover:bg-transparent" onClick={() => handleRemoveItem(idx)}>
                                    <X className="h-3 w-3" />
                                </Button>
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6">
                {/* Comparative Growth Chart */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div>
                            <CardTitle>Growth Comparison</CardTitle>
                        </div>
                        <Button variant="outline" size="sm" onClick={downloadComparisonCSV}>
                            <Download className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
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
                                        domain={['auto', 'auto']}
                                    />
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--card-foreground))' }}
                                        labelFormatter={(label: any) => new Date(label).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
                                        formatter={(value: number) => [`€${value.toFixed(0)}`, 'Value']}
                                    />
                                    <Legend />
                                    {itemsWithResults.map((item) => (
                                        <Line
                                            key={item.name}
                                            type="monotone"
                                            dataKey={item.name}
                                            stroke={item.color}
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Metrics Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Metrics Comparison</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Strategies</TableHead>
                                    <TableHead className="text-right">
                                        <UITooltip delayDuration={0}>
                                            <UITooltipTrigger asChild>
                                                <div className="flex items-center justify-end gap-1 cursor-pointer">
                                                    CAGR
                                                    <Info className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                                </div>
                                            </UITooltipTrigger>
                                            <UITooltipContent side="top" align="center">
                                                <p className="w-48">{METRIC_EXPLANATIONS.cagrValue}</p>
                                            </UITooltipContent>
                                        </UITooltip>
                                    </TableHead>
                                    <TableHead className="text-right">
                                        <UITooltip delayDuration={0}>
                                            <UITooltipTrigger asChild>
                                                <div className="flex items-center justify-end gap-1 cursor-pointer">
                                                    Volatility
                                                    <Info className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                                </div>
                                            </UITooltipTrigger>
                                            <UITooltipContent side="top" align="center">
                                                <p className="w-48">{METRIC_EXPLANATIONS.volValue}</p>
                                            </UITooltipContent>
                                        </UITooltip>
                                    </TableHead>
                                    <TableHead className="text-right">
                                        <UITooltip delayDuration={0}>
                                            <UITooltipTrigger asChild>
                                                <div className="flex items-center justify-end gap-1 cursor-pointer">
                                                    Sharpe
                                                    <Info className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                                </div>
                                            </UITooltipTrigger>
                                            <UITooltipContent side="top" align="center">
                                                <p className="w-48">{METRIC_EXPLANATIONS.sharpeValue}</p>
                                            </UITooltipContent>
                                        </UITooltip>
                                    </TableHead>
                                    <TableHead className="text-right">
                                        <UITooltip delayDuration={0}>
                                            <UITooltipTrigger asChild>
                                                <div className="flex items-center justify-end gap-1 cursor-pointer">
                                                    Sortino
                                                    <Info className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                                </div>
                                            </UITooltipTrigger>
                                            <UITooltipContent side="top" align="center">
                                                <p className="w-48">{METRIC_EXPLANATIONS.sortinoValue}</p>
                                            </UITooltipContent>
                                        </UITooltip>
                                    </TableHead>
                                    <TableHead className="text-right">
                                        <UITooltip delayDuration={0}>
                                            <UITooltipTrigger asChild>
                                                <div className="flex items-center justify-end gap-1 cursor-pointer">
                                                    Max DD
                                                    <Info className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                                </div>
                                            </UITooltipTrigger>
                                            <UITooltipContent side="top" align="center">
                                                <p className="w-48">{METRIC_EXPLANATIONS.maxDDValue}</p>
                                            </UITooltipContent>
                                        </UITooltip>
                                    </TableHead>
                                    <TableHead className="text-right">
                                        <UITooltip delayDuration={0}>
                                            <UITooltipTrigger asChild>
                                                <div className="flex items-center justify-end gap-1 cursor-pointer">
                                                    Calmar
                                                    <Info className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                                </div>
                                            </UITooltipTrigger>
                                            <UITooltipContent side="top" align="center">
                                                <p className="w-48">{METRIC_EXPLANATIONS.calmarValue}</p>
                                            </UITooltipContent>
                                        </UITooltip>
                                    </TableHead>
                                    <TableHead className="text-right">
                                        <UITooltip delayDuration={0}>
                                            <UITooltipTrigger asChild>
                                                <div className="flex items-center justify-end gap-1 cursor-pointer">
                                                    Ulcer Index
                                                    <Info className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                                </div>
                                            </UITooltipTrigger>
                                            <UITooltipContent side="top" align="center">
                                                <p className="w-48">{METRIC_EXPLANATIONS.ulcerIndexValue}</p>
                                            </UITooltipContent>
                                        </UITooltip>
                                    </TableHead>
                                    <TableHead className="text-right">
                                        <UITooltip delayDuration={0}>
                                            <UITooltipTrigger asChild>
                                                <div className="flex items-center justify-end gap-1 cursor-pointer">
                                                    Avg 10Y Rolling CAGR
                                                    <Info className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                                </div>
                                            </UITooltipTrigger>
                                            <UITooltipContent side="top" align="center">
                                                <p className="w-48">{METRIC_EXPLANATIONS.avgRolling10YearCAGRValue}</p>
                                            </UITooltipContent>
                                        </UITooltip>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {itemsWithResults.map((item) => {
                                    if (!item.result) return null;
                                    const cagrVal = (item.result.portValues && item.result.totalInvested && item.result.portValues.length === item.result.totalInvested.length)
                                        ? cagrRecurring(item.result.portValues, item.result.totalInvested)
                                        : cagr(Object.keys(item.result.idxMap).sort().map(d => ({ value: item.result!.idxMap[d] })));
                                    const volVal = annualVol(item.result.portRets);
                                    const sharpeVal = sharpe(item.result.portRets, 0.02); // assuming rf=2%
                                    const sortinoVal = sortino(item.result.portRets, 0.02);
                                    const maxDD = item.result.drawdowns.reduce((min, d) => Math.min(min, d.value), 0);
                                    const calmarVal = calmar(cagrVal, maxDD);
                                    const ulcerIndexVal = ulcerIndex(item.result.drawdowns);
                                    const avgRolling10Y = averageRolling10YearCAGR(item.result);

                                    return (
                                        <TableRow key={item.name}>
                                            <TableCell className="font-medium flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                                                {item.name}
                                            </TableCell>
                                            <TableCell className={(cagrVal >= 0 ? "text-green-600" : "text-red-600") + " text-right"}>{(cagrVal * 100).toFixed(2)}%</TableCell>
                                            <TableCell className="text-right">{(volVal * 100).toFixed(2)}%</TableCell>
                                            <TableCell className="text-right">{sharpeVal.toFixed(2)}</TableCell>
                                            <TableCell className="text-right">{sortinoVal.toFixed(2)}</TableCell>
                                            <TableCell className="text-red-600 text-right">{(maxDD * 100).toFixed(2)}%</TableCell>
                                            <TableCell className="text-right">{calmarVal.toFixed(2)}</TableCell>
                                            <TableCell className="text-right">{ulcerIndexVal.toFixed(2)}</TableCell>
                                            <TableCell className={(avgRolling10Y >= 0 ? "text-blue-600" : "text-red-600") + " text-right"}>{(avgRolling10Y * 100).toFixed(2)}%</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <AnnualReturnsChart portfolio={currentItem?.result || null} />
                <DrawdownChart
                    portfolios={currentItem?.result
                        ? [{
                            name: currentItem.name,
                            portfolio: currentItem.result,
                            color: currentItem.color
                        }]
                        : []
                    }
                />
                <RollingReturnsChart portfolio={currentItem?.result || null} />
                <TimeToRecoveryChart portfolio={currentItem?.result || null} />
            </div>
        </div>
    );
}
