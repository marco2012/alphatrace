"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cagr, annualVol, sharpe, sortino, PortfolioResult } from "@/lib/finance";

interface MetricsCardsProps {
    portfolio: PortfolioResult | null;
    rf?: number;
}

export function MetricsCards({ portfolio, rf = 0.02 }: MetricsCardsProps) {
    if (!portfolio) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {["CAGR", "Volatility", "Sharpe Ratio", "Max Drawdown"].map((label) => (
                    <Card key={label}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{label}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">--</div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    const { portRets, drawdowns } = portfolio;

    // Calculate Metrics
    const cagrVal = cagr(Object.keys(portfolio.idxMap).map(d => ({ value: portfolio.idxMap[d] }))); // Helper expects objects with value?
    // Wait, my cagr helper in finance.ts expects { value: number }[]
    // But computePortfolio returns idxMap. I should map it correctly.
    // Actually, finance.ts cagr expects indexSeries which is { value: number }[]?
    // Let's check finance.ts:
    // export function cagr(indexSeries: { value: number }[]): number ...
    // Yes.

    // It's easier to use normalizedIndex array? computePortfolio returns portRets and idxMap.
    // computePortfolio internal idx array is not exposed directly except via idxMap.
    // computeRecurringPortfolio exposes normalizedIndex.
    // computePortfolio exposes idxMap.

    // Let's convert idxMap to array.
    const idxArray = Object.keys(portfolio.idxMap).sort().map(d => ({ value: portfolio.idxMap[d] }));
    const cagrValue = cagr(idxArray);

    const volValue = annualVol(portRets);
    const sharpeValue = sharpe(portRets, rf);

    // Max Drawdown
    const maxDD = drawdowns.reduce((min, d) => Math.min(min, d.value), 0);

    const formatPercent = (v: number) => `${(v * 100).toFixed(2)}%`;
    const formatNumber = (v: number) => v.toFixed(2);

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">CAGR</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {formatPercent(cagrValue)}
                    </div>
                    <p className="text-xs text-muted-foreground">Compound Annual Growth Rate</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Volatility</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {formatPercent(volValue)}
                    </div>
                    <p className="text-xs text-muted-foreground">Annualized Standard Deviation</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Sharpe Ratio</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {formatNumber(sharpeValue)}
                    </div>
                    <p className="text-xs text-muted-foreground">Risk-adjusted return (Rf={(rf * 100).toFixed(0)}%)</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Max Drawdown</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {formatPercent(maxDD)}
                    </div>
                    <p className="text-xs text-muted-foreground">Calculated from peak</p>
                </CardContent>
            </Card>
        </div>
    );
}
