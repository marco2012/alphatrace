"use client";

import { useMemo, useState } from "react";
import { usePortfolio, SavedPortfolio } from "@/context/portfolio-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Download } from "lucide-react";
import { PortfolioResult, cagr, annualVol, sharpe, maxDrawdown } from "@/lib/finance";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
];

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
                    color: COLORS[selectedItems.length % COLORS.length],
                    result: null
                };
            }
        } else {
            // Asset
            newItem = {
                id: itemToAdd,
                type: 'asset',
                name: itemToAdd,
                color: COLORS[selectedItems.length % COLORS.length],
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

        // Use the dates from the first item (assuming same timeframe due to global controls)
        const dates = Object.keys(itemsWithResults[0].result.idxMap).sort();

        return dates.map(date => {
            const point: any = { date };
            itemsWithResults.forEach(item => {
                if (item.result && item.result.idxMap[date] !== undefined) {
                    point[item.name] = item.result.idxMap[date];
                }
            });
            return point;
        });
    }, [itemsWithResults]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Compare</CardTitle>
                    <CardDescription>Compare saved portfolios and assets.</CardDescription>
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
                            <Download className="mr-2 h-4 w-4" /> CSV
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
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--card-foreground))' }}
                                        labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
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
                                    <TableHead>CAGR</TableHead>
                                    <TableHead>Vol (Ann)</TableHead>
                                    <TableHead>Sharpe</TableHead>
                                    <TableHead>Max DD</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {itemsWithResults.map((item) => {
                                    if (!item.result) return null;
                                    const cagrVal = cagr(Object.keys(item.result.idxMap).sort().map(d => ({ value: item.result!.idxMap[d] })));
                                    const volVal = annualVol(item.result.portRets);
                                    const sharpeVal = sharpe(item.result.portRets, 0.02); // assuming rf=2%
                                    const maxDD = item.result.drawdowns.reduce((min, d) => Math.min(min, d.value), 0);

                                    return (
                                        <TableRow key={item.name}>
                                            <TableCell className="font-medium flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                                                {item.name}
                                            </TableCell>
                                            <TableCell className={(cagrVal >= 0 ? "text-green-600" : "text-red-600")}>{(cagrVal * 100).toFixed(2)}%</TableCell>
                                            <TableCell>{(volVal * 100).toFixed(2)}%</TableCell>
                                            <TableCell>{sharpeVal.toFixed(2)}</TableCell>
                                            <TableCell className="text-red-600">{(maxDD * 100).toFixed(2)}%</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <AnnualReturnsChart portfolio={itemsWithResults.find(item => item.id === 'current')?.result || null} />
                <DrawdownChart portfolio={itemsWithResults.find(item => item.id === 'current')?.result || null} />
                <RollingReturnsChart portfolio={itemsWithResults.find(item => item.id === 'current')?.result || null} />
                <TimeToRecoveryChart portfolio={itemsWithResults.find(item => item.id === 'current')?.result || null} />
            </div>
        </div>
    );
}
