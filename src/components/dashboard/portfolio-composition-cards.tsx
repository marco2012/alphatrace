"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAssetCategory } from "@/lib/finance";

type PortfolioCompositionItem = {
    id: string;
    name: string;
    color: string;
    weights: Record<string, number>;
};

interface PortfolioCompositionCardsProps {
    items: PortfolioCompositionItem[];
}

export function PortfolioCompositionCards({ items }: PortfolioCompositionCardsProps) {
    const portfolioItems = useMemo(() => {
        return items.filter(item => item.weights && Object.keys(item.weights).length > 0);
    }, [items]);

    if (portfolioItems.length === 0) {
        return null;
    }

    const getCategoryColor = (category: string) => {
        switch (category) {
            case "stocks": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
            case "bonds": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
            case "gold": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
            case "cash": return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
            default: return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Portfolio Compositions</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {portfolioItems.map((item) => {
                        const activeWeights = Object.entries(item.weights)
                            .filter(([_, weight]) => weight > 0)
                            .sort(([_, a], [__, b]) => b - a);

                        const totalWeight = activeWeights.reduce((sum, [_, weight]) => sum + weight, 0);

                        const assetsByCategory = activeWeights.reduce((acc, [asset, weight]) => {
                            const category = getAssetCategory(asset);
                            if (!acc[category]) acc[category] = [];
                            acc[category].push({ asset, weight });
                            return acc;
                        }, {} as Record<string, Array<{ asset: string; weight: number }>>);

                        const categoryOrder = ["stocks", "bonds", "gold", "cash", "other"];
                        const sortedCategories = Object.keys(assetsByCategory).sort((a, b) => {
                            const aIdx = categoryOrder.indexOf(a);
                            const bIdx = categoryOrder.indexOf(b);
                            return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
                        });

                        return (
                            <Card key={item.id} className="border-2" style={{ borderColor: item.color }}>
                                <CardHeader className="pb-3">
                                    <div className="flex items-center gap-2">
                                        <span 
                                            className="w-3 h-3 rounded-full flex-shrink-0" 
                                            style={{ backgroundColor: item.color }}
                                        />
                                        <CardTitle className="text-base">{item.name}</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {activeWeights.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No assets allocated</p>
                                    ) : (
                                        <>
                                            {sortedCategories.map((category) => {
                                                const categoryAssets = assetsByCategory[category];
                                                const categoryTotal = categoryAssets.reduce((sum, { weight }) => sum + weight, 0);
                                                
                                                return (
                                                    <div key={category} className="space-y-1.5">
                                                        <div className="flex items-center justify-between">
                                                            <Badge 
                                                                variant="secondary" 
                                                                className={`text-xs font-medium ${getCategoryColor(category)}`}
                                                            >
                                                                {category.charAt(0).toUpperCase() + category.slice(1)}
                                                            </Badge>
                                                            <span className="text-xs font-semibold">
                                                                {((categoryTotal / totalWeight) * 100).toFixed(1)}%
                                                            </span>
                                                        </div>
                                                        <div className="space-y-1 pl-2">
                                                            {categoryAssets.map(({ asset, weight }) => (
                                                                <div 
                                                                    key={asset} 
                                                                    className="flex items-center justify-between text-xs"
                                                                >
                                                                    <span className="text-muted-foreground truncate flex-1 pr-2">
                                                                        {asset}
                                                                    </span>
                                                                    <span className="font-medium tabular-nums">
                                                                        {((weight / totalWeight) * 100).toFixed(1)}%
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {totalWeight !== 1 && Math.abs(totalWeight - 1) > 0.001 && (
                                                <div className="pt-2 border-t">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="font-medium">Total</span>
                                                        <span className="font-semibold">
                                                            {(totalWeight * 100).toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
