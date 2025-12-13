"use client";

import { useMemo } from "react";
import {
    LabelList,
    Pie,
    PieChart,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { getAssetCategory } from "@/lib/finance";

const CATEGORY_COLORS: Record<string, string> = {
    stocks: "#2563eb",
    bonds: "#16a34a",
    cash: "#64748b",
    gold: "#d97706",
    other: "#9333ea",
};

function titleCase(v: string) {
    return (v || "").charAt(0).toUpperCase() + (v || "").slice(1);
}

export function CategoryAllocationPie({ weights }: { weights: Record<string, number> }) {
    const chartConfig = useMemo(() => ({
        value: {
            label: "Allocation",
        },
        stocks: {
            label: "Stocks",
            color: CATEGORY_COLORS.stocks,
        },
        bonds: {
            label: "Bonds",
            color: CATEGORY_COLORS.bonds,
        },
        cash: {
            label: "Cash",
            color: CATEGORY_COLORS.cash,
        },
        gold: {
            label: "Gold",
            color: CATEGORY_COLORS.gold,
        },
        other: {
            label: "Other",
            color: CATEGORY_COLORS.other,
        },
    }) satisfies ChartConfig, []);

    const data = useMemo(() => {
        const entries = Object.entries(weights || {}).filter(([, w]) => (w ?? 0) > 0);
        const total = entries.reduce((sum, [, w]) => sum + (w ?? 0), 0);
        if (total <= 0) return [];

        const byCategory: Record<string, number> = {};
        for (const [asset, w] of entries) {
            const category = getAssetCategory(asset) || "other";
            byCategory[category] = (byCategory[category] || 0) + (w ?? 0);
        }

        return Object.entries(byCategory)
            .map(([category, w]) => ({
                category,
                value: (w / total) * 100,
                fill: `var(--color-${category})`,
            }))
            .sort((a, b) => b.value - a.value);
    }, [weights]);

    return (
        <Card className="flex flex-col h-full">
            <CardHeader>
                <CardTitle>Category Breakdown</CardTitle>
                <CardDescription>Percent of portfolio by asset class.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center">
                {data.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No allocation yet.</div>
                ) : (
                    <ChartContainer
                        config={chartConfig}
                        className="mx-auto aspect-square max-h-[340px] [&_.recharts-text]:fill-background"
                    >
                        <PieChart>
                            <ChartTooltip
                                content={(
                                    <ChartTooltipContent
                                        hideLabel
                                        nameKey="category"
                                        config={chartConfig}
                                    />
                                )}
                            />
                            <Pie data={data} dataKey="value" nameKey="category" stroke="none">
                                <LabelList
                                    dataKey="value"
                                    className="fill-background"
                                    stroke="none"
                                    fontSize={12}
                                    formatter={(value: any) => {
                                        // Find the corresponding data entry to get the category
                                        const entry = data.find(d => d.value === value);
                                        if (!entry) return `${Math.round(Number(value))}%`;
                                        
                                        const category = entry.category;
                                        const label = (chartConfig as any)[category]?.label ?? titleCase(category);
                                        return `${label} (${Math.round(Number(value))}%)`;
                                    }}
                                />
                            </Pie>
                        </PieChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    );
}
