"use client";

import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Scale, RotateCcw, Info, Zap, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAssetCategory, getAssetTER, getAssetSourceType } from "@/lib/finance";
import { usePortfolio } from "@/context/portfolio-context";
import { Badge } from "@/components/ui/badge";
import { ASSET_EXTERNAL_LINKS } from "@/lib/constants";
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
            <CardHeader className="pb-3 border-b shrink-0 px-4 sm:px-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <CardTitle>Asset Allocation</CardTitle>
                        <CardDescription className="flex flex-col gap-1 truncate">
                            <span className="truncate">{portfolioName ? `Editing: ${portfolioName}` : "Adjust portfolio weights manually"}</span>
                        </CardDescription>
                    </div>
                    <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto justify-between sm:justify-end">
                        <div className={cn(
                            "flex items-center gap-1.5 font-bold text-sm",
                            isValid ? "text-green-500" : "text-amber-500"
                        )}>
                            {isValid ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                            <span className="whitespace-nowrap">{totalPercent}% Total</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleReset}
                                disabled={totalWeight === 0}
                                title="Reset to 0%"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            >
                                <RotateCcw className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={normalize}
                                disabled={totalWeight === 0 || isValid}
                                title="Normalize to 100%"
                                className="h-8 px-2 text-xs"
                            >
                                <Scale className="w-3.5 h-3.5 mr-1.5" />
                                Normalize
                            </Button>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-card shadow-sm">
                            <TableRow>
                                <TableHead className="hidden sm:table-cell w-[25%] pl-6">Category</TableHead>
                                <TableHead className="w-[50%] sm:w-[35%] pl-4 sm:pl-2">Asset</TableHead>
                                <TableHead className="text-right w-[15%] sm:w-[10%] px-1 sm:px-4">TER</TableHead>
                                <TableHead className="text-right w-[35%] sm:w-[30%] pr-4 sm:pr-6">Allocation</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {[...assets].sort((a, b) => {
                                const catA = getAssetCategory(a).toLowerCase();
                                const catB = getAssetCategory(b).toLowerCase();
                                if (catA !== catB) return catB.localeCompare(catA); // category desc
                                return a.localeCompare(b); // asset asc
                            }).map((asset) => {
                                const weight = weights[asset] ?? 0;
                                const percent = formatPercent(weight);
                                const category = getAssetCategory(asset);
                                const sourceType = getAssetSourceType(asset);

                                return (
                                    <TableRow
                                        key={asset}
                                        className={cn(
                                            "hover:bg-muted/50 transition-colors",
                                            weight > 0 && "bg-yellow-50 dark:bg-yellow-300/30"
                                        )}
                                    >
                                        <TableCell className="hidden sm:table-cell py-2 pl-6">
                                            <div className="flex items-center gap-2">
                                                <Badge className={cn("font-medium text-[10px] h-5 uppercase rounded-md border-0 shrink-0", getCategoryBadgeClass(category))}>
                                                    {category}
                                                </Badge>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "text-[9px] h-4 items-center gap-0.5 uppercase px-1.5 py-0 border-0 rounded-full font-bold tracking-tight shrink-0",
                                                        sourceType === "live"
                                                            ? "text-indigo-600 bg-indigo-100/50 dark:bg-indigo-500/20 dark:text-indigo-300"
                                                            : "text-slate-500 bg-slate-100/50 dark:bg-slate-500/20 dark:text-slate-400"
                                                    )}
                                                >
                                                    {sourceType === "live" ? <Zap className="w-2.5 h-2.5 fill-current" /> : <FileText className="w-2.5 h-2.5" />}
                                                    {sourceType === "live" ? "API" : "FILE"}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium py-2 pl-4 sm:pl-2 text-foreground max-w-0">
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-2 sm:hidden mb-1">
                                                    <Badge className={cn("font-medium text-[9px] uppercase rounded-md border-0 px-1 py-0 shrink-0", getCategoryBadgeClass(category))}>
                                                        {category}
                                                    </Badge>
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            "text-[8px] items-center gap-0.5 leading-tight uppercase px-1.5 py-0 border-0 rounded-full font-bold shrink-0",
                                                            sourceType === "live"
                                                                ? "text-indigo-600 bg-indigo-100/50 dark:text-indigo-400"
                                                                : "text-slate-500 bg-slate-100/50"
                                                        )}
                                                    >
                                                        {sourceType === "live" ? <Zap className="w-2 h-2 fill-current" /> : <FileText className="w-2 h-2" />}
                                                        {sourceType === "live" ? "API" : "FILE"}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-1.5 group min-w-0">
                                                    <span className="truncate">{asset}</span>
                                                    {(() => {
                                                        const baseName = asset.replace(/ \((USD|EUR)\)$/, "");
                                                        const link = ASSET_EXTERNAL_LINKS[asset] || ASSET_EXTERNAL_LINKS[baseName];
                                                        if (!link) return null;
                                                        return (
                                                            <a
                                                                href={link}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-muted-foreground/40 hover:text-blue-500 transition-colors shrink-0"
                                                                title="View ETF details"
                                                            >
                                                                <Info className="w-3.5 h-3.5" />
                                                            </a>
                                                        );
                                                    })()}
                                                </div>
                                                {(() => {
                                                    const firstValidDates = (norm as any)?.firstValidDates || {};
                                                    const lastValidDates = (norm as any)?.lastValidDates || {};
                                                    const start = firstValidDates[asset];
                                                    const end = lastValidDates[asset];
                                                    return start && end ? (
                                                        <span className="text-[10px] text-muted-foreground font-normal truncate">
                                                            {formatDate(start)} - {formatDate(end)}
                                                        </span>
                                                    ) : null;
                                                })()}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right py-2 px-1 sm:px-4 text-muted-foreground font-mono text-[10px] sm:text-xs">
                                            {(getAssetTER(asset) * 100).toFixed(2)}%
                                        </TableCell>
                                        <TableCell className="text-right py-2 pr-4 sm:pr-6">
                                            <div className="flex items-center justify-end gap-1 sm:gap-2">
                                                <Input
                                                    type="number"
                                                    value={percent}
                                                    onChange={(e) => handleInputChange(asset, e.target.value)}
                                                    onFocus={(e) => e.target.select()}
                                                    className="h-8 w-12 sm:w-16 text-right font-medium px-1 sm:px-3 text-xs sm:text-sm"
                                                    min={0}
                                                    max={100}
                                                    step={5}
                                                />
                                                <span className="text-muted-foreground w-3 sm:w-4 text-left text-xs sm:text-sm">%</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
