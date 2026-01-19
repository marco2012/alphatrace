"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cagr, cagrRecurring, annualVol, sharpe, sortino, PortfolioResult, averageRolling10YearCAGR, calmar, ulcerIndex } from "@/lib/finance";

interface MetricsCardsProps {
    portfolio: PortfolioResult | null;
    rf?: number;
    cape?: number | null;
}

export function MetricsCards({ portfolio, rf = 0.02, cape }: MetricsCardsProps) {
    if (!portfolio) {
        return (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                {["Cumulative Return", "CAGR", "Volatility", "Sharpe Ratio", "Sortino Ratio", "Max Drawdown", "Calmar Ratio", "Ulcer Index", "Avg 10Y Rolling CAGR", "Portfolio CAPE"].map((label) => (
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

    const { portRets, drawdowns, portValues, totalInvested } = portfolio;

    const cagrValue = (portValues && totalInvested && portValues.length === totalInvested.length)
        ? cagrRecurring(portValues, totalInvested)
        : cagr(Object.keys(portfolio.idxMap).sort().map(d => ({ value: portfolio.idxMap[d] })));

    // Cumulative Return
    let cumulativeReturn = 0;
    if (portValues && totalInvested && portValues.length > 0) {
        const finalValue = portValues[portValues.length - 1];
        const invested = totalInvested[totalInvested.length - 1];
        cumulativeReturn = invested !== 0 ? (finalValue / invested) - 1 : 0;
    }

    const volValue = annualVol(portRets);
    const sharpeValue = sharpe(portRets, rf);
    const sortinoValue = sortino(portRets, rf);

    // Max Drawdown
    const maxDD = drawdowns.reduce((min, d) => Math.min(min, d.value), 0);

    // Calmar Ratio
    const calmarValue = calmar(cagrValue, maxDD);

    // Ulcer Index
    const ulcerIndexValue = ulcerIndex(drawdowns);

    const avgRolling10YearCAGR = averageRolling10YearCAGR(portfolio);

    const formatPercent = (v: number) => `${(v * 100).toFixed(2)}%`;
    const formatNumber = (v: number) => v.toFixed(2);

    return (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Cumulative Return</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {formatPercent(cumulativeReturn)}
                    </div>
                    <p className="text-xs text-muted-foreground">Total percentage gain/loss</p>
                </CardContent>
            </Card>
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
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {formatNumber(sharpeValue)}
                    </div>
                    <p className="text-xs text-muted-foreground">Risk-adjusted return (Rf={(rf * 100).toFixed(0)}%)</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Sortino Ratio</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {formatNumber(sortinoValue)}
                    </div>
                    <p className="text-xs text-muted-foreground">Risk-adj return (downside risk)</p>
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
                    <p className="text-xs text-muted-foreground">Maximum peak-to-trough decline</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Calmar Ratio</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {formatNumber(calmarValue)}
                    </div>
                    <p className="text-xs text-muted-foreground">CAGR / Max Drawdown</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ulcer Index</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {formatNumber(ulcerIndexValue)}
                    </div>
                    <p className="text-xs text-muted-foreground">Depth/duration of drawdowns</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg 10Y Rolling CAGR</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                        {formatPercent(avgRolling10YearCAGR)}
                    </div>
                    <p className="text-xs text-muted-foreground">Average of rolling 10Y periods</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Portfolio CAPE</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {cape ? formatNumber(cape) : "--"}
                    </div>
                    <p className="text-xs text-muted-foreground">Weighted average CAPE (Equity)</p>
                </CardContent>
            </Card>
        </div>
    );
}
