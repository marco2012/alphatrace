"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Scale, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAssetCategory } from "@/lib/finance";
import { usePortfolio } from "@/context/portfolio-context";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface AssetAllocationProps {
    weights: Record<string, number>;
    onWeightChange: (asset: string, value: number) => void;
    assets: string[];
    portfolioName?: string | null;
}

export function AssetAllocation({ weights, onWeightChange, assets, portfolioName }: AssetAllocationProps) {
    const { norm } = usePortfolio();
    const formatPercent = (val: number) => Math.round(val * 100);

    const formatDate = (d: string) => {
        if (!d || d === "0000-00-00" || d === "9999-12-31") return "";
        const [y, m] = d.split("-");
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${months[parseInt(m, 10) - 1]} ${y}`;
    };
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    const totalPercent = Math.round(totalWeight * 100);
    const isValid = totalPercent === 100;

    const normalize = () => {
        if (totalWeight === 0) return;
        assets.forEach(asset => {
            const current = weights[asset] || 0;
            const newWeight = current / totalWeight;
            onWeightChange(asset, newWeight);
        });
    };

    const handleReset = () => {
        assets.forEach(asset => {
            onWeightChange(asset, 0);
        });
    };

    const handleInputChange = (asset: string, valueStr: string) => {
        const val = parseFloat(valueStr);
        if (isNaN(val)) return;
        // constrain to 0-100
        const clamped = Math.min(Math.max(val, 0), 100);
        onWeightChange(asset, clamped / 100);
    };

    const getCategoryBadgeClass = (category: string) => {
        switch (category.toLowerCase()) {
            case "stocks": return "bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20 shadow-none";
            case "bonds": return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 shadow-none";
            case "cash": return "bg-slate-500/10 text-slate-700 dark:text-slate-400 hover:bg-slate-500/20 shadow-none";
            case "gold": return "bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 shadow-none";
            case "alternatives": return "bg-purple-500/10 text-purple-700 dark:text-purple-400 hover:bg-purple-500/20 shadow-none";
            default: return "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-none";
        }
    };

    return (
        <Card className="flex flex-col">
            <CardHeader className="pb-3 border-b shrink-0 px-6">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Asset Allocation</CardTitle>
                        <CardDescription className="flex flex-col gap-1">
                            <span>{portfolioName ? `Editing: ${portfolioName}` : "Adjust portfolio weights using manual inputs"}</span>
                            <span className="text-xs">Data source: <a href="https://curvo.eu/backtest/en/funds" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">curvo.eu/backtest</a></span>
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "flex items-center gap-2 font-bold text-sm mr-2",
                            isValid ? "text-green-500" : "text-amber-500"
                        )}>
                            {isValid ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                            {totalPercent}% Total
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleReset}
                            disabled={totalWeight === 0}
                            title="Reset to 0%"
                            className="text-muted-foreground hover:text-destructive"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={normalize}
                            disabled={totalWeight === 0 || isValid}
                            title="Normalize to 100%"
                        >
                            <Scale className="w-4 h-4 mr-2" />
                            Normalize
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-card shadow-sm">
                        <TableRow>
                            <TableHead className="hidden sm:table-cell w-[25%] pl-6">Category</TableHead>
                            <TableHead className="w-[70%] sm:w-[45%]">Asset</TableHead>
                            <TableHead className="text-right w-[30%] pr-6">Allocation (%)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {assets.map((asset) => {
                            const weight = weights[asset] ?? 0;
                            const percent = formatPercent(weight);
                            const category = getAssetCategory(asset);

                            return (
                                <TableRow
                                    key={asset}
                                    className={cn(
                                        "hover:bg-muted/50 transition-colors",
                                        weight > 0 && "bg-yellow-50 dark:bg-yellow-300/30"
                                    )}
                                >
                                    <TableCell className="hidden sm:table-cell py-2 pl-6">
                                        <Badge className={cn("font-medium text-xs uppercase rounded-md border-0", getCategoryBadgeClass(category))}>
                                            {category}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium py-2 text-foreground">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2 sm:hidden mb-1">
                                                <Badge className={cn("font-medium text-[9px] uppercase rounded-md border-0 px-1 py-0", getCategoryBadgeClass(category))}>
                                                    {category}
                                                </Badge>
                                            </div>
                                            <span>{asset}</span>
                                            {(() => {
                                                const firstValidDates = (norm as any)?.firstValidDates || {};
                                                const lastValidDates = (norm as any)?.lastValidDates || {};
                                                const start = firstValidDates[asset];
                                                const end = lastValidDates[asset];
                                                return start && end ? (
                                                    <span className="text-[10px] text-muted-foreground font-normal">
                                                        {formatDate(start)} - {formatDate(end)}
                                                    </span>
                                                ) : null;
                                            })()}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right py-2 pr-6">
                                        <div className="flex items-center justify-end gap-2">
                                            <Input
                                                type="number"
                                                value={percent}
                                                onChange={(e) => handleInputChange(asset, e.target.value)}
                                                onFocus={(e) => e.target.select()}
                                                className="h-8 w-16 text-right font-medium"
                                                min={0}
                                                max={100}
                                            />
                                            <span className="text-muted-foreground w-4 text-left">%</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
