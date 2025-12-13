"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cagr, cagrRecurring, annualVol, sharpe, sortino, PortfolioResult, averageRolling10YearCAGR } from "@/lib/finance";

interface MetricsCardsProps {
    portfolio: PortfolioResult | null;
    rf?: number;
}

export function MetricsCards({ portfolio, rf = 0.02 }: MetricsCardsProps) {
    if (!portfolio) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                {["CAGR", "Volatility", "Sharpe Ratio", "Max Drawdown", "Avg 10Y Rolling CAGR"].map((label) => (
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

    const cagrValue = (portfolio.portValues && portfolio.totalInvested && portfolio.portValues.length === portfolio.totalInvested.length)
        ? cagrRecurring(portfolio.portValues, portfolio.totalInvested)
        : cagr(Object.keys(portfolio.idxMap).sort().map(d => ({ value: portfolio.idxMap[d] })));

    const volValue = annualVol(portRets);
    const sharpeValue = sharpe(portRets, rf);

    // Max Drawdown
    const maxDD = drawdowns.reduce((min, d) => Math.min(min, d.value), 0);

    // Average Rolling 10-Year CAGR
    const avgRolling10YearCAGR = averageRolling10YearCAGR(portfolio);

    const formatPercent = (v: number) => `${(v * 100).toFixed(2)}%`;
    const formatNumber = (v: number) => v.toFixed(2);

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg 10Y Rolling CAGR</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {formatPercent(avgRolling10YearCAGR)}
                    </div>
                    <p className="text-xs text-muted-foreground">Average of rolling 10-year CAGRs</p>
                </CardContent>
            </Card>
        </div>
    );
}
