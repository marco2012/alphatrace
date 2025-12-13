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

export function SingleAssetAnalysis() {
    const { columns, computeAssetPortfolio } = usePortfolio();
    const [selectedAsset, setSelectedAsset] = useState<string>("");

    // Default to first asset if none selected, or handle empty
    const currentAsset = selectedAsset || (columns.length > 0 ? columns[0] : "");

    const result = useMemo(() => {
        if (!currentAsset) return null;
        return computeAssetPortfolio(currentAsset);
    }, [currentAsset, computeAssetPortfolio]);

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
                            <SelectTrigger className="w-full md:w-[300px]">
                                <SelectValue placeholder="Select an asset" />
                            </SelectTrigger>
                            <SelectContent>
                                {columns.map(c => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {result && (
                <>
                    <h2 className="text-xl font-semibold tracking-tight">Performance: {currentAsset}</h2>
                    <MetricsCards portfolio={result} />
                    <PortfolioChart portfolio={result} />

                    <div className="grid gap-6 md:grid-cols-2">
                        <AnnualReturnsChart portfolio={result} />
                        <DrawdownChart portfolio={result} />
                        <RollingReturnsChart portfolio={result} />
                        <TimeToRecoveryChart portfolio={result} />
                    </div>
                </>
            )}
        </div>
    );
}
