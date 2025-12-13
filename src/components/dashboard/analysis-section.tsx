"use client";

import { useMemo, useState } from "react";
import { usePortfolio } from "@/context/portfolio-context";

import { PortfolioControls } from "@/components/dashboard/portfolio-controls";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { PortfolioChart } from "@/components/dashboard/portfolio-chart";
import { RollingReturnsChart } from "@/components/dashboard/rolling-returns-chart";
import { AnnualReturnsChart } from "@/components/dashboard/annual-returns-chart";
import { DrawdownChart } from "@/components/dashboard/drawdown-chart";
import { TimeToRecoveryChart } from "@/components/dashboard/recovery-chart";
import { EfficientFrontierChart } from "@/components/dashboard/efficient-frontier-chart";
import { InflationImpactChart } from "@/components/dashboard/inflation-impact-chart";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import {
    annualVol,
    averageRolling10YearCAGR,
    cagr,
    cagrRecurring,
    computeAnnualReturns,
    formatMonthsAsYearsAndMonths,
    PortfolioResult,
    sharpe,
    sortino,
    timeToRecoverFromIndex
} from "@/lib/finance";

import {
    Bar,
    BarChart,
    Line,
    LineChart,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from "recharts";

import { ChevronDown, ChevronUp, Loader2, Plus, X, Download, Minus } from "lucide-react";

function downloadCSV(data: any[], filename: string) {
    if (!data || data.length === 0) return;
    const cols = Object.keys(data[0]);
    const csv = [
        cols.join(","),
        ...data.map(row =>
            cols.map(col => {
                const val = row[col];
                if (val === null || val === undefined) return "";
                if (typeof val === "number") return val.toString();
                const str = String(val);
                return str.includes(",") || str.includes('"') || str.includes("\n")
                    ? `"${str.replace(/"/g, '""')}"`
                    : str;
            }).join(",")
        )
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

type AnalysisItem = {
    id: string;
    type: "portfolio" | "asset";
    name: string;
    color: string;
    result: PortfolioResult | null;
};

type AnalysisItemKey = `${AnalysisItem["type"]}:${string}`;

const COLORS = [
    "#2563eb", // blue-600
    "#dc2626", // red-600
    "#16a34a", // green-600
    "#d97706", // amber-600
    "#9333ea", // purple-600
    "#0891b2", // cyan-600
    "#db2777", // pink-600
];

export function AnalysisSection() {
    const {
        portfolio,
        isLoading,
        weights,
        savedPortfolios,
        columns: assets,
        computeCustomPortfolio,
        computeAssetPortfolio,
        riskFreeRate,
        norm,
        investmentMode,
        initialInvestment,
        monthlyInvestment,
        rebalance,
        endDate,
        startDate
    } = usePortfolio();

    const makeKey = (item: Pick<AnalysisItem, "type" | "id">): AnalysisItemKey => `${item.type}:${item.id}`;

    const [selectedItems, setSelectedItems] = useState<AnalysisItem[]>([
        {
            id: "current",
            type: "portfolio",
            name: "Current Portfolio",
            color: COLORS[0],
            result: null
        }
    ]);

    const [typeToAdd, setTypeToAdd] = useState<"portfolio" | "asset">("portfolio");
    const [selectedForAdd, setSelectedForAdd] = useState<string[]>([]);
    const [rollingYears, setRollingYears] = useState(10);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>({
        key: "cagrValue",
        direction: "desc"
    });

    const itemsWithResults = useMemo(() => {
        return selectedItems.map(item => {
            let result: PortfolioResult | null = null;
            if (item.id === "current") {
                result = portfolio;
            } else if (item.type === "portfolio") {
                const p = savedPortfolios.find(sp => sp.id === item.id);
                if (p) result = computeCustomPortfolio(p.weights);
            } else if (item.type === "asset") {
                result = computeAssetPortfolio(item.id);
            }
            return { ...item, result };
        });
    }, [
        selectedItems,
        savedPortfolios,
        portfolio,
        computeCustomPortfolio,
        computeAssetPortfolio,
        norm,
        investmentMode,
        initialInvestment,
        monthlyInvestment,
        rebalance,
        endDate,
        startDate
    ]);

    const validItems = useMemo(() => itemsWithResults.filter(item => item.result), [itemsWithResults]);

    const chartData = useMemo(() => {
        if (!validItems.length || !validItems[0].result) return [];

        const base = validItems[0].result;
        const dates = (base.portValues && base.dates && base.portValues.length === base.dates.length)
            ? base.dates
            : Object.keys(base.idxMap).sort();

        const seriesByName: Record<string, Record<string, number>> = {};
        for (const item of validItems) {
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
            for (const item of validItems) {
                const v = seriesByName[item.name]?.[date];
                if (v !== undefined) point[item.name] = v;
            }
            return point;
        });
    }, [validItems]);

    const metricsTableRows = useMemo(() => {
        const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;
        const fmtNum = (v: number) => v.toFixed(2);

        const rows = validItems
            .map((item) => {
                const r = item.result;
                if (!r) return null;

                const cagrValue = (r.portValues && r.totalInvested && r.portValues.length === r.totalInvested.length)
                    ? cagrRecurring(r.portValues, r.totalInvested)
                    : cagr(Object.keys(r.idxMap).sort().map((d) => ({ value: r.idxMap[d] })));
                const volValue = annualVol(r.portRets);
                const sharpeValue = sharpe(r.portRets, riskFreeRate);
                const sortinoValue = sortino(r.portRets, riskFreeRate);
                const maxDD = r.drawdowns.reduce((min, d) => Math.min(min, d.value), 0);
                const avgRolling10YearCAGRValue = averageRolling10YearCAGR(r);

                const recoveries = timeToRecoverFromIndex(r.idxMap);
                const recoveryMonthsValue = recoveries.reduce((mx, rec) => Math.max(mx, rec.months || 0), 0);
                const recoveryMonths = formatMonthsAsYearsAndMonths(recoveryMonthsValue);

                return {
                    key: makeKey(item),
                    name: item.name,
                    cagrValue,
                    cagr: fmtPct(cagrValue),
                    volValue,
                    vol: fmtPct(volValue),
                    sharpeValue,
                    sharpe: fmtNum(sharpeValue),
                    sortinoValue,
                    sortino: fmtNum(sortinoValue),
                    maxDDValue: maxDD,
                    maxDD: fmtPct(maxDD),
                    avgRolling10YearCAGRValue,
                    avgRolling10YearCAGR: fmtPct(avgRolling10YearCAGRValue),
                    recoveryMonthsValue,
                    recoveryMonths
                };
            })
            .filter(Boolean) as Array<{
            key: string;
            name: string;
            cagrValue: number;
            cagr: string;
            volValue: number;
            vol: string;
            sharpeValue: number;
            sharpe: string;
            sortinoValue: number;
            sortino: string;
            maxDDValue: number;
            maxDD: string;
            avgRolling10YearCAGRValue: number;
            avgRolling10YearCAGR: string;
            recoveryMonthsValue: number;
            recoveryMonths: string;
        }>;

        const sortedRows = [...rows].sort((a, b) => {
            if (!sortConfig) return 0;
            const aValue = a[sortConfig.key as keyof typeof a];
            const bValue = b[sortConfig.key as keyof typeof b];
            if (aValue === undefined || bValue === undefined) return 0;
            if (typeof aValue === "number" && typeof bValue === "number") {
                return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
            }
            const aStr = String(aValue);
            const bStr = String(bValue);
            return sortConfig.direction === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
        });

        return sortedRows;
    }, [validItems, riskFreeRate, makeKey, sortConfig]);

    const rollingComparisonData = useMemo(() => {
        if (validItems.length < 2) return [];

        const period = rollingYears * 12;
        const seriesByName: Record<string, Array<{ date: string; value: number }>> = {};
        for (const item of validItems) {
            if (!item.result) continue;
            seriesByName[item.name] = Object.keys(item.result.idxMap).sort().map((d) => ({
                date: d,
                value: item.result!.idxMap[d]
            }));
        }

        const base = seriesByName[validItems[0].name];
        if (!base || base.length <= period) return [];

        return base.slice(period).map((pt, i) => {
            const idx = i + period;
            const row: Record<string, any> = { date: pt.date };

            for (const item of validItems) {
                const arr = seriesByName[item.name];
                if (!arr || arr.length <= idx) continue;
                const start = arr[idx - period];
                const end = arr[idx];
                if (start?.value && end?.value) {
                    row[item.name] = (Math.pow(end.value / start.value, 1 / rollingYears) - 1) * 100;
                }
            }
            return row;
        });
    }, [validItems, rollingYears]);

    const annualComparisonData = useMemo(() => {
        if (validItems.length < 2) return [];

        const byName: Record<string, Array<{ year: string; value: number }>> = {};
        const years = new Set<string>();

        for (const item of validItems) {
            if (!item.result) continue;
            const annual = computeAnnualReturns(item.result.idxMap).map((a) => ({
                year: String(a.year),
                value: a.nominal * 100
            }));
            byName[item.name] = annual;
            annual.forEach((a) => years.add(a.year));
        }

        const yearList = Array.from(years).sort();

        return yearList.map((year) => {
            const row: Record<string, any> = { year };
            for (const item of validItems) {
                const v = (byName[item.name] || []).find((a) => a.year === year);
                if (v) row[item.name] = v.value;
            }
            return row;
        });
    }, [validItems]);

    const drawdownComparisonData = useMemo(() => {
        if (validItems.length < 2) return [];
        if (!validItems[0]?.result) return [];

        const dates = Object.keys(validItems[0].result.idxMap).sort();
        const ddMaps: Record<string, Record<string, number>> = {};
        for (const item of validItems) {
            if (!item.result) continue;
            ddMaps[item.name] = item.result.drawdowns.reduce((acc, d) => {
                acc[d.date] = d.value * 100;
                return acc;
            }, {} as Record<string, number>);
        }

        return dates.map((date) => {
            const row: Record<string, any> = { date };
            for (const item of validItems) {
                const v = ddMaps[item.name]?.[date];
                if (v !== undefined) row[item.name] = v;
            }
            return row;
        });
    }, [validItems]);

    const handleAddItem = () => {
        const idsToAdd = selectedForAdd.length > 0
            ? selectedForAdd
            : (typeToAdd === "portfolio" ? savedPortfolios.map(p => p.id) : assets);

        const itemsToAdd = idsToAdd
            .map(id => {
                let newItem: AnalysisItem | null = null;

                if (typeToAdd === "portfolio") {
                    const p = savedPortfolios.find(sp => sp.id === id);
                    if (p) {
                        newItem = {
                            id: p.id,
                            type: "portfolio",
                            name: p.name,
                            color: COLORS[(selectedItems.length + idsToAdd.indexOf(id)) % COLORS.length],
                            result: null
                        };
                    }
                } else {
                    newItem = {
                        id,
                        type: "asset",
                        name: id,
                        color: COLORS[(selectedItems.length + idsToAdd.indexOf(id)) % COLORS.length],
                        result: null
                    };
                }

                return newItem;
            })
            .filter(item => item !== null && !selectedItems.find(i => i.id === item!.id && i.type === item!.type)) as AnalysisItem[];

        if (itemsToAdd.length > 0) {
            setSelectedItems([...selectedItems, ...itemsToAdd]);
            setSelectedForAdd([]);
        }
    };

    const handleToggleSelection = (id: string) => {
        const isCurrentlySelected = selectedForAdd.includes(id);
        if (!isCurrentlySelected) {
            let newItem: AnalysisItem | null = null;
            if (typeToAdd === "portfolio") {
                const p = savedPortfolios.find(sp => sp.id === id);
                if (p) {
                    newItem = {
                        id: p.id,
                        type: "portfolio",
                        name: p.name,
                        color: COLORS[selectedItems.length % COLORS.length],
                        result: null
                    };
                }
            } else {
                newItem = {
                    id,
                    type: "asset",
                    name: id,
                    color: COLORS[selectedItems.length % COLORS.length],
                    result: null
                };
            }

            if (newItem && !selectedItems.find(i => i.id === newItem!.id && i.type === newItem!.type)) {
                setSelectedItems([...selectedItems, newItem]);
            }
        } else {
            const itemToRemove = selectedItems.find(i => i.id === id && i.type === typeToAdd);
            if (itemToRemove) {
                const index = selectedItems.indexOf(itemToRemove);
                if (index > -1) {
                    const newItems = [...selectedItems];
                    newItems.splice(index, 1);
                    setSelectedItems(newItems);
                }
            }
        }

        setSelectedForAdd(prev =>
            prev.includes(id)
                ? prev.filter(item => item !== id)
                : [...prev, id]
        );
    };

    const handleSort = (key: string) => {
        setSortConfig(current => {
            if (!current || current.key !== key) {
                return { key, direction: "asc" };
            }
            if (current.direction === "asc") {
                return { key, direction: "desc" };
            }
            return null;
        });
    };

    const handleRemoveAllAssets = () => {
        const assetItems = selectedItems.filter(item => item.type === "asset");
        const newItems = selectedItems.filter(item => item.type !== "asset");
        setSelectedItems(newItems);
        setSelectedForAdd(prev => prev.filter(id => !assetItems.some(item => item.id === id)));
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...selectedItems];
        const removed = newItems[index];
        newItems.splice(index, 1);
        setSelectedItems(newItems);
        if (removed) {
            setSelectedForAdd(prev => prev.filter(id => id !== removed.id));
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const primaryResult = validItems[0]?.result || portfolio;
    const calcKey = `${investmentMode}|${rebalance}|${startDate}|${endDate}|${initialInvestment}|${monthlyInvestment}`;

    return (
        <div className="flex flex-col gap-6">
            <PortfolioControls />

            <Card>
                <CardHeader>
                    <CardTitle>Select Items to Analyze</CardTitle>
                    <CardDescription>Choose portfolios and assets to compare performance.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-4">
                        <div className="space-y-4">
                            <Tabs value={typeToAdd} onValueChange={(v: any) => { setTypeToAdd(v); setSelectedForAdd([]); }}>
                                <div className="flex items-center gap-2">
                                    <TabsList>
                                        <TabsTrigger value="portfolio">Portfolios</TabsTrigger>
                                        <TabsTrigger value="asset">Assets</TabsTrigger>
                                    </TabsList>
                                    {typeToAdd === "asset" && assets.every(a => selectedItems.some(item => item.type === "asset" && item.id === a)) && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={handleRemoveAllAssets}
                                            title="Remove all assets"
                                        >
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={handleAddItem}
                                        disabled={
                                            (typeToAdd === "portfolio" 
                                                ? savedPortfolios.every(p => selectedItems.some(item => item.type === "portfolio" && item.id === p.id))
                                                : assets.every(a => selectedItems.some(item => item.type === "asset" && item.id === a))
                                            ) || (typeToAdd === "portfolio" ? savedPortfolios.length === 0 : assets.length === 0)
                                        }
                                        title={
                                            (typeToAdd === "portfolio" 
                                                ? savedPortfolios.every(p => selectedItems.some(item => item.type === "portfolio" && item.id === p.id))
                                                : assets.every(a => selectedItems.some(item => item.type === "asset" && item.id === a))
                                            )
                                                ? "All items already selected"
                                                : selectedForAdd.length === 0
                                                    ? `Add all ${typeToAdd === "portfolio" ? savedPortfolios.length : assets.length} ${typeToAdd === "portfolio" ? "portfolio" : "asset"}${(typeToAdd === "portfolio" ? savedPortfolios.length : assets.length) !== 1 ? "s" : ""}`
                                                    : `Add ${selectedForAdd.length} item${selectedForAdd.length !== 1 ? "s" : ""}`
                                        }
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>

                                <TabsContent value="portfolio">
                                    <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                                        <div className="space-y-2">
                                            {savedPortfolios.map(p => (
                                                <div key={p.id} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={p.id}
                                                        checked={selectedForAdd.includes(p.id) || selectedItems.some(item => item.type === "portfolio" && item.id === p.id)}
                                                        onCheckedChange={() => handleToggleSelection(p.id)}
                                                    />
                                                    <label
                                                        htmlFor={p.id}
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                    >
                                                        {p.name}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="asset">
                                    <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                                        <div className="space-y-2">
                                            {assets.map(a => (
                                                <div key={a} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={a}
                                                        checked={selectedForAdd.includes(a) || selectedItems.some(item => item.type === "asset" && item.id === a)}
                                                        onCheckedChange={() => handleToggleSelection(a)}
                                                    />
                                                    <label
                                                        htmlFor={a}
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                    >
                                                        {a}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>

                        </div>

                        <div className="flex flex-wrap gap-2 mt-4">
                            {selectedItems.map((item, idx) => (
                                <Badge
                                    key={`${item.type}-${item.id}`}
                                    variant="outline"
                                    className="pl-2 pr-1 py-1 flex items-center gap-1"
                                    style={{ borderColor: item.color }}
                                >
                                    <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: item.color }}></span>
                                    {item.name}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-4 w-4 ml-1 hover:bg-transparent"
                                        onClick={() => handleRemoveItem(idx)}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </Badge>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-6">
                <h2 className="text-xl font-semibold tracking-tight">Performance Analysis</h2>

                {validItems.length > 1 ? (
                    <Card key={`metrics-${calcKey}`}>
                        <CardHeader>
                            <CardTitle>Key Metrics</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead onClick={() => handleSort("name")} className="cursor-pointer hover:bg-muted/50">
                                                <div className="flex items-center justify-between">
                                                    Strategy
                                                    {sortConfig?.key === "name" && (
                                                        sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                                                    )}
                                                </div>
                                            </TableHead>
                                            <TableHead onClick={() => handleSort("cagrValue")} className="cursor-pointer hover:bg-muted/50 text-right">
                                                <div className="flex items-center justify-end">
                                                    CAGR
                                                    {sortConfig?.key === "cagrValue" && (
                                                        sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                                                    )}
                                                </div>
                                            </TableHead>
                                            <TableHead onClick={() => handleSort("volValue")} className="cursor-pointer hover:bg-muted/50 text-right">
                                                <div className="flex items-center justify-end">
                                                    Volatility
                                                    {sortConfig?.key === "volValue" && (
                                                        sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                                                    )}
                                                </div>
                                            </TableHead>
                                            <TableHead onClick={() => handleSort("sharpeValue")} className="cursor-pointer hover:bg-muted/50 text-right">
                                                <div className="flex items-center justify-end">
                                                    Sharpe
                                                    {sortConfig?.key === "sharpeValue" && (
                                                        sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                                                    )}
                                                </div>
                                            </TableHead>
                                            <TableHead onClick={() => handleSort("sortinoValue")} className="cursor-pointer hover:bg-muted/50 text-right">
                                                <div className="flex items-center justify-end">
                                                    Sortino
                                                    {sortConfig?.key === "sortinoValue" && (
                                                        sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                                                    )}
                                                </div>
                                            </TableHead>
                                            <TableHead onClick={() => handleSort("maxDDValue")} className="cursor-pointer hover:bg-muted/50 text-right">
                                                <div className="flex items-center justify-end">
                                                    Max DD
                                                    {sortConfig?.key === "maxDDValue" && (
                                                        sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                                                    )}
                                                </div>
                                            </TableHead>
                                            <TableHead onClick={() => handleSort("recoveryMonthsValue")} className="cursor-pointer hover:bg-muted/50 text-right">
                                                <div className="flex items-center justify-end">
                                                    Longest Recovery
                                                    {sortConfig?.key === "recoveryMonthsValue" && (
                                                        sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                                                    )}
                                                </div>
                                            </TableHead>
                                            <TableHead onClick={() => handleSort("avgRolling10YearCAGRValue")} className="cursor-pointer hover:bg-muted/50 text-right">
                                                <div className="flex items-center justify-end">
                                                    Avg 10Y Rolling CAGR
                                                    {sortConfig?.key === "avgRolling10YearCAGRValue" && (
                                                        sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                                                    )}
                                                </div>
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {metricsTableRows.map((row) => (
                                            <TableRow key={row.key}>
                                                <TableCell className="font-medium">{row.name}</TableCell>
                                                <TableCell className="text-right">{row.cagr}</TableCell>
                                                <TableCell className="text-right">{row.vol}</TableCell>
                                                <TableCell className="text-right">{row.sharpe}</TableCell>
                                                <TableCell className="text-right">{row.sortino}</TableCell>
                                                <TableCell className="text-right">{row.maxDD}</TableCell>
                                                <TableCell className="text-right">{row.recoveryMonths}</TableCell>
                                                <TableCell className="text-right text-blue-600">{row.avgRolling10YearCAGR}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <MetricsCards key={`metrics-cards-${calcKey}`} portfolio={primaryResult} rf={riskFreeRate} />
                )}

                {validItems.length > 1 && (
                    <Card key={`growth-${calcKey}`}>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Growth Comparison</CardTitle>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadCSV(chartData, "growth-comparison")}
                            >
                                <Download className="h-4 w-4 mr-2" />
                                CSV
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
                                            domain={["auto", "auto"]}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--card-foreground))" }}
                                            labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { year: "numeric", month: "long" })}
                                            formatter={(value: number, name: string) => [`€${value.toFixed(0)}`, name]}
                                        />
                                        <Legend />
                                        {validItems.map((item) => (
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
                )}

                {validItems.length > 1 ? (
                    <>
                        <Card key={`rolling-${calcKey}`}>
                            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div className="flex items-center gap-4">
                                    <div>
                                        <CardTitle>Rolling Returns</CardTitle>
                                        <CardDescription>Annualized return over {rollingYears}-year rolling periods.</CardDescription>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => downloadCSV(rollingComparisonData, "rolling-returns")}
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        CSV
                                    </Button>
                                </div>
                                <div className="w-full md:w-[180px]">
                                    <Select value={String(rollingYears)} onValueChange={(v: any) => setRollingYears(Number(v))}>
                                        <SelectTrigger>
                                            <SelectValue />
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
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={rollingComparisonData}>
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
                                                tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                                                domain={["auto", "auto"]}
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--card-foreground))" }}
                                                labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { year: "numeric", month: "long" })}
                                                formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name]}
                                            />
                                            <Legend />
                                            {validItems.map((item) => (
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

                        <Card key={`annual-${calcKey}`}>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Annual Returns</CardTitle>
                                    <CardDescription>Year-over-year performance.</CardDescription>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => downloadCSV(annualComparisonData, "annual-returns")}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    CSV
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={annualComparisonData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
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
                                                tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                                                domain={["auto", "auto"]}
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--card-foreground))" }}
                                                formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name]}
                                            />
                                            <Legend />
                                            {validItems.map((item) => (
                                                <Bar key={item.name} dataKey={item.name} fill={item.color} />
                                            ))}
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        <Card key={`drawdowns-${calcKey}`}>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Drawdowns</CardTitle>
                                    <CardDescription>Historical decline from peak.</CardDescription>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => downloadCSV(drawdownComparisonData, "drawdowns")}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    CSV
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={drawdownComparisonData}>
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
                                                tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--card-foreground))" }}
                                                labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { year: "numeric", month: "long" })}
                                                formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name]}
                                            />
                                            <Legend />
                                            {validItems.map((item) => (
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

                        <TimeToRecoveryChart
                            key={`recovery-${calcKey}`}
                            portfolio={primaryResult}
                            items={validItems.map((i) => ({ name: i.name, color: i.color, result: i.result }))}
                        />
                    </>
                ) : (
                    <>
                        <PortfolioChart key={`single-growth-${calcKey}`} portfolio={primaryResult} />
                        <InflationImpactChart key={`single-inflation-${calcKey}`} portfolio={primaryResult} />
                        <EfficientFrontierChart
                            key={`single-frontier-${calcKey}`}
                            norm={norm}
                            weights={weights}
                            startDate={startDate}
                            endDate={endDate}
                            rf={riskFreeRate}
                        />
                        <RollingReturnsChart key={`single-rolling-${calcKey}`} portfolio={primaryResult} />

                        <div className="grid gap-6 md:grid-cols-2">
                            <AnnualReturnsChart key={`single-annual-${calcKey}`} portfolio={primaryResult} />
                            <DrawdownChart key={`single-dd-${calcKey}`} portfolio={primaryResult} />
                            <TimeToRecoveryChart key={`single-recovery-${calcKey}`} portfolio={primaryResult} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
