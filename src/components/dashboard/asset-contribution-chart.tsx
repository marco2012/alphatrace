"use client";

import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { PortfolioResult, pctChangeSeries, stdev } from "@/lib/finance";
import { usePortfolio } from "@/context/portfolio-context";

interface PortfolioItem {
    name: string;
    portfolio: PortfolioResult;
    weights: Record<string, number>;
    color: string;
}

interface AssetContributionChartProps {
    items: PortfolioItem[];
}

export function AssetContributionChart({ items }: AssetContributionChartProps) {
    const { norm } = usePortfolio();

    if (!norm || items.length === 0) return null;

    const { series } = norm;

    const allAssets = new Set<string>();
    items.forEach(item => {
        Object.keys(item.weights).forEach(asset => {
            if (item.weights[asset] > 0) allAssets.add(asset);
        });
    });

    if (allAssets.size === 0) return null;

    const calculateContributions = (item: PortfolioItem) => {
        const { portfolio, weights } = item;
        const { portRets } = portfolio;
        const contributions: Record<string, { return: number; risk: number }> = {};

        for (const asset of allAssets) {
            const weight = weights[asset] || 0;
            if (weight === 0 || !series[asset]) {
                contributions[asset] = { return: 0, risk: 0 };
                continue;
            }

            const assetPrices = series[asset] as number[];
            const assetReturns = pctChangeSeries(assetPrices);

            const assetReturn = assetReturns.reduce((sum, r) => sum + r, 0) / assetReturns.length;
            const returnContribution = weight * assetReturn * 12;

            let covSum = 0;
            const meanPortRet = portRets.reduce((a, b) => a + b, 0) / portRets.length;
            const meanAssetRet = assetReturns.reduce((a, b) => a + b, 0) / assetReturns.length;
            
            for (let i = 0; i < Math.min(portRets.length, assetReturns.length); i++) {
                covSum += (portRets[i] - meanPortRet) * (assetReturns[i] - meanAssetRet);
            }
            const covariance = covSum / (Math.min(portRets.length, assetReturns.length) - 1);
            
            const portfolioVol = stdev(portRets) * Math.sqrt(12);
            const marginalRisk = (covariance * Math.sqrt(12)) / (portfolioVol || 1);
            const riskContribution = weight * marginalRisk;

            contributions[asset] = {
                return: returnContribution * 100,
                risk: riskContribution * 100,
            };
        }

        return contributions;
    };

    const portfolioContributions = items.map(item => ({
        name: item.name,
        color: item.color,
        contributions: calculateContributions(item),
    }));

    const returnData = Array.from(allAssets).map(asset => {
        const dataPoint: any = { asset };
        portfolioContributions.forEach(pc => {
            dataPoint[pc.name] = pc.contributions[asset].return;
        });
        return dataPoint;
    });

    const riskData = Array.from(allAssets).map(asset => {
        const dataPoint: any = { asset };
        portfolioContributions.forEach(pc => {
            dataPoint[pc.name] = pc.contributions[asset].risk;
        });
        return dataPoint;
    });

    const downloadCSV = () => {
        const headers = ['Asset', ...items.map(item => `${item.name} Return (%)`)];
        const rows = Array.from(allAssets).map(asset => {
            const row = [asset];
            portfolioContributions.forEach(pc => {
                row.push(pc.contributions[asset].return.toFixed(2));
            });
            return row;
        });

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'asset-contributions.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="grid gap-4 md:grid-cols-2">
            <Card>
                <CardHeader className="flex flex-col items-start justify-between gap-3 space-y-0 pb-2 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                        <CardTitle>Return Contribution by Asset</CardTitle>
                        <CardDescription>
                            How much each asset contributes to portfolio return
                        </CardDescription>
                    </div>
                    <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={downloadCSV}>
                        <Download className="h-4 w-4" />
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={returnData} margin={{ top: 8, right: 12, bottom: 60, left: 12 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis
                                    dataKey="asset"
                                    stroke="#888888"
                                    fontSize={12}
                                    tickMargin={8}
                                    tickLine={false}
                                    axisLine={false}
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                />
                                <YAxis
                                    stroke="#888888"
                                    fontSize={12}
                                    tickMargin={8}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `${value.toFixed(1)}%`}
                                />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--card-foreground))' }}
                                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                                    formatter={(value: number) => `${value.toFixed(2)}%`}
                                />
                                <Legend />
                                {portfolioContributions.map((pc) => (
                                    <Bar
                                        key={pc.name}
                                        dataKey={pc.name}
                                        stackId="a"
                                        fill={pc.color}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-col items-start justify-between gap-3 space-y-0 pb-2 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                        <CardTitle>Risk Contribution by Asset</CardTitle>
                        <CardDescription>
                            How much each asset contributes to portfolio risk
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={riskData} margin={{ top: 8, right: 12, bottom: 60, left: 12 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis
                                    dataKey="asset"
                                    stroke="#888888"
                                    fontSize={12}
                                    tickMargin={8}
                                    tickLine={false}
                                    axisLine={false}
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                />
                                <YAxis
                                    stroke="#888888"
                                    fontSize={12}
                                    tickMargin={8}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `${value.toFixed(1)}%`}
                                />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--card-foreground))' }}
                                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                                    formatter={(value: number) => `${value.toFixed(2)}%`}
                                />
                                <Legend />
                                {portfolioContributions.map((pc) => (
                                    <Bar
                                        key={pc.name}
                                        dataKey={pc.name}
                                        stackId="a"
                                        fill={pc.color}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
