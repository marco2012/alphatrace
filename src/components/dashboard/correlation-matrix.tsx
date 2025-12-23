"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NormalizedData, pctChangeSeries } from "@/lib/finance";

import { Tooltip as UITooltip, TooltipContent as UITooltipContent, TooltipTrigger as UITooltipTrigger } from "@/components/ui/tooltip";

interface Portfolio {
    id: string;
    name: string;
    assets: string[];
}

interface CorrelationMatrixProps {
    norm: NormalizedData | null;
    portfolios: Portfolio[];
    startDate: string;
    endDate: string;
}

function mean(xs: number[]) {
    if (!xs.length) return 0;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdDev(xs: number[], m: number) {
    if (xs.length <= 1) return 0;
    const v = xs.reduce((s, x) => s + Math.pow(x - m, 2), 0) / (xs.length - 1);
    return Math.sqrt(Math.max(v, 0));
}

function covariance(a: number[], b: number[], ma: number, mb: number) {
    const n = Math.min(a.length, b.length);
    if (n <= 1) return 0;
    let s = 0;
    for (let i = 0; i < n; i++) s += (a[i] - ma) * (b[i] - mb);
    return s / (n - 1);
}

export function CorrelationMatrix({ norm, portfolios, startDate, endDate }: CorrelationMatrixProps) {
    const [selectedPortfolioId, setSelectedPortfolioId] = useState(portfolios[0]?.id || "");

    // Update selection if portfolios change (e.g. switching between different comparison sets)
    useMemo(() => {
        if (portfolios.length > 0 && !portfolios.find(p => p.id === selectedPortfolioId)) {
            setSelectedPortfolioId(portfolios[0].id);
        }
    }, [portfolios, selectedPortfolioId]);

    const matrixData = useMemo(() => {
        const selectedPortfolio = portfolios.find(p => p.id === selectedPortfolioId) || portfolios[0];
        if (!norm || !selectedPortfolio || !selectedPortfolio.assets.length) return null;

        const activeAssets = selectedPortfolio.assets.filter((k) => norm.series[k] != null);

        if (activeAssets.length < 2) return null;

        const dates = norm.dates;
        const lastDate = endDate || dates[dates.length - 1];
        const i0 = dates.findIndex((d) => d >= startDate);
        const i1 = dates.findIndex((d) => d >= lastDate);
        const endIdx = i1 === -1 ? dates.length - 1 : i1;

        // Need at least two points to calculate returns
        if (i0 === -1 || i0 >= endIdx) return null;

        const assetReturns = activeAssets.map((a) => {
            const sliced = (norm.series[a] as number[]).slice(i0, endIdx + 1);
            return pctChangeSeries(sliced);
        });

        const assetMeans = assetReturns.map((r) => mean(r));
        const assetStdDevs = assetReturns.map((r, i) => stdDev(r, assetMeans[i]));

        const matrix: number[][] = [];
        for (let i = 0; i < activeAssets.length; i++) {
            matrix[i] = [];
            for (let j = 0; j < activeAssets.length; j++) {
                if (i === j) {
                    matrix[i][j] = 1;
                } else if (j < i) {
                    matrix[i][j] = matrix[j][i];
                } else {
                    const cov = covariance(assetReturns[i], assetReturns[j], assetMeans[i], assetMeans[j]);
                    const den = assetStdDevs[i] * assetStdDevs[j];
                    matrix[i][j] = den === 0 ? 0 : cov / den;
                }
            }
        }

        return {
            assets: activeAssets,
            matrix,
        };
    }, [norm, portfolios, selectedPortfolioId, startDate, endDate]);

    if (!matrixData) return null;

    const getBackgroundColor = (value: number) => {
        // value ranges from -1 to 1; use magnitude for color intensity
        const magnitude = Math.abs(value);
        // hue: 0 = red (high correlation), 120 = green (low correlation)
        const hue = (1 - magnitude) * 120; // 0 -> red, 120 -> green
        // opacity reflects strength (more opaque for higher magnitude)
        const opacity = 0.3 + magnitude * 0.7; // 0.3 to 1.0
        return `hsla(${hue}, 70%, 50%, ${opacity})`;
    };

    const isDarkMode = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

    const getTextColor = (value: number) => {
        // In dark mode, always use white for better contrast
        if (isDarkMode) return "white";
        // In light mode, decide based on opacity
        return Math.abs(value) > 0.5 ? "white" : "black";
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Asset Correlation Matrix</CardTitle>
                    <CardDescription>
                        Correlation of monthly returns for assets in the selected portfolio.
                    </CardDescription>
                </div>
                {portfolios.length > 1 && (
                    <Select value={selectedPortfolioId} onValueChange={setSelectedPortfolioId}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {portfolios.map((portfolio) => (
                                <SelectItem key={portfolio.id} value={portfolio.id}>
                                    {portfolio.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </CardHeader>
            <CardContent className="overflow-x-auto pb-6">
                <div className="rounded-md border border-border/50 overflow-hidden">
                    <Table className="border-collapse">
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-b border-border/50">
                                <TableHead className="w-[150px] bg-muted/30 font-semibold border-r border-border/50">Asset</TableHead>
                                {matrixData.assets.map((asset) => (
                                    <TableHead key={asset} className="text-center text-xs font-semibold px-2 border-r border-border/50 last:border-r-0">
                                        {asset}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {matrixData.assets.map((asset, i) => (
                                <TableRow key={asset} className="hover:bg-transparent border-b border-border/50 last:border-b-0">
                                    <TableCell className="font-medium text-xs bg-muted/30 border-r border-border/50">{asset}</TableCell>
                                    {matrixData.matrix[i].map((value, j) => (
                                        <TableCell
                                            key={`${i}-${j}`}
                                            className="text-center text-xs p-0 transition-colors h-12 w-12 min-w-[60px] border-r border-border/50 last:border-r-0"
                                            style={{
                                                backgroundColor: getBackgroundColor(value),
                                                color: getTextColor(value),
                                            }}
                                        >
                                            <UITooltip delayDuration={0}>
                                                <UITooltipTrigger asChild>
                                                    <div className="w-full h-full flex items-center justify-center cursor-help font-medium">
                                                        {value.toFixed(2)}
                                                    </div>
                                                </UITooltipTrigger>
                                                <UITooltipContent>
                                                    <p className="text-xs">
                                                        {matrixData.assets[i]} vs {matrixData.assets[j]}: <strong>{value.toFixed(4)}</strong>
                                                    </p>
                                                </UITooltipContent>
                                            </UITooltip>
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
