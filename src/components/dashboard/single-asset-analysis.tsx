"use client";

import { useMemo, useState } from "react";
import { usePortfolio } from "@/context/portfolio-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { PortfolioChart } from "@/components/dashboard/portfolio-chart";
import { AnnualReturnsChart } from "@/components/dashboard/annual-returns-chart";
import { DrawdownChart } from "@/components/dashboard/drawdown-chart";
import { RollingReturnsChart } from "@/components/dashboard/rolling-returns-chart";
import { TimeToRecoveryChart } from "@/components/dashboard/recovery-chart";
import { getAssetSourceType } from "@/lib/finance";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function SingleAssetAnalysis() {
    const { columns, computeAssetPortfolio } = usePortfolio();
    const [selectedAsset, setSelectedAsset] = useState<string>("");

    // Default to first asset if none selected, or handle empty
    const currentAsset = selectedAsset || (columns.length > 0 ? columns[0] : "");

    const result = useMemo(() => {
        if (!currentAsset) return null;
        return computeAssetPortfolio(currentAsset);
    }, [currentAsset, computeAssetPortfolio]);

    const currentSourceType = currentAsset ? getAssetSourceType(currentAsset) : null;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Select Asset</CardTitle>
                    <CardDescription>Choose an asset to analyze individually.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-2">
                        <Label>Asset</Label>
                        <Select value={currentAsset} onValueChange={setSelectedAsset}>
                            <SelectTrigger className="w-full md:w-[400px]">
                                <SelectValue placeholder="Select an asset" />
                            </SelectTrigger>
                            <SelectContent>
                                {columns.map(c => {
                                    const st = getAssetSourceType(c);
                                    return (
                                        <SelectItem key={c} value={c}>
                                            <div className="flex items-center gap-2">
                                                <span>{c}</span>
                                                <Badge 
                                                    variant="outline" 
                                                    className={cn(
                                                        "text-[8px] uppercase px-1 py-0 border-[0.5px] font-normal",
                                                        st === "live" 
                                                            ? "text-indigo-600 border-indigo-200" 
                                                            : "text-slate-500 border-slate-200"
                                                    )}
                                                >
                                                    {st === "live" ? "API" : "File"}
                                                </Badge>
                                            </div>
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {result && (
                <>
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-semibold tracking-tight">Performance: {currentAsset}</h2>
                        <Badge 
                            variant="outline" 
                            className={cn(
                                "text-[10px] uppercase font-semibold",
                                currentSourceType === "live" 
                                    ? "text-indigo-600 border-indigo-200 bg-indigo-50/30" 
                                    : "text-slate-500 border-slate-200 bg-slate-50/30"
                            )}
                        >
                            {currentSourceType === "live" ? "Live API Data" : "Manual File Data"}
                        </Badge>
                    </div>
                    <MetricsCards portfolio={result} />
                    <PortfolioChart portfolio={result} />

                    <div className="grid gap-6 md:grid-cols-2">
                        <AnnualReturnsChart portfolio={result} />
                        <DrawdownChart
                            portfolios={[{
                                name: currentAsset,
                                portfolio: result,
                                color: "#2563eb"
                            }]}
                        />
                        <RollingReturnsChart portfolio={result} />
                        <TimeToRecoveryChart portfolio={result} />
                    </div>
                </>
            )}
        </div>
    );
}
