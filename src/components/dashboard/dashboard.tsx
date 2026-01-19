"use client";

import { Loader2 } from "lucide-react";
import { usePortfolio } from "@/context/portfolio-context";
import { AssetAllocation } from "./asset-allocation";
import { PortfolioChart } from "./portfolio-chart";
import { MetricsCards } from "./metrics-cards";
import { DrawdownChart } from "./drawdown-chart";
import { AnnualReturnsChart } from "./annual-returns-chart";
import { DataAvailabilityWarning } from "./data-availability-warning";
import { getBackfilledAssets } from "@/lib/finance";
import { useMemo } from "react";

export function Dashboard() {
    const {
        weights,
        handleWeightChange,
        columns,
        portfolio,
        isLoading,
        savedPortfolios,
        startDate,
        firstValidDates
    } = usePortfolio();

    const backfilledAssets = useMemo(() => {
        return getBackfilledAssets(weights, startDate, firstValidDates);
    }, [weights, startDate, firstValidDates]);

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-12 md:h-[calc(100vh-100px)] h-auto">
            {/* Left Column: Asset Allocation */}
            <div className="col-span-1 md:col-span-4 lg:col-span-3 flex flex-col gap-4 md:h-full">
                <AssetAllocation
                    weights={weights}
                    onWeightChange={handleWeightChange}
                    assets={columns}
                />
            </div>

            {/* Right Column: Charts & Metrics */}
            <div className="col-span-1 md:col-span-8 lg:col-span-9 space-y-6 pb-6 md:overflow-y-auto overflow-visible md:pr-2 md:pb-10">
                <div className="grid gap-4 grid-cols-1 md:grid-cols-1">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
                    </div>
                </div>

                <DataAvailabilityWarning backfilledAssets={backfilledAssets} />

                <MetricsCards portfolio={portfolio} />

                <PortfolioChart portfolio={portfolio} />

                <div className="grid gap-6 grid-cols-1 md:grid-cols-4">
                    <AnnualReturnsChart portfolio={portfolio} />
                    <DrawdownChart
                        portfolios={portfolio
                            ? [{
                                name: "Current Portfolio",
                                portfolio: portfolio,
                                color: "#2563eb"
                            }]
                            : []
                        }
                    />
                </div>
            </div>
        </div>
    );
}
