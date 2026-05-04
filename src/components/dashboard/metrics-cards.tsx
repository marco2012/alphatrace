"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { annualVol, sharpe, sortino, PortfolioResult, averageRolling10YearCAGR, averageRolling10YearMWR, calmar, ulcerIndex, twrr, mwr, downsideDeviation, computeAnnualReturns } from "@/lib/finance";
import { usePortfolio } from "@/context/portfolio-context";

interface MetricsCardsProps {
    portfolio: PortfolioResult | null;
    rf?: number;
    cape?: number | null;
}

export function MetricsCards({ portfolio, rf = 0.02, cape }: MetricsCardsProps) {
    const { investmentMode } = usePortfolio();

    if (!portfolio) {
        const skeletonLabels = [
            "Cumulative Return", "TWR", "MWR",
            "Volatility", "Downside Volatility", "Sharpe Ratio", "Sortino Ratio",
            "Max Drawdown", "Calmar Ratio", "Ulcer Index",
            "Positive Years", "Longest Losing Streak",
            "Avg 10Y Rolling TWR", "Avg 10Y Rolling MWR", "Portfolio CAPE"
        ];
        return (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                {skeletonLabels.map((label) => (
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

    const { portRets, drawdowns, portValues, totalInvested, dates } = portfolio;

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
    const downsideVolValue = downsideDeviation(portRets, rf);
    const annualReturns = computeAnnualReturns(portfolio.idxMap);
    const positiveYearsCount = annualReturns.filter((a) => a.nominal > 0).length;
    const totalYearsCount = annualReturns.length;
    const positiveYearsPctValue = totalYearsCount ? positiveYearsCount / totalYearsCount : 0;
    let longestLosingStreakYearsValue = 0;
    let currentLosingStreak = 0;
    for (const a of annualReturns) {
        if (a.nominal < 0) {
            currentLosingStreak++;
            if (currentLosingStreak > longestLosingStreakYearsValue) {
                longestLosingStreakYearsValue = currentLosingStreak;
            }
        } else {
            currentLosingStreak = 0;
        }
    }

    let actualDrawdowns = drawdowns;
    if ((investmentMode === "recurring" || investmentMode === "hybrid") && portValues && dates.length === portValues.length) {
        let maxSF = -Infinity;
        actualDrawdowns = [];
        for (let i = 0; i < dates.length; i++) {
            const v = portValues[i];
            if (v > maxSF) maxSF = v;
            actualDrawdowns.push({ date: dates[i], value: maxSF > 0 ? v / maxSF - 1 : 0 });
        }
    }

    // Max Drawdown
    const maxDD = actualDrawdowns.reduce((min, d) => Math.min(min, d.value), 0);

    // Ulcer Index
    const ulcerIndexValue = ulcerIndex(actualDrawdowns);

    const avgRolling10YearCAGR = averageRolling10YearCAGR(portfolio);
    const avgRolling10YearMWR = averageRolling10YearMWR(portfolio);
    const sharpe10YValue = volValue !== 0 ? (avgRolling10YearCAGR - rf) / volValue : 0;
    const years = portRets.length / 12;
    const twrrValue = twrr(portRets, years);
    const mwrValue = mwr(portValues, totalInvested);

    // Calmar Ratio — TWR as numerator (equals CAGR for lump sum; correct for DCA/hybrid)
    const calmarValue = calmar(twrrValue, maxDD);
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
                    <CardTitle className="text-sm font-medium">TWR</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {formatPercent(twrrValue)}
                    </div>
                    <p className="text-xs text-muted-foreground">Time-Weighted Rate of Return</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">MWR</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {formatPercent(mwrValue)}
                    </div>
                    <p className="text-xs text-muted-foreground">Money-Weighted Return (IRR)</p>
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
                    <CardTitle className="text-sm font-medium">Downside Volatility</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {formatPercent(downsideVolValue)}
                    </div>
                    <p className="text-xs text-muted-foreground">Annualized downside deviation</p>
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
                    <CardTitle className="text-sm font-medium">Sharpe (10Y)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {avgRolling10YearCAGR !== 0 ? formatNumber(sharpe10YValue) : "--"}
                    </div>
                    <p className="text-xs text-muted-foreground">Sharpe using Avg 10Y CAGR</p>
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
                    <p className="text-xs text-muted-foreground">TWR / Max Drawdown</p>
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
                    <CardTitle className="text-sm font-medium">Positive Years</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-lime-600 dark:text-lime-400">
                        {Math.round(positiveYearsPctValue * 100)}% ({positiveYearsCount}/{totalYearsCount})
                    </div>
                    <p className="text-xs text-muted-foreground">Share of calendar years &gt; 0%</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Longest Losing Streak</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                        {longestLosingStreakYearsValue}y
                    </div>
                    <p className="text-xs text-muted-foreground">Consecutive negative years</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg 10Y Rolling TWR</CardTitle>
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
                    <CardTitle className="text-sm font-medium">Avg 10Y Rolling MWR</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                        {formatPercent(avgRolling10YearMWR)}
                    </div>
                    <p className="text-xs text-muted-foreground">Average of rolling 10Y IRR periods</p>
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
