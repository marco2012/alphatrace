"use client";

import { useMemo, useState, useEffect } from "react";
import { usePortfolio, type SavedPortfolio } from "@/context/portfolio-context";

import { PortfolioControls } from "@/components/dashboard/portfolio-controls";
import { MetricsCards } from "@/components/dashboard/metrics-cards";
import { PortfolioChart } from "@/components/dashboard/portfolio-chart";
import { RollingReturnsChart } from "@/components/dashboard/rolling-returns-chart";
import { AnnualReturnsChart } from "@/components/dashboard/annual-returns-chart";
import { DrawdownChart } from "@/components/dashboard/drawdown-chart";
import { TimeToRecoveryChart } from "@/components/dashboard/recovery-chart";
import { EfficientFrontierChart } from "@/components/dashboard/efficient-frontier-chart";
import { MonteCarloChart } from "@/components/dashboard/monte-carlo-chart";
import { CorrelationMatrix } from "@/components/dashboard/correlation-matrix";
import { RiskReturnScatterChart } from "@/components/dashboard/risk-return-scatter-chart";
import { InflationImpactChart } from "@/components/dashboard/inflation-impact-chart";
import { PortfolioCompositionCards } from "@/components/dashboard/portfolio-composition-cards";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip as UITooltip, TooltipContent as UITooltipContent, TooltipTrigger as UITooltipTrigger } from "@/components/ui/tooltip";

import {
    annualVol,
    averageRolling10YearCAGR,
    averageRolling10YearVol,
    averageRolling5YearCAGR,
    cagr,
    cagrRecurring,
    computeAnnualReturns,
    downsideDeviation,
    formatMonthsAsYearsAndMonths,
    PortfolioResult,
    sharpe,
    sortino,
    timeToRecoverFromIndex,
    slicePortfolioResult,
    ulcerIndex,
    calmar,
    computeBeta,
    computeRollingBeta,
    calculatePortfolioCAPE
} from "@/lib/finance";

import {
    Bar,
    BarChart,
    Line,
    LineChart,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine
} from "recharts";

import { ChevronDown, ChevronUp, Loader2, Plus, X, Download, Minus, Info, Share2, Check, Copy, Highlighter, Search, Split } from "lucide-react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const METRIC_EXPLANATIONS = {
    cagrValue: "Compound Annual Growth Rate. The geometric progression ratio that provides a constant rate of return over the time period.",
    volValue: "Annualized Volatility. A statistical measure of the dispersion of returns, representing the risk/variability of the investment.",
    sharpeValue: "Sharpe Ratio. Measures the performance of an investment compared to a risk-free asset, after adjusting for its risk.",
    sortinoValue: "Sortino Ratio. A variation of the Sharpe ratio that only considers downside volatility (negative returns).",
    maxDDValue: "Maximum Drawdown. The maximum observed loss from a peak to a trough of a portfolio, before a new peak is attained.",
    calmarValue: "Calmar Ratio. Measures the risk-adjusted return relative to the maximum drawdown.",
    ulcerIndexValue: "Ulcer Index. Measures the depth and duration of drawdowns from earlier highs.",
    recoveryMonthsValue: "Longest Recovery. The longest time it took for the portfolio to recover from a drawdown to its previous peak.",
    betaValue: "Beta. A measure of the volatility, or systematic risk, of a portfolio in comparison to the selected benchmark.",
    avgRolling10YearCAGRValue: "Average 10Y Rolling CAGR. The average of all possible 10-year rolling Compound Annual Growth Rates.",
    sharpe10YValue: "Sharpe (10Y). Sharpe Ratio calculated using the Average 10-Year Rolling CAGR.",
    sortino10YValue: "Sortino (10Y). Sortino Ratio calculated using the Average 10-Year Rolling CAGR.",
    avgRolling5YearCAGRValue: "Average 5Y Rolling CAGR. The average of all possible 5-year rolling Compound Annual Growth Rates.",
    vol10YValue: "Volatility (10Y). The average annualized volatility over rolling 10-year periods.",
    finalValue: "Final Portfolio Value. The total value of the portfolio at the end of the selected period.",
    capeValue: "Portfolio CAPE. The weighted average Cyclically Adjusted Price-to-Earnings ratio of the equity portion of the portfolio."
};

function downloadCSV(data: any[], filename: string) {
    if (!data || data.length === 0) return;
    const cols = Object.keys(data[0]);
    const csv = [
        cols.join(","),
        ...data.map(row =>
            cols.map(col => {
                const val = row[col];
                if (val === null || val === undefined) return "";
                if (typeof val === "number") return val.toString();
                const str = String(val);
                return str.includes(",") || str.includes('"') || str.includes("\n")
                    ? `"${str.replace(/"/g, '""')}"`
                    : str;
            }).join(",")
        )
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

type AnalysisItem = {
    id: string;
    type: "portfolio" | "asset";
    name: string;
    color: string;
    result: PortfolioResult | null;
    weights?: Record<string, number>;
};

type AnalysisItemKey = `${AnalysisItem["type"]}:${string}`;

const COLORS = [
    "#2563eb", // blue-600
    "#dc2626", // red-600
    "#16a34a", // green-600
    "#d97706", // amber-600
    "#9333ea", // purple-600
    "#0891b2", // cyan-600
    "#db2777", // pink-600
    "#4f46e5", // indigo-600
    "#059669", // emerald-600
    "#ea580c", // orange-600
    "#7c3aed", // violet-600
    "#e11d48", // rose-600
];

const getNextColor = (items: AnalysisItem[], offset = 0) => {
    const usedColors = new Set(items.map(i => i.color));
    const available = COLORS.filter(c => !usedColors.has(c));
    if (available.length > offset) return available[offset];
    return COLORS[(items.length + offset) % COLORS.length];
};

export function AnalysisSection() {
    const {
        portfolio,
        isLoading,
        weights,
        savedPortfolios,
        columns: assets,
        computeCustomPortfolio,
        computeAssetPortfolio,
        riskFreeRate,
        norm,
        investmentMode,
        initialInvestment,
        monthlyInvestment,
        rebalance,
        endDate,
        startDate,
        setStartDate,
        setEndDate,
        setInitialInvestment,
        setMonthlyInvestment,
        setInvestmentMode,
        setRebalance,
        currency,
        cpiMap
    } = usePortfolio();

    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const [justCopied, setJustCopied] = useState(false);

    const [selectedItems, setSelectedItems] = useState<AnalysisItem[]>([{
        id: "current",
        type: "portfolio",
        name: "Current Portfolio",
        color: COLORS[0],
        result: null
    }]);

    const [typeToAdd, setTypeToAdd] = useState<"portfolio" | "asset">("portfolio");
    const [selectedForAdd, setSelectedForAdd] = useState<string[]>([]);
    const [rollingYears, setRollingYears] = useState(10);
    const [rollingBetaYears, setRollingBetaYears] = useState(3);
    const [betaBenchmark, setBetaBenchmark] = useState<string | null>(null);
    const [simSelectedKey, setSimSelectedKey] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [decomposePortfolios, setDecomposePortfolios] = useState(false);
    const [showRollingMetrics, setShowRollingMetrics] = useState(true);

    const makeKey = (item: Pick<AnalysisItem, "type" | "id">): AnalysisItemKey => `${item.type}:${item.id}`;

    const formatDate = (d: string) => {
        if (!d || d === "0000-00-00" || d === "9999-12-31") return "";
        const [y, m] = d.split("-");
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${months[parseInt(m, 10) - 1]} ${y}`;
    };

    const handleToggleHighlightedPortfolios = () => {
        const highlighted = savedPortfolios.filter(p => p.highlighted);
        if (highlighted.length === 0) return;

        const highlightedIds = new Set(highlighted.map(p => p.id));
        const allHighlightedSelected = highlighted.every(p => selectedItems.some(i => i.type === "portfolio" && i.id === p.id));

        if (allHighlightedSelected) {
            setSelectedItems(prev => {
                const filtered = prev.filter(i => !(i.type === "portfolio" && highlightedIds.has(i.id)));
                // Restore Current Portfolio if list becomes empty
                if (filtered.length === 0) {
                    return [{
                        id: "current",
                        type: "portfolio",
                        name: "Current Portfolio",
                        color: COLORS[0],
                        result: null
                    }];
                }
                return filtered;
            });
            setSelectedForAdd(prev => prev.filter(id => !highlightedIds.has(id)));
            return;
        }

        // Check if we should remove 'current' before adding
        let baseItems = [...selectedItems];
        if (baseItems.length === 1 && baseItems[0].id === "current") {
            baseItems = [];
        }

        const itemsToAdd = highlighted
            .filter(p => !baseItems.some(i => i.type === "portfolio" && i.id === p.id))
            .map(p => {
                const color = getNextColor(baseItems);
                const newItem: AnalysisItem = {
                    id: p.id,
                    type: "portfolio" as const,
                    name: p.name,
                    color,
                    result: null
                };
                baseItems.push(newItem);
                return newItem;
            });

        if (itemsToAdd.length > 0) {
            setSelectedItems(baseItems);
        }

        setSelectedForAdd(prev => prev.filter(id => !highlightedIds.has(id)));
    };

    const getItemRange = useMemo(() => (item: AnalysisItem | SavedPortfolio | { type: "asset", id: string }) => {
        if (!norm) return null;
        const firstValidDates = (norm as any).firstValidDates || {};
        const lastValidDates = (norm as any).lastValidDates || {};

        let itemStart = "0000-00-00";
        let itemEnd = "9999-12-31";
        let found = false;

        if ('type' in item && item.type === "asset") {
            itemStart = firstValidDates[item.id] || "1994-11-01";
            itemEnd = lastValidDates[item.id] || "9999-12-31";
            found = true;
        } else {
            // For portfolios
            let itemWeights: Record<string, number> = {};
            if ('weights' in item) {
                itemWeights = (item as SavedPortfolio).weights;
            } else if ('type' in item && item.type === "portfolio") {
                if (item.id === "current") {
                    itemWeights = weights;
                } else {
                    const p = savedPortfolios.find(sp => sp.id === item.id);
                    if (p) itemWeights = p.weights;
                }
            }

            if (itemWeights && Object.keys(itemWeights).length > 0) {
                let pMaxStart = "0000-00-00";
                let pMinEnd = "9999-12-31";

                Object.keys(itemWeights).forEach(asset => {
                    if (itemWeights[asset] > 0) {
                        const s = firstValidDates[asset];
                        const e = lastValidDates[asset];
                        if (s && s > pMaxStart) pMaxStart = s;
                        if (e && e < pMinEnd) pMinEnd = e;
                        found = true;
                    }
                });

                if (found) {
                    itemStart = pMaxStart;
                    itemEnd = pMinEnd;
                }
            }
        }

        if (!found) return null;
        return { start: itemStart, end: itemEnd };
    }, [norm, weights, savedPortfolios]);

    // Handle Share URL on mount
    useEffect(() => {
        const shareParam = searchParams.get("share");
        if (shareParam) {
            try {
                const decoded = JSON.parse(atob(shareParam));
                const { items, settings, config } = decoded;

                if (items && Array.isArray(items)) {
                    // Reconstruct items
                    // Note: We don't check savedPortfolios here because we want to faithfully reproduce the shared view
                    // even if the user doesn't have those portfolios saved.
                    const restoredItems = items.map((item: any) => ({
                        ...item,
                        result: null
                    }));
                    setSelectedItems(restoredItems);
                }

                if (settings) {
                    if (settings.startDate) setStartDate(settings.startDate);
                    if (settings.endDate) setEndDate(settings.endDate);
                    if (settings.initialInvestment) setInitialInvestment(settings.initialInvestment);
                    if (settings.monthlyInvestment) setMonthlyInvestment(settings.monthlyInvestment);
                    if (settings.investmentMode) setInvestmentMode(settings.investmentMode as any);
                    if (settings.rebalance) setRebalance(settings.rebalance as any);
                }

                if (config) {
                    if (config.rollingYears) setRollingYears(config.rollingYears);
                    if (config.rollingBetaYears) setRollingBetaYears(config.rollingBetaYears);
                    if (config.betaBenchmark) setBetaBenchmark(config.betaBenchmark);
                    if (config.decomposePortfolios) setDecomposePortfolios(config.decomposePortfolios);
                }

                // Clear the param
                router.replace(pathname);
            } catch (e) {
                console.error("Failed to parse share URL", e);
            }
        }
    }, [searchParams, pathname, router, setStartDate, setEndDate, setInitialInvestment, setMonthlyInvestment, setInvestmentMode, setRebalance]);

    const handleShare = () => {
        const payload = {
            items: selectedItems.map(item => {
                const minimalItem: any = {
                    id: item.id,
                    type: item.type,
                    name: item.name,
                    color: item.color
                };

                // If it's a portfolio, we must include weights so it can be reconstructed
                // If it's "current", we grab current weights.
                // If it's saved, we grab saved weights.
                // If it already has weights (was shared), keep them.
                if (item.type === "portfolio") {
                    if (item.weights) {
                        minimalItem.weights = item.weights;
                    } else if (item.id === "current") {
                        minimalItem.weights = weights;
                    } else {
                        const p = savedPortfolios.find(sp => sp.id === item.id);
                        if (p) minimalItem.weights = p.weights;
                    }
                }

                return minimalItem;
            }),
            settings: {
                startDate,
                endDate,
                initialInvestment,
                monthlyInvestment,
                investmentMode,
                rebalance
            },
            config: {
                rollingYears,
                rollingBetaYears,
                betaBenchmark,
                decomposePortfolios
            }
        };

        try {
            const encoded = btoa(JSON.stringify(payload));
            const url = `${window.location.origin}${window.location.pathname}?share=${encoded}`;
            navigator.clipboard.writeText(url);
            setJustCopied(true);
            setTimeout(() => setJustCopied(false), 2000);
        } catch (e) {
            console.error("Failed to generate share URL", e);
        }
    };

    const filteredPortfolios = useMemo(() => {
        return savedPortfolios.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [savedPortfolios, searchTerm]);

    const filteredAssets = useMemo(() => {
        return assets.filter(a => a.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [assets, searchTerm]);

    // Default benchmark to MSCI World if nothing is selected
    useEffect(() => {
        if (!betaBenchmark && assets.length > 0) {
            const msciWorld = assets.find(a => a.toLowerCase() === "msci world" || a.toLowerCase().includes("msci world"));
            if (msciWorld) {
                setBetaBenchmark(`asset:${msciWorld}`);
            }
        }
    }, [assets, betaBenchmark]);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>({
        key: "avgRolling10YearCAGRValue",
        direction: "desc"
    });

    const itemsWithResults = useMemo(() => {
        const convertWeights = (w: Record<string, number>) => {
            const newW: Record<string, number> = {};
            const targetSuffix = `(${currency})`;
            const otherSuffix = currency === "EUR" ? "(USD)" : "(EUR)";

            Object.entries(w).forEach(([asset, weight]) => {
                if (weight === 0) return;

                if (asset.endsWith(targetSuffix)) {
                    newW[asset] = weight;
                    return;
                }

                if (asset.endsWith(otherSuffix)) {
                    const base = asset.substring(0, asset.length - otherSuffix.length).trim();
                    const match = assets.find(a => a.startsWith(base) && a.endsWith(targetSuffix));
                    if (match) {
                        newW[match] = weight;
                        return;
                    }
                }

                newW[asset] = weight;
            });
            return newW;
        };

        const convertAssetId = (id: string) => {
            const targetSuffix = `(${currency})`;
            const otherSuffix = currency === "EUR" ? "(USD)" : "(EUR)";
            if (id.endsWith(targetSuffix)) return id;
            if (id.endsWith(otherSuffix)) {
                const base = id.substring(0, id.length - otherSuffix.length).trim();
                const match = assets.find(a => a.startsWith(base) && a.endsWith(targetSuffix));
                if (match) return match;
            }
            return id;
        };

        return selectedItems.map(item => {
            let result: PortfolioResult | null = null;
            let effectiveWeights: Record<string, number> | undefined;
            let effectiveId = item.id;

            if (item.type === "portfolio") {
                if (item.weights) {
                    effectiveWeights = convertWeights(item.weights);
                    result = computeCustomPortfolio(effectiveWeights);
                } else if (item.id === "current") {
                    result = portfolio;
                    effectiveWeights = weights; // current weights are already converted in context
                } else {
                    const p = savedPortfolios.find(sp => sp.id === item.id);
                    if (p) {
                        effectiveWeights = convertWeights(p.weights);
                        result = computeCustomPortfolio(effectiveWeights);
                    }
                }
            } else if (item.type === "asset") {
                effectiveId = convertAssetId(item.id);
                result = computeAssetPortfolio(effectiveId);
            }
            return { ...item, result, effectiveWeights, effectiveId };
        });
    }, [
        selectedItems,
        savedPortfolios,
        portfolio,
        computeCustomPortfolio,
        computeAssetPortfolio,
        norm,
        investmentMode,
        initialInvestment,
        monthlyInvestment,
        rebalance,
        endDate,
        startDate,
        currency,
        assets,
        weights
    ]);

    const decomposedItems = useMemo(() => {
        if (!decomposePortfolios) return itemsWithResults;

        const flattenedItems: AnalysisItem[] = [];
        const seenAssets = new Set<string>();

        // Helper to get consistent color for an asset
        const getAssetColor = (assetName: string) => {
            // Simple hash for consistent color
            let hash = 0;
            for (let i = 0; i < assetName.length; i++) {
                hash = assetName.charCodeAt(i) + ((hash << 5) - hash);
            }
            const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
            return "#" + "00000".substring(0, 6 - c.length) + c;
        };

        // itemsWithResults now contains effectiveWeights and effectiveId which are currency-converted
        itemsWithResults.forEach(item => {
            if (item.type === "portfolio") {
                const itemWeights = (item as any).effectiveWeights as Record<string, number> | undefined;

                if (itemWeights) {
                    Object.entries(itemWeights).forEach(([asset, weight]) => {
                        if (weight > 0 && !seenAssets.has(asset)) {
                            seenAssets.add(asset);
                            // Compute asset portfolio result
                            const result = computeAssetPortfolio(asset);

                            const existingAssetItem = itemsWithResults.find(i => i.type === "asset" && (i as any).effectiveId === asset);
                            const color = existingAssetItem ? existingAssetItem.color : getNextColor(flattenedItems, flattenedItems.length);

                            flattenedItems.push({
                                id: asset,
                                type: "asset",
                                name: asset,
                                color: color,
                                result
                            });
                        }
                    });
                }
            } else {
                // It's already an asset
                const assetId = (item as any).effectiveId || item.id;
                if (!seenAssets.has(assetId)) {
                    seenAssets.add(assetId);
                    // Use the result already computed in itemsWithResults which used effectiveId
                    flattenedItems.push({
                        ...item,
                        id: assetId,
                        name: assetId
                    });
                }
            }
        });

        // Re-assign colors from our main palette to ensure they look nice if count is low
        return flattenedItems.map((item, index) => ({
            ...item,
            color: COLORS[index % COLORS.length]
        }));

    }, [itemsWithResults, decomposePortfolios, computeAssetPortfolio]);

    // Listen for changes in weights to update Current Portfolio definition, or saving new portfolios
    // But specific dependencies are handled in the hooks below.

    const validItems = useMemo(() => decomposedItems.filter(item => item.result), [decomposedItems]);

    // Calculate the strictly required date range based on data availability of the selected items.
    const availableDateRange = useMemo(() => {
        if (!validItems.length || !norm) return null;

        const firstValidDates = (norm as any).firstValidDates || {};
        const lastValidDates = (norm as any).lastValidDates || {};

        let maxStartDate = "0000-00-00";
        let minEndDate = "9999-12-31";

        let foundAny = false;

        validItems.forEach(item => {
            let itemStart = "0000-00-00";
            let itemEnd = "9999-12-31";
            let isValidItem = false;

            const assetId = (item as any).effectiveId || item.id;

            if (item.type === "asset") {
                itemStart = firstValidDates[assetId] || "1994-11-01";
                itemEnd = lastValidDates[assetId] || "9999-12-31";
                isValidItem = true;
            } else if (item.type === "portfolio") {
                let itemWeights: Record<string, number> = {};
                // Use effectiveWeights if available (converted), otherwise fall back to source
                if ((item as any).effectiveWeights) {
                    itemWeights = (item as any).effectiveWeights;
                } else if (item.id === "current") {
                    itemWeights = weights;
                } else {
                    const p = savedPortfolios.find(sp => sp.id === item.id);
                    if (p) itemWeights = p.weights;
                }

                if (itemWeights && Object.keys(itemWeights).length > 0) {
                    let pMaxStart = "0000-00-00";
                    let pMinEnd = "9999-12-31";

                    Object.keys(itemWeights).forEach(asset => {
                        if (itemWeights[asset] > 0) {
                            const s = firstValidDates[asset];
                            const e = lastValidDates[asset];
                            if (s && s > pMaxStart) pMaxStart = s;
                            if (e && e < pMinEnd) pMinEnd = e;
                        }
                    });

                    if (pMaxStart !== "0000-00-00") {
                        itemStart = pMaxStart;
                        isValidItem = true;
                    }
                    if (pMinEnd !== "9999-12-31") itemEnd = pMinEnd;
                }
            }

            if (isValidItem) {
                if (itemStart > maxStartDate) maxStartDate = itemStart;
                if (itemEnd < minEndDate) minEndDate = itemEnd;
                foundAny = true;
            }
        });

        if (!foundAny) return null;
        return { start: maxStartDate, end: minEndDate };
    }, [validItems, norm, weights, savedPortfolios]);

    // Sync global simulation dates to the required analysis range if it changes
    // This allows the charts and settings to reflect the true comparable range
    useEffect(() => {
        if (availableDateRange) {
            const { start, end } = availableDateRange;

            // Only auto-adjust if the current date is OUT of valid bounds
            // This preserves user's manual zoom/selection
            if (startDate < start) {
                setStartDate(start);
            }

            // For end date: if data ends earlier than selected end date, we must constrain it.
            // But if user selected an earlier end date, we allow it.
            if (endDate > end && end < "9999-12-31") {
                setEndDate(end);
            }
        }
    }, [availableDateRange]); // Don't add startDate/endDate to deps to allow manual override

    useEffect(() => {
        if (!betaBenchmark && validItems.length > 0) {
            setBetaBenchmark(makeKey(validItems[0]));
        }
    }, [validItems, betaBenchmark]);

    const slicedItems = useMemo(() => {
        if (!validItems.length) return validItems;

        let maxStartDate = availableDateRange?.start || "0000-00-00";
        let minEndDate = availableDateRange?.end || "9999-12-31";

        // Also constrain by global start/end (User Override / Drill down)
        // This ensures that if the Effect hasn't run yet, or if user manually constrained further, we respect it.
        // Check if user has zoomed in further than the required max start
        if (startDate > maxStartDate) maxStartDate = startDate;
        if (endDate < minEndDate) minEndDate = endDate;

        const baseValue = investmentMode === "recurring" ? monthlyInvestment : initialInvestment;

        return validItems.map(item => {
            if (!item.result) return item;
            // Only slice if necessary
            // Note: computePortfolio already slices (or should) based on startDate/endDate,
            // but slicing again ensures consistency with maxStartDate calculated from availabilty 
            const sliced = slicePortfolioResult(item.result, maxStartDate, minEndDate, baseValue);
            return {
                ...item,
                result: sliced
            };
        });

    }, [validItems, availableDateRange, startDate, endDate, investmentMode, initialInvestment, monthlyInvestment]);

    const chartData = useMemo(() => {
        if (!slicedItems.length || !slicedItems[0].result) return [];

        const base = slicedItems[0].result;
        const dates = base.dates;

        const seriesByName: Record<string, Record<string, number>> = {};
        for (const item of slicedItems) {
            const r = item.result;
            if (!r) continue;

            const values = r.portValues || r.normalizedIndex || [];
            seriesByName[item.name] = r.dates.reduce((acc, d, i) => {
                if (values[i] !== undefined) acc[d] = values[i];
                return acc;
            }, {} as Record<string, number>);
        }

        return dates.map((date) => {
            const point: any = { date };
            for (const item of slicedItems) {
                const v = seriesByName[item.name]?.[date];
                if (v !== undefined) point[item.name] = v;
            }
            return point;
        });
    }, [slicedItems]);

    const benchmarkResult = useMemo(() => {
        if (!betaBenchmark) return null;

        // Check if it's already in validItems
        const item = validItems.find(i => makeKey(i) === betaBenchmark);
        if (item?.result) return item.result;

        // If it's a single asset not in comparison, compute it
        const [type, id] = betaBenchmark.split(":");
        if (type === "asset") {
            return computeAssetPortfolio(id);
        }

        return null;
    }, [betaBenchmark, validItems, computeAssetPortfolio]);

    const metricsTableRows = useMemo(() => {
        const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;
        const fmtNum = (v: number) => v.toFixed(2);

        const benchmarkRets = benchmarkResult?.portRets;

        const rows = slicedItems
            .map((item) => {
                const r = item.result;
                if (!r) return null;

                const cagrValue = (r.portValues && r.totalInvested && r.portValues.length === r.totalInvested.length)
                    ? cagrRecurring(r.portValues, r.totalInvested)
                    : cagr(Object.keys(r.idxMap).sort().map((d) => ({ value: r.idxMap[d] })));
                const volValue = annualVol(r.portRets);
                const sharpeValue = sharpe(r.portRets, riskFreeRate);
                const avgRolling10YearCAGRValue = averageRolling10YearCAGR(r);
                const sharpe10YValue = volValue !== 0 ? (avgRolling10YearCAGRValue - riskFreeRate) / volValue : 0;

                // New metrics for rolling view
                const vol10YValue = averageRolling10YearVol(r);
                const ddValue = downsideDeviation(r.portRets, riskFreeRate);
                const sortino10YValue = ddValue !== 0 ? (avgRolling10YearCAGRValue - riskFreeRate) / ddValue : 0;

                const sortinoValue = sortino(r.portRets, riskFreeRate);

                let actualDrawdowns = r.drawdowns;
                if ((investmentMode === "recurring" || investmentMode === "hybrid") && r.portValues && r.dates.length === r.portValues.length) {
                    let maxSF = -Infinity;
                    actualDrawdowns = [];
                    for (let i = 0; i < r.dates.length; i++) {
                        const v = r.portValues[i];
                        if (v > maxSF) maxSF = v;
                        actualDrawdowns.push({ date: r.dates[i], value: maxSF > 0 ? v / maxSF - 1 : 0 });
                    }
                }

                const maxDD = actualDrawdowns.reduce((min, d) => Math.min(min, d.value), 0);
                const avgRolling5YearCAGRValue = averageRolling5YearCAGR(r);
                const calmarValue = calmar(cagrValue, maxDD);
                const ulcerIndexValue = ulcerIndex(actualDrawdowns);

                const recoveries = timeToRecoverFromIndex(r.idxMap);
                const recoveryMonthsValue = recoveries.reduce((mx, rec) => Math.max(mx, rec.months || 0), 0);
                const recoveryMonths = formatMonthsAsYearsAndMonths(recoveryMonthsValue);

                const betaValue = (benchmarkRets && r.portRets && r.portRets.length === benchmarkRets.length)
                    ? computeBeta(r.portRets, benchmarkRets)
                    : (makeKey(item) === betaBenchmark ? 1 : 0);

                let finalValue = 0;
                if (r.portValues && r.portValues.length > 0) {
                    finalValue = r.portValues[r.portValues.length - 1];
                } else if (r.normalizedIndex && r.normalizedIndex.length > 0) {
                    finalValue = r.normalizedIndex[r.normalizedIndex.length - 1];
                }

                return {
                    key: makeKey(item),
                    name: item.name,
                    cagrValue,
                    cagr: fmtPct(cagrValue),
                    volValue,
                    vol: fmtPct(volValue),
                    vol10YValue,
                    vol10Y: fmtPct(vol10YValue),
                    sharpeValue,
                    sharpe: fmtNum(sharpeValue),
                    sharpe10YValue,
                    sharpe10Y: fmtNum(sharpe10YValue),
                    sortinoValue,
                    sortino: fmtNum(sortinoValue),
                    sortino10YValue,
                    sortino10Y: fmtNum(sortino10YValue),
                    maxDDValue: maxDD,
                    maxDD: fmtPct(maxDD),
                    calmarValue,
                    calmar: fmtNum(calmarValue),
                    ulcerIndexValue,
                    ulcerIndex: fmtNum(ulcerIndexValue),
                    avgRolling10YearCAGRValue,
                    avgRolling10YearCAGR: fmtPct(avgRolling10YearCAGRValue),
                    avgRolling5YearCAGRValue,
                    avgRolling5YearCAGR: fmtPct(avgRolling5YearCAGRValue),
                    recoveryMonthsValue,
                    recoveryMonths,
                    finalValue,
                    cape: calculatePortfolioCAPE(
                        item.type === "asset"
                            ? { [(item as any).effectiveId || item.id]: 100 }
                            : ((item as any).effectiveWeights || (item.weights || (item.id === "current" ? weights : savedPortfolios.find(p => p.id === item.id)?.weights || {})))
                    )
                };
            })
            .filter(Boolean) as Array<{
                key: string;
                name: string;
                cagrValue: number;
                cagr: string;
                volValue: number;
                vol: string;
                vol10YValue: number;
                vol10Y: string;
                sharpeValue: number;
                sharpe: string;
                sharpe10YValue: number;
                sharpe10Y: string;
                sortinoValue: number;
                sortino: string;
                sortino10YValue: number;
                sortino10Y: string;
                maxDDValue: number;
                maxDD: string;
                calmarValue: number;
                calmar: string;
                ulcerIndexValue: number;
                ulcerIndex: string;
                avgRolling10YearCAGRValue: number;
                avgRolling10YearCAGR: string;
                avgRolling5YearCAGRValue: number;
                avgRolling5YearCAGR: string;
                recoveryMonthsValue: number;
                recoveryMonths: string;
                finalValue: number;
                cape: number | null;
            }>;

        const sortedRows = [...rows].sort((a, b) => {
            if (!sortConfig) return 0;
            const aValue = a[sortConfig.key as keyof typeof a];
            const bValue = b[sortConfig.key as keyof typeof b];
            if (aValue === undefined || bValue === undefined) return 0;
            if (typeof aValue === "number" && typeof bValue === "number") {
                return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
            }
            const aStr = String(aValue);
            const bStr = String(bValue);
            return sortConfig.direction === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
        });

        return sortedRows;
    }, [slicedItems, riskFreeRate, makeKey, sortConfig, betaBenchmark]);

    const rollingComparisonData = useMemo(() => {
        if (slicedItems.length < 2) return [];

        const period = rollingYears * 12;
        const seriesByName: Record<string, { dates: string[]; values: number[]; invested?: number[] }> = {};

        for (const item of slicedItems) {
            if (!item.result) continue;

            const dates = item.result.dates || Object.keys(item.result.idxMap).sort();

            // Determine if we should use totalInvested logic (Recurring/Hybrid) or Index logic (Lump Sum)
            // Recurring/Hybrid results have portValues and totalInvested arrays
            const hasInvested = item.result.portValues && item.result.totalInvested && item.result.portValues.length === item.result.dates.length;

            if (hasInvested) {
                seriesByName[item.name] = {
                    dates: item.result.dates,
                    values: item.result.portValues!,
                    invested: item.result.totalInvested!
                };
            } else {
                // Fallback to idxMap (Lump Sum / Single Asset normalized)
                seriesByName[item.name] = {
                    dates,
                    values: dates.map(d => item.result!.idxMap[d])
                };
            }
        }

        const baseItem = validItems[0];
        const baseSeries = seriesByName[baseItem.name];
        if (!baseSeries || baseSeries.values.length <= period) return [];

        // Align by index since dates should be synchronized for comparison if from same dataset/range
        // If not, this simple index mapping might be slightly off if date ranges differ, 
        // but typically in this app, they share the same 'dates' axis from the main simulation context.
        // We'll iterate through the base series indices.

        const result = [];
        for (let i = period; i < baseSeries.values.length; i++) {
            const date = baseSeries.dates[i];
            const row: Record<string, any> = { date };

            for (const item of validItems) {
                const s = seriesByName[item.name];
                if (!s || i >= s.values.length) continue;

                const startVal = s.values[i - period];
                const endVal = s.values[i];

                if (startVal && endVal) {
                    if (s.invested) {
                        const startInv = s.invested[i - period];
                        const endInv = s.invested[i];
                        const netContrib = endInv - startInv;
                        // Return on Capital approximation: (EndValue / (StartValue + NetContributions)) ^ (1/N) - 1
                        // This aligns with the 'cagrRecurring' logic used in metrics.
                        const denominator = startVal + netContrib;
                        if (denominator > 0) {
                            row[item.name] = (Math.pow(endVal / denominator, 1 / rollingYears) - 1) * 100;
                        } else {
                            row[item.name] = 0;
                        }
                    } else {
                        // Standard Rolling CAGR for Index
                        row[item.name] = (Math.pow(endVal / startVal, 1 / rollingYears) - 1) * 100;
                    }
                }
            }
            result.push(row);
        }
        return result;
    }, [validItems, rollingYears]);

    const rollingBetaData = useMemo(() => {
        if (validItems.length === 0 || !benchmarkResult) return [];

        const benchmarkRets = benchmarkResult.portRets;
        const dates = benchmarkResult.dates;
        const window = rollingBetaYears * 12;

        const series: Record<string, { date: string; value: number }[]> = {};

        validItems.forEach(item => {
            if (!item.result || makeKey(item) === betaBenchmark) return;
            series[item.name] = computeRollingBeta(
                item.result.portRets,
                benchmarkRets,
                dates,
                window
            );
        });

        const allDates = Array.from(new Set(Object.values(series).flatMap(s => s.map(pt => pt.date)))).sort();

        return allDates.map(date => {
            const point: any = { date };
            Object.keys(series).forEach(name => {
                const pt = series[name].find(p => p.date === date);
                if (pt) point[name] = pt.value;
            });
            return point;
        });
    }, [validItems, betaBenchmark, rollingBetaYears]);

    const annualComparisonData = useMemo(() => {
        if (validItems.length < 2) return [];

        const byName: Record<string, Array<{ year: string; value: number }>> = {};
        const years = new Set<string>();

        for (const item of validItems) {
            if (!item.result) continue;

            let annual: { year: string; value: number }[] = [];

            const hasInvested = item.result.portValues && item.result.totalInvested && item.result.portValues.length === item.result.dates.length;

            if (hasInvested) {
                // Determine years from dates
                const yearMap: Record<string, { start?: number; end?: number; startInv?: number; endInv?: number }> = {};

                item.result.dates.forEach((d, i) => {
                    const y = new Date(d).getFullYear().toString();
                    if (!yearMap[y]) yearMap[y] = {};

                    // We need the value at the START of the year (end of previous year usually, but here we take first point available in year)
                    // Better: Annual return is typically r_t. 
                    // Let's approximate using first/last of the year.
                    if (yearMap[y].start === undefined) {
                        yearMap[y].start = item.result!.portValues![i];
                        yearMap[y].startInv = item.result!.totalInvested![i];
                    }
                    yearMap[y].end = item.result!.portValues![i];
                    yearMap[y].endInv = item.result!.totalInvested![i];
                });

                annual = Object.entries(yearMap).map(([year, data]) => {
                    if (data.start === undefined || data.end === undefined || data.startInv === undefined || data.endInv === undefined) return null;

                    // If it's the very first partial year, data.start might be 0 or equal to first contribution.
                    // Logic: (End / (Start + NetContrib)) - 1
                    const netContrib = data.endInv - data.startInv;
                    const denominator = data.start + netContrib;
                    const val = denominator > 0 ? (data.end / denominator) - 1 : 0;
                    return { year, value: val * 100 };
                }).filter(Boolean) as { year: string; value: number }[];

            } else {
                annual = computeAnnualReturns(item.result.idxMap).map((a) => ({
                    year: String(a.year),
                    value: a.nominal * 100
                }));
            }

            byName[item.name] = annual;
            annual.forEach((a) => years.add(a.year));
        }

        const yearList = Array.from(years).sort();

        return yearList.map((year) => {
            const row: Record<string, any> = { year };
            for (const item of validItems) {
                const v = (byName[item.name] || []).find((a) => a.year === year);
                if (v) row[item.name] = v.value;
            }
            return row;
        });
    }, [validItems]);

    const drawdownComparisonData = useMemo(() => {
        if (validItems.length < 2) return [];
        if (!validItems[0]?.result) return [];

        const dates = validItems[0].result.dates || Object.keys(validItems[0].result.idxMap).sort();

        const ddMaps: Record<string, Record<string, number>> = {};
        for (const item of validItems) {
            if (!item.result) continue;

            let actualDrawdowns = item.result.drawdowns;
            if ((investmentMode === "recurring" || investmentMode === "hybrid") && item.result.portValues && item.result.dates.length === item.result.portValues.length) {
                let maxSF = -Infinity;
                actualDrawdowns = [];
                for (let i = 0; i < item.result.dates.length; i++) {
                    const v = item.result.portValues[i];
                    if (v > maxSF) maxSF = v;
                    actualDrawdowns.push({ date: item.result.dates[i], value: maxSF > 0 ? v / maxSF - 1 : 0 });
                }
            }

            ddMaps[item.name] = actualDrawdowns.reduce((acc, d) => {
                acc[d.date] = d.value * 100;
                return acc;
            }, {} as Record<string, number>);
        }

        return dates.map((date) => {
            const row: Record<string, any> = { date };
            for (const item of validItems) {
                const v = ddMaps[item.name]?.[date];
                if (v !== undefined) row[item.name] = v;
            }
            return row;
        });
    }, [validItems]);

    const rollingAveragesByName = useMemo(() => {
        const out: Record<string, number> = {};
        if (!rollingComparisonData.length) return out;

        for (const item of validItems) {
            const key = item.name;
            let sum = 0;
            let n = 0;
            for (const row of rollingComparisonData) {
                const v = row[key];
                if (typeof v === "number" && Number.isFinite(v)) {
                    sum += v;
                    n++;
                }
            }
            if (n > 0) out[key] = sum / n;
        }

        return out;
    }, [rollingComparisonData, validItems]);

    const rollingLegendLabel = useMemo(() => {
        const out: Record<string, string> = {};
        for (const item of validItems) {
            const avg = rollingAveragesByName[item.name];
            out[item.name] = avg == null
                ? item.name
                : `${item.name} (${avg.toFixed(2)}%)`;
        }
        return out;
    }, [rollingAveragesByName, validItems]);

    const handleAddItem = () => {
        if (typeToAdd === "portfolio" && selectedForAdd.length === 0) {
            const allSavedSelected = savedPortfolios.length > 0
                && savedPortfolios.every(p => selectedItems.some(item => item.type === "portfolio" && item.id === p.id));

            if (allSavedSelected) {
                const savedIds = new Set(savedPortfolios.map(p => p.id));
                const withoutSaved = selectedItems.filter(item => !(item.type === "portfolio" && savedIds.has(item.id)));
                const hasCurrent = withoutSaved.some(item => item.type === "portfolio" && item.id === "current");

                setSelectedItems(hasCurrent
                    ? withoutSaved
                    : [
                        {
                            id: "current",
                            type: "portfolio",
                            name: "Current Portfolio",
                            color: COLORS[0],
                            result: null
                        },
                        ...withoutSaved
                    ]);
                setSelectedForAdd([]);
                return;
            }

            const idsToAdd = savedPortfolios.map(p => p.id);

            // Check if we should remove 'current' before adding
            let currentSelected = selectedItems.filter(item => !(item.type === "portfolio" && item.id === "current"));
            // If currentSelected was empty (meaning only 'current' was there), it's now empty, which is what we want.
            // But wait, the original logic preserved 'baseSelected' which EXCLUDED current.
            // So if 'current' was there, it's gone.

            // The original logic was: const baseSelected = selectedItems.filter(item => !(item.type === "portfolio" && item.id === "current"));
            // This already removed "current". So if "current" was the only item, baseSelected is empty.
            // And then it adds to baseSelected.
            // So the behavior "remove current" is ALREADY mostly there for "Add All", except if we wanted to KEEP it.
            // But the user wants to REMOVE it. So existing logic for "Add All" is actually fine?
            // Let's re-read the original "Add All" logic.
            /*
            const baseSelected = selectedItems.filter(item => !(item.type === "portfolio" && item.id === "current"));
            ...
            setSelectedItems(currentSelected);
            */
            // Yes, "Add All" logic already removes "Current Portfolio" effectively because it filters it out!
            // Wait, let's double check.
            // `const baseSelected = selectedItems.filter(...)`
            // If `selectedItems` was `[{id: "current"}]`, `baseSelected` is `[]`.
            // Then we add items. `setSelectedItems` gets the new list. "current" is gone.
            // So "Add All" works as requested implicitly. I don't need to change it.

            // However, the second part of `handleAddItem` (adding specific `selectedForAdd` items) needs change.
            // Let's modify that part.

            const itemsToAdd = idsToAdd
                .map(id => {
                    const p = savedPortfolios.find(sp => sp.id === id);
                    if (!p) return null;
                    if (currentSelected.some(i => i.id === p.id && i.type === "portfolio")) return null;

                    const color = getNextColor(currentSelected);
                    const newItem: AnalysisItem = {
                        id: p.id,
                        type: "portfolio" as const,
                        name: p.name,
                        color,
                        result: null
                    };
                    currentSelected.push(newItem);
                    return newItem;
                })
                .filter(item => item !== null) as AnalysisItem[];

            if (itemsToAdd.length > 0) {
                setSelectedItems(currentSelected);
                setSelectedForAdd([]);
            }
            return;
        }

        const idsToAdd = selectedForAdd.length > 0
            ? selectedForAdd
            : (typeToAdd === "portfolio" ? filteredPortfolios.map(p => p.id) : filteredAssets);

        // Check if we should remove 'current'
        let currentItems = [...selectedItems];
        if (currentItems.length === 1 && currentItems[0].id === "current") {
            currentItems = [];
        }

        const itemsToAdd = idsToAdd
            .map(id => {
                let newItem: AnalysisItem | null = null;

                if (typeToAdd === "portfolio") {
                    const p = savedPortfolios.find(sp => sp.id === id);
                    if (p && !currentItems.find(i => i.id === p.id && i.type === "portfolio")) {
                        newItem = {
                            id: p.id,
                            type: "portfolio",
                            name: p.name,
                            color: getNextColor(currentItems),
                            result: null
                        };
                    }
                } else {
                    if (!currentItems.find(i => i.id === id && i.type === "asset")) {
                        newItem = {
                            id,
                            type: "asset",
                            name: id,
                            color: getNextColor(currentItems),
                            result: null
                        };
                    }
                }

                if (newItem) currentItems.push(newItem);
                return newItem;
            })
            .filter(item => item !== null) as AnalysisItem[];

        if (itemsToAdd.length > 0) {
            setSelectedItems(currentItems);
            setSelectedForAdd([]);
        }
    };

    const handleToggleSelection = (id: string) => {
        const isCurrentlySelected = selectedForAdd.includes(id);
        if (!isCurrentlySelected) {
            let newItem: AnalysisItem | null = null;

            // Check if we should remove 'current' before adding
            let currentItems = [...selectedItems];
            if (currentItems.length === 1 && currentItems[0].id === "current") {
                currentItems = [];
            }

            if (typeToAdd === "portfolio") {
                const p = savedPortfolios.find(sp => sp.id === id);
                if (p) {
                    newItem = {
                        id: p.id,
                        type: "portfolio",
                        name: p.name,
                        color: getNextColor(currentItems),
                        result: null
                    };
                }
            } else {
                newItem = {
                    id,
                    type: "asset",
                    name: id,
                    color: getNextColor(currentItems),
                    result: null
                };
            }

            if (newItem && !currentItems.find(i => i.id === newItem!.id && i.type === newItem!.type)) {
                setSelectedItems([...currentItems, newItem]);
            } else if (currentItems.length !== selectedItems.length) {
                // If we removed current but didn't add anything (shouldn't happen here logic-wise), restore?
                // But we ARE adding newItem.
                // If newItem was somehow duplicate (already in list), we shouldn't have cleared current?
                // But currentItems starts with selectedItems (minus current).
                // If duplicates exist, we just don't add.
                // But if we stripped current, and didn't add, we are left with empty list if current was only one.
                // Ideally we shouldn't strip current if we don't add.
                // But the check !currentItems.find... covers the remaining items.
                // If newItem is not found in remaining, we add it.
                // So if we stripped current, we definitely add newItem.
            }
        } else {
            const itemToRemove = selectedItems.find(i => i.id === id && i.type === typeToAdd);
            if (itemToRemove) {
                const index = selectedItems.indexOf(itemToRemove);
                if (index > -1) {
                    const newItems = [...selectedItems];
                    newItems.splice(index, 1);

                    // Restore Current Portfolio if list becomes empty
                    if (newItems.length === 0) {
                        newItems.push({
                            id: "current",
                            type: "portfolio",
                            name: "Current Portfolio",
                            color: COLORS[0],
                            result: null
                        });
                    }

                    setSelectedItems(newItems);
                }
            }
        }

        setSelectedForAdd(prev =>
            prev.includes(id)
                ? prev.filter(item => item !== id)
                : [...prev, id]
        );
    };

    const handleSort = (key: string) => {
        setSortConfig(current => {
            if (!current || current.key !== key) {
                return { key, direction: "asc" };
            }
            if (current.direction === "asc") {
                return { key, direction: "desc" };
            }
            return null;
        });
    };

    const handleRemoveAllAssets = () => {
        const assetItems = selectedItems.filter(item => item.type === "asset");
        const newItems = selectedItems.filter(item => item.type !== "asset");
        setSelectedItems(newItems);
        setSelectedForAdd(prev => prev.filter(id => !assetItems.some(item => item.id === id)));
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...selectedItems];
        const removed = newItems[index];
        newItems.splice(index, 1);

        // Restore Current Portfolio if list becomes empty
        if (newItems.length === 0) {
            newItems.push({
                id: "current",
                type: "portfolio",
                name: "Current Portfolio",
                color: COLORS[0],
                result: null
            });
        }

        setSelectedItems(newItems);
        if (removed) {
            setSelectedForAdd(prev => prev.filter(id => id !== removed.id));
        }
    };

    const handleClearAll = () => {
        setSelectedItems([
            {
                id: "current",
                type: "portfolio",
                name: "Current Portfolio",
                color: COLORS[0],
                result: null
            }
        ]);
        setSelectedForAdd([]);
    };

    const handleReorder = (sourceId: string, targetId: string) => {
        setSelectedItems(prev => {
            const newItems = [...prev];
            const sourceIdx = newItems.findIndex(i => i.id === sourceId && i.type === "portfolio");
            const targetIdx = newItems.findIndex(i => i.id === targetId && i.type === "portfolio");

            if (sourceIdx !== -1 && targetIdx !== -1) {
                const [removed] = newItems.splice(sourceIdx, 1);
                newItems.splice(targetIdx, 0, removed);
            }
            return newItems;
        });
    };

    if (isLoading) {
        return (
            <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const primaryItem = validItems[0];
    const primaryResult = primaryItem?.result || portfolio;
    const calcKey = `${investmentMode}|${rebalance}|${startDate}|${endDate}|${initialInvestment}|${monthlyInvestment}`;

    return (
        <div className="flex flex-col gap-6">
            <PortfolioControls />

            <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <CardTitle>Select Items to Analyze</CardTitle>
                        <CardDescription>Choose portfolios and assets to compare performance.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {selectedItems.length > 1 && (
                            <Button variant="outline" size="sm" onClick={handleClearAll} className="flex-1 sm:flex-none text-destructive hover:text-destructive">
                                Clear All
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleShare}
                            className="gap-2 flex-1 sm:flex-none"
                        >
                            {justCopied ? <Check className="h-4 w-4 text-green-500" /> : <Share2 className="h-4 w-4" />}
                            {justCopied ? "Copied Link" : "Share Analysis"}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-4">
                        <div className="space-y-4">
                            <Tabs value={typeToAdd} onValueChange={(v: any) => { setTypeToAdd(v); setSelectedForAdd([]); setSearchTerm(""); }}>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                        <TabsList className="grid w-full grid-cols-2 max-w-[300px]">
                                            <TabsTrigger value="portfolio">Portfolios</TabsTrigger>
                                            <TabsTrigger value="asset">Assets</TabsTrigger>
                                        </TabsList>
                                        {typeToAdd === "portfolio" && savedPortfolios.some(p => p.highlighted) && (
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={handleToggleHighlightedPortfolios}
                                                title={
                                                    savedPortfolios.filter(p => p.highlighted).every(p => selectedItems.some(item => item.type === "portfolio" && item.id === p.id))
                                                        ? "Remove highlighted portfolios"
                                                        : "Add highlighted portfolios"
                                                }
                                            >
                                                <Highlighter className="h-4 w-4" />
                                            </Button>
                                        )}
                                        {typeToAdd === "asset" && assets.every(a => selectedItems.some(item => item.type === "asset" && item.id === a)) && (
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={handleRemoveAllAssets}
                                                title="Remove all assets"
                                            >
                                                <Minus className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={handleAddItem}
                                            disabled={
                                                (typeToAdd === "portfolio" ? savedPortfolios.length === 0 : assets.length === 0)
                                            }
                                            title={
                                                typeToAdd === "portfolio"
                                                    ? (
                                                        filteredPortfolios.length > 0
                                                            && filteredPortfolios.every(p => selectedItems.some(item => item.type === "portfolio" && item.id === p.id))
                                                            ? "Remove all visible portfolios"
                                                            : (selectedForAdd.length === 0
                                                                ? `Add all ${filteredPortfolios.length} visible portfolio${filteredPortfolios.length !== 1 ? "s" : ""}`
                                                                : `Add ${selectedForAdd.length} item${selectedForAdd.length !== 1 ? "s" : ""}`)
                                                    )
                                                    : (
                                                        filteredAssets.every(a => selectedItems.some(item => item.type === "asset" && item.id === a))
                                                            ? "All items already selected"
                                                            : (selectedForAdd.length === 0
                                                                ? `Add all ${filteredAssets.length} visible asset${filteredAssets.length !== 1 ? "s" : ""}`
                                                                : `Add ${selectedForAdd.length} item${selectedForAdd.length !== 1 ? "s" : ""}`)
                                                    )
                                            }
                                        >
                                            {typeToAdd === "portfolio"
                                                ? (savedPortfolios.length > 0 && savedPortfolios.every(p => selectedItems.some(item => item.type === "portfolio" && item.id === p.id)))
                                                    ? <X className="h-4 w-4" />
                                                    : <Plus className="h-4 w-4" />
                                                : (assets.length > 0 && assets.every(a => selectedItems.some(item => item.type === "asset" && item.id === a)))
                                                    ? <X className="h-4 w-4" />
                                                    : <Plus className="h-4 w-4" />
                                            }
                                        </Button>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id="decompose-portfolios"
                                            checked={decomposePortfolios}
                                            onCheckedChange={setDecomposePortfolios}
                                        />
                                        <Label htmlFor="decompose-portfolios" className="flex items-center gap-2 cursor-pointer">
                                            <Split className="h-4 w-4" />
                                            Decompose Portfolios
                                        </Label>
                                    </div>
                                </div>

                                <div className="mt-4 relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder={`Search ${typeToAdd === "portfolio" ? "portfolios" : "assets"}...`}
                                        className="pl-9"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                    {searchTerm && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute right-1 top-1 h-7 w-7"
                                            onClick={() => setSearchTerm("")}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>

                                <TabsContent value="portfolio">
                                    <div className="border rounded-md p-3 max-h-[500px] overflow-y-auto mt-2">
                                        <div className="space-y-2">
                                            {filteredPortfolios.length === 0 ? (
                                                <p className="text-sm text-muted-foreground text-center py-4">No portfolios found matching "{searchTerm}"</p>
                                            ) : (
                                                filteredPortfolios.map(p => {
                                                    const range = getItemRange(p);
                                                    return (
                                                        <div
                                                            key={p.id}
                                                            className={
                                                                p.highlighted
                                                                    ? "flex items-start space-x-2 rounded-md px-2 py-1 bg-yellow-300/60 hover:bg-yellow-300/70 dark:bg-yellow-500/25 dark:hover:bg-yellow-500/35"
                                                                    : "flex items-start space-x-2 rounded-md px-2 py-1"
                                                            }
                                                        >
                                                            <Checkbox
                                                                id={p.id}
                                                                checked={selectedForAdd.includes(p.id) || selectedItems.some(item => item.type === "portfolio" && item.id === p.id)}
                                                                onCheckedChange={() => handleToggleSelection(p.id)}
                                                                className="mt-1"
                                                            />
                                                            <label
                                                                htmlFor={p.id}
                                                                className="grid gap-1.5 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                            >
                                                                <span className="text-sm font-medium inline-flex items-center gap-2">
                                                                    {p.highlighted && <Highlighter className="h-3.5 w-3.5" />}
                                                                    {p.name}
                                                                </span>
                                                                {range && (
                                                                    <span className="text-[10px] text-muted-foreground">
                                                                        {formatDate(range.start)} - {formatDate(range.end)}
                                                                    </span>
                                                                )}
                                                            </label>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="asset">
                                    <div className="border rounded-md p-3 max-h-[500px] overflow-y-auto mt-2">
                                        <div className="space-y-2">
                                            {filteredAssets.length === 0 ? (
                                                <p className="text-sm text-muted-foreground text-center py-4">No assets found matching "{searchTerm}"</p>
                                            ) : (
                                                filteredAssets.map(a => {
                                                    const range = getItemRange({ type: "asset", id: a });
                                                    return (
                                                        <div key={a} className="flex items-start space-x-2">
                                                            <Checkbox
                                                                id={a}
                                                                checked={selectedForAdd.includes(a) || selectedItems.some(item => item.type === "asset" && item.id === a)}
                                                                onCheckedChange={() => handleToggleSelection(a)}
                                                                className="mt-1"
                                                            />
                                                            <label
                                                                htmlFor={a}
                                                                className="grid gap-1.5 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                            >
                                                                <span className="text-sm font-medium">{a}</span>
                                                                {range && (
                                                                    <span className="text-[10px] text-muted-foreground">
                                                                        {formatDate(range.start)} - {formatDate(range.end)}
                                                                    </span>
                                                                )}
                                                            </label>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>

                        </div>

                        <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t">
                            {selectedItems.map((item, idx) => {
                                const range = getItemRange(item);
                                return (
                                    <Badge
                                        key={`${item.type}-${item.id}`}
                                        variant="outline"
                                        className="pl-2 pr-1 py-1.5 flex items-center gap-1"
                                        style={{ borderColor: item.color }}
                                    >
                                        <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: item.color }}></span>
                                        <div className="flex flex-col items-start leading-none gap-0.5">
                                            <span className="text-[11px] font-medium">{item.name}</span>
                                            {range && (
                                                <span className="text-[9px] opacity-70 font-normal">
                                                    {formatDate(range.start)} - {formatDate(range.end)}
                                                </span>
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-4 w-4 ml-1 hover:bg-transparent"
                                            onClick={() => handleRemoveItem(idx)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </Badge>
                                );
                            })}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-6">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl font-semibold tracking-tight">Performance Analysis</h2>
                    {validItems.length === 1 && (() => {
                        const range = getItemRange(validItems[0]);
                        return range ? (
                            <p className="text-sm text-muted-foreground">
                                Data range: {formatDate(range.start)} - {formatDate(range.end)}
                            </p>
                        ) : null;
                    })()}
                </div>

                {validItems.length > 0 && (
                    <Card key={`metrics-${calcKey}`}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                            <CardTitle>Key Metrics</CardTitle>
                            <div className="flex items-center space-x-2">
                                <Switch id="rolling-mode" checked={showRollingMetrics} onCheckedChange={setShowRollingMetrics} />
                                <Label htmlFor="rolling-mode">Rolling Metrics</Label>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead onClick={() => handleSort("name")} className="cursor-pointer hover:bg-muted/50 sticky left-0 bg-background z-20 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                <div className="flex items-center justify-between">
                                                    Strategy
                                                    {sortConfig?.key === "name" && (
                                                        sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                                                    )}
                                                </div>
                                            </TableHead>
                                            <TableHead onClick={() => handleSort("finalValue")} className="cursor-pointer hover:bg-muted/50 text-right min-w-[100px]">
                                                <UITooltip delayDuration={0}>
                                                    <UITooltipTrigger asChild>
                                                        <div className="flex items-center justify-end gap-1 w-full">
                                                            Final Value {currency === "USD" ? "($)" : "(€)"}
                                                            <Info className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                                            {sortConfig?.key === "finalValue" && (
                                                                sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                                                            )}
                                                        </div>
                                                    </UITooltipTrigger>
                                                    <UITooltipContent side="top" align="center">
                                                        <p className="w-48">{METRIC_EXPLANATIONS.finalValue}</p>
                                                    </UITooltipContent>
                                                </UITooltip>
                                            </TableHead>
                                            {!showRollingMetrics && (
                                                <TableHead onClick={() => handleSort("cagrValue")} className="cursor-pointer hover:bg-muted/50 text-right min-w-[80px]">
                                                    <UITooltip delayDuration={0}>
                                                        <UITooltipTrigger asChild>
                                                            <div className="flex items-center justify-end gap-1 w-full">
                                                                CAGR
                                                                <Info className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                                                {sortConfig?.key === "cagrValue" && (
                                                                    sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                                                                )}
                                                            </div>
                                                        </UITooltipTrigger>
                                                        <UITooltipContent side="top" align="center">
                                                            <p className="w-48">{METRIC_EXPLANATIONS.cagrValue}</p>
                                                        </UITooltipContent>
                                                    </UITooltip>
                                                </TableHead>
                                            )}
                                            {showRollingMetrics && (
                                                <>
                                                    <TableHead onClick={() => handleSort("avgRolling5YearCAGRValue")} className="cursor-pointer hover:bg-muted/50 text-right min-w-[100px]">
                                                        <UITooltip delayDuration={0}>
                                                            <UITooltipTrigger asChild>
                                                                <div className="flex items-center justify-end gap-1 w-full">
                                                                    5Y CAGR
                                                                    <Info className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                                                    {sortConfig?.key === "avgRolling5YearCAGRValue" && (
                                                                        sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                                                                    )}
                                                                </div>
                                                            </UITooltipTrigger>
                                                            <UITooltipContent side="top" align="center">
                                                                <p className="w-48">{METRIC_EXPLANATIONS.avgRolling5YearCAGRValue}</p>
                                                            </UITooltipContent>
                                                        </UITooltip>
                                                    </TableHead>
                                                    <TableHead onClick={() => handleSort("avgRolling10YearCAGRValue")} className="cursor-pointer hover:bg-muted/50 text-right min-w-[100px]">
                                                        <UITooltip delayDuration={0}>
                                                            <UITooltipTrigger asChild>
                                                                <div className="flex items-center justify-end gap-1 w-full">
                                                                    10Y CAGR
                                                                    <Info className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                                                    {sortConfig?.key === "avgRolling10YearCAGRValue" && (
                                                                        sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                                                                    )}
                                                                </div>
                                                            </UITooltipTrigger>
                                                            <UITooltipContent side="top" align="center">
                                                                <p className="w-48">{METRIC_EXPLANATIONS.avgRolling10YearCAGRValue}</p>
                                                            </UITooltipContent>
                                                        </UITooltip>
                                                    </TableHead>
                                                </>
                                            )}
                                            {!showRollingMetrics ? (
                                                <TableHead onClick={() => handleSort("volValue")} className="cursor-pointer hover:bg-muted/50 text-right min-w-[100px]">
                                                    <UITooltip delayDuration={0}>
                                                        <UITooltipTrigger asChild>
                                                            <div className="flex items-center justify-end gap-1 w-full">
                                                                Volatility
                                                                <Info className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                                                {sortConfig?.key === "volValue" && (
                                                                    sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                                                                )}
                                                            </div>
                                                        </UITooltipTrigger>
                                                        <UITooltipContent side="top" align="center">
                                                            <p className="w-48">{METRIC_EXPLANATIONS.volValue}</p>
                                                        </UITooltipContent>
                                                    </UITooltip>
                                                </TableHead>
                                            ) : (
                                                <TableHead onClick={() => handleSort("vol10YValue")} className="cursor-pointer hover:bg-muted/50 text-right min-w-[100px]">
                                                    <UITooltip delayDuration={0}>
                                                        <UITooltipTrigger asChild>
                                                            <div className="flex items-center justify-end gap-1 w-full">
                                                                Vol (10Y)
                                                                <Info className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                                                {sortConfig?.key === "vol10YValue" && (
                                                                    sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                                                                )}
                                                            </div>
                                                        </UITooltipTrigger>
                                                        <UITooltipContent side="top" align="center">
                                                            <p className="w-48">{METRIC_EXPLANATIONS.vol10YValue}</p>
                                                        </UITooltipContent>
                                                    </UITooltip>
                                                </TableHead>
                                            )}
                                            {!showRollingMetrics ? (
                                                <TableHead onClick={() => handleSort("sharpeValue")} className="cursor-pointer hover:bg-muted/50 text-right min-w-[80px]">
                                                    <UITooltip delayDuration={0}>
                                                        <UITooltipTrigger asChild>
                                                            <div className="flex items-center justify-end gap-1 w-full">
                                                                Sharpe
                                                                <Info className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                                                {sortConfig?.key === "sharpeValue" && (
                                                                    sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                                                                )}
                                                            </div>
                                                        </UITooltipTrigger>
                                                        <UITooltipContent side="top" align="center">
                                                            <p className="w-48">{METRIC_EXPLANATIONS.sharpeValue}</p>
                                                        </UITooltipContent>
                                                    </UITooltip>
                                                </TableHead>
                                            ) : (
                                                <TableHead onClick={() => handleSort("sharpe10YValue")} className="cursor-pointer hover:bg-muted/50 text-right min-w-[100px]">
                                                    <UITooltip delayDuration={0}>
                                                        <UITooltipTrigger asChild>
                                                            <div className="flex items-center justify-end gap-1 w-full">
                                                                Sharpe (10Y)
                                                                <Info className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                                                {sortConfig?.key === "sharpe10YValue" && (
                                                                    sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                                                                )}
                                                            </div>
                                                        </UITooltipTrigger>
                                                        <UITooltipContent side="top" align="center">
                                                            <p className="w-48">{METRIC_EXPLANATIONS.sharpe10YValue}</p>
                                                        </UITooltipContent>
                                                    </UITooltip>
                                                </TableHead>
                                            )}
                                            {!showRollingMetrics ? (
                                                <TableHead onClick={() => handleSort("sortinoValue")} className="cursor-pointer hover:bg-muted/50 text-right min-w-[100px]">
                                                    <UITooltip delayDuration={0}>
                                                        <UITooltipTrigger asChild>
                                                            <div className="flex items-center justify-end gap-1 w-full">
                                                                Sortino
                                                                <Info className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                                                {sortConfig?.key === "sortinoValue" && (
                                                                    sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                                                                )}
                                                            </div>
                                                        </UITooltipTrigger>
                                                        <UITooltipContent side="top" align="center">
                                                            <p className="w-48">{METRIC_EXPLANATIONS.sortinoValue}</p>
                                                        </UITooltipContent>
                                                    </UITooltip>
                                                </TableHead>
                                            ) : (
                                                <TableHead onClick={() => handleSort("sortino10YValue")} className="cursor-pointer hover:bg-muted/50 text-right min-w-[100px]">
                                                    <UITooltip delayDuration={0}>
                                                        <UITooltipTrigger asChild>
                                                            <div className="flex items-center justify-end gap-1 w-full">
                                                                Sortino (10Y)
                                                                <Info className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                                                {sortConfig?.key === "sortino10YValue" && (
                                                                    sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                                                                )}
                                                            </div>
                                                        </UITooltipTrigger>
                                                        <UITooltipContent side="top" align="center">
                                                            <p className="w-48">{METRIC_EXPLANATIONS.sortino10YValue}</p>
                                                        </UITooltipContent>
                                                    </UITooltip>
                                                </TableHead>
                                            )}
                                            <TableHead onClick={() => handleSort("maxDDValue")} className="cursor-pointer hover:bg-muted/50 text-right min-w-[80px]">
                                                <UITooltip delayDuration={0}>
                                                    <UITooltipTrigger asChild>
                                                        <div className="flex items-center justify-end gap-1 w-full">
                                                            Max DD
                                                            <Info className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                                            {sortConfig?.key === "maxDDValue" && (
                                                                sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                                                            )}
                                                        </div>
                                                    </UITooltipTrigger>
                                                    <UITooltipContent side="top" align="center">
                                                        <p className="w-48">{METRIC_EXPLANATIONS.maxDDValue}</p>
                                                    </UITooltipContent>
                                                </UITooltip>
                                            </TableHead>
                                            <TableHead onClick={() => handleSort("ulcerIndexValue")} className="cursor-pointer hover:bg-muted/50 text-right min-w-[100px]">
                                                <UITooltip delayDuration={0}>
                                                    <UITooltipTrigger asChild>
                                                        <div className="flex items-center justify-end gap-1 w-full">
                                                            Ulcer Index
                                                            <Info className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                                            {sortConfig?.key === "ulcerIndexValue" && (
                                                                sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                                                            )}
                                                        </div>
                                                    </UITooltipTrigger>
                                                    <UITooltipContent side="top" align="center">
                                                        <p className="w-48">{METRIC_EXPLANATIONS.ulcerIndexValue}</p>
                                                    </UITooltipContent>
                                                </UITooltip>
                                            </TableHead>
                                            <TableHead onClick={() => handleSort("recoveryMonthsValue")} className="cursor-pointer hover:bg-muted/50 text-right min-w-[140px]">
                                                <UITooltip delayDuration={0}>
                                                    <UITooltipTrigger asChild>
                                                        <div className="flex items-center justify-end gap-1 w-full">
                                                            Longest Recovery
                                                            <Info className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                                            {sortConfig?.key === "recoveryMonthsValue" && (
                                                                sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                                                            )}
                                                        </div>
                                                    </UITooltipTrigger>
                                                    <UITooltipContent side="top" align="center">
                                                        <p className="w-48">{METRIC_EXPLANATIONS.recoveryMonthsValue}</p>
                                                    </UITooltipContent>
                                                </UITooltip>
                                            </TableHead>
                                            <TableHead onClick={() => handleSort("cape")} className="cursor-pointer hover:bg-muted/50 text-right min-w-[100px]">
                                                <UITooltip delayDuration={0}>
                                                    <UITooltipTrigger asChild>
                                                        <div className="flex items-center justify-end gap-1 w-full">
                                                            CAPE
                                                            <Info className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                                            {sortConfig?.key === "cape" && (
                                                                sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                                                            )}
                                                        </div>
                                                    </UITooltipTrigger>
                                                    <UITooltipContent side="top" align="center">
                                                        <p className="w-48">{METRIC_EXPLANATIONS.capeValue}</p>
                                                    </UITooltipContent>
                                                </UITooltip>
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {metricsTableRows.map((row) => (
                                            <TableRow key={row.key}>
                                                <TableCell className="font-medium py-2 sticky left-0 bg-background z-10 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                    <div className="flex flex-col">
                                                        <span className="whitespace-nowrap">{row.name}</span>
                                                        {(() => {
                                                            const item = slicedItems.find(si => makeKey(si) === row.key);
                                                            const range = item ? getItemRange(item) : null;
                                                            return range ? (
                                                                <span className="text-[10px] text-muted-foreground font-normal whitespace-nowrap">
                                                                    {formatDate(range.start)} - {formatDate(range.end)}
                                                                </span>
                                                            ) : null;
                                                        })()}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {(currency === "USD" ? "$" : "€") + row.finalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                </TableCell>
                                                {!showRollingMetrics && (
                                                    <TableCell className="text-right">{row.cagr}</TableCell>
                                                )}
                                                {showRollingMetrics && (
                                                    <>
                                                        <TableCell className="text-right text-blue-600">{row.avgRolling5YearCAGR}</TableCell>
                                                        <TableCell className="text-right text-blue-600">{row.avgRolling10YearCAGR}</TableCell>
                                                    </>
                                                )}
                                                {!showRollingMetrics ? (
                                                    <TableCell className="text-right">{row.vol}</TableCell>
                                                ) : (
                                                    <TableCell className="text-right text-blue-600">{row.vol10Y}</TableCell>
                                                )}
                                                {!showRollingMetrics ? (
                                                    <TableCell className="text-right">{row.sharpe}</TableCell>
                                                ) : (
                                                    <TableCell className="text-right text-blue-600">{row.sharpe10Y}</TableCell>
                                                )}
                                                {!showRollingMetrics ? (
                                                    <TableCell className="text-right">{row.sortino}</TableCell>
                                                ) : (
                                                    <TableCell className="text-right text-blue-600">{row.sortino10Y}</TableCell>
                                                )}
                                                <TableCell className={`text-right ${(() => {
                                                    const val = Math.abs(row.maxDDValue);
                                                    if (val < 0.15) return "text-red-400";
                                                    if (val < 0.25) return "text-red-500";
                                                    if (val < 0.35) return "text-red-600";
                                                    if (val < 0.50) return "text-red-700";
                                                    return "text-red-800";
                                                })()}`}>{row.maxDD}</TableCell>
                                                <TableCell className="text-right">{row.ulcerIndex}</TableCell>
                                                <TableCell className="text-right">{row.recoveryMonths}</TableCell>
                                                <TableCell className="text-right text-amber-600">{row.cape ? row.cape.toFixed(1) : "--"}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {validItems.length > 0 && (
                    <PortfolioCompositionCards
                        items={validItems
                            .filter(item => item.type === "portfolio")
                            .map(item => {
                                let itemWeights: Record<string, number> = {};
                                if (item.id === "current") {
                                    itemWeights = weights;
                                } else if (item.weights) {
                                    itemWeights = item.weights;
                                } else {
                                    const p = savedPortfolios.find(sp => sp.id === item.id);
                                    if (p) itemWeights = p.weights;
                                }
                                return {
                                    id: item.id,
                                    name: item.name,
                                    color: item.color,
                                    weights: itemWeights
                                };
                            })
                        }
                        onReorder={handleReorder}
                    />
                )}

                <Tabs defaultValue="performance" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="performance">Performance</TabsTrigger>
                        <TabsTrigger value="simulations">Simulations</TabsTrigger>
                    </TabsList>

                    <TabsContent value="performance" className="space-y-6 mt-6">
                        {validItems.length > 1 ? (
                            <>
                                <RiskReturnScatterChart
                                    key={`risk-return-${calcKey}`}
                                    items={slicedItems.map((i) => ({ name: i.name, color: i.color, result: i.result }))}
                                />

                                <Card key={`growth-${calcKey}`}>
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <CardTitle>Growth Comparison</CardTitle>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => downloadCSV(chartData, "growth-comparison")}
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[400px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={chartData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                    <XAxis
                                                        dataKey="date"
                                                        stroke="#888888"
                                                        fontSize={12}
                                                        tickLine={false}
                                                        axisLine={false}
                                                        minTickGap={30}
                                                        tickFormatter={(value) => new Date(value).getFullYear().toString()}
                                                    />
                                                    <YAxis
                                                        stroke="#888888"
                                                        fontSize={12}
                                                        tickLine={false}
                                                        axisLine={false}
                                                        domain={["auto", "auto"]}
                                                        tickFormatter={(value) => {
                                                            const symbol = currency === "USD" ? "$" : "€";
                                                            if (value >= 1000000) return `${symbol}${(value / 1000000).toFixed(1)}M`;
                                                            if (value >= 1000) return `${symbol}${(value / 1000).toFixed(0)}k`;
                                                            return `${symbol}${value.toFixed(0)}`;
                                                        }}
                                                    />
                                                    <RechartsTooltip
                                                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--card-foreground))" }}
                                                        labelFormatter={(label: any) => new Date(label).toLocaleDateString(undefined, { year: "numeric", month: "long" })}
                                                        formatter={(value: number, name: string) => {
                                                            const symbol = currency === "USD" ? "$" : "€";
                                                            return [`${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, name];
                                                        }}
                                                    />
                                                    <Legend
                                                        formatter={(value: string) => {
                                                            const item = slicedItems.find(item => item.name === value);
                                                            if (!item?.result) return value;

                                                            const cagrValue = (item.result.portValues && item.result.totalInvested && item.result.portValues.length === item.result.totalInvested.length)
                                                                ? cagrRecurring(item.result.portValues, item.result.totalInvested)
                                                                : cagr(Object.keys(item.result.idxMap).sort().map((d) => ({ value: item.result!.idxMap[d] })));

                                                            return `${value} (${(cagrValue * 100).toFixed(2)}%)`;
                                                        }}
                                                    />
                                                    {slicedItems
                                                        .filter(item => item.result)
                                                        .map((item) => (
                                                            <Line
                                                                key={item.name}
                                                                type="monotone"
                                                                dataKey={item.name}
                                                                name={item.name}
                                                                stroke={item.color}
                                                                strokeWidth={2}
                                                                dot={false}
                                                            />
                                                        ))}
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card key={`rolling-${calcKey}`}>
                                    <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                        <div className="flex items-center gap-4">
                                            <div>
                                                <CardTitle>Rolling Returns</CardTitle>
                                                <CardDescription>Annualized return over {rollingYears}-year rolling periods.</CardDescription>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => downloadCSV(rollingComparisonData, "rolling-returns")}
                                            >
                                                <Download className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-muted-foreground whitespace-nowrap">Period (Years):</span>
                                            <Input
                                                type="number"
                                                value={rollingYears}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value);
                                                    if (val > 0) setRollingYears(val);
                                                }}
                                                className="w-[80px] h-9"
                                                min={1}
                                                max={50}
                                            />
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[300px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={rollingComparisonData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                    <XAxis
                                                        dataKey="date"
                                                        stroke="#888888"
                                                        fontSize={12}
                                                        tickLine={false}
                                                        axisLine={false}
                                                        minTickGap={30}
                                                        tickFormatter={(value) => new Date(value).getFullYear().toString()}
                                                    />
                                                    <YAxis
                                                        stroke="#888888"
                                                        fontSize={12}
                                                        tickLine={false}
                                                        axisLine={false}
                                                        tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                                                        domain={["auto", "auto"]}
                                                    />
                                                    <RechartsTooltip
                                                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--card-foreground))" }}
                                                        labelFormatter={(label: any) => new Date(label).toLocaleDateString(undefined, { year: "numeric", month: "long" })}
                                                        formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name]}
                                                    />
                                                    <Legend
                                                        verticalAlign="bottom"
                                                        formatter={(value: any) => rollingLegendLabel[String(value)] ?? String(value)}
                                                    />
                                                    <ReferenceLine y={0} stroke="#ef4444" strokeWidth={2} />
                                                    {validItems.map((item) => (
                                                        <Line
                                                            key={item.name}
                                                            type="monotone"
                                                            dataKey={item.name}
                                                            name={rollingLegendLabel[item.name] ?? item.name}
                                                            stroke={item.color}
                                                            strokeWidth={2}
                                                            dot={false}
                                                        />
                                                    ))}
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card key={`drawdowns-${calcKey}`}>
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <div>
                                            <CardTitle>Drawdowns</CardTitle>
                                            <CardDescription>Historical decline from peak.</CardDescription>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => downloadCSV(drawdownComparisonData, "drawdowns")}
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[300px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={drawdownComparisonData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                    <XAxis
                                                        dataKey="date"
                                                        stroke="#888888"
                                                        fontSize={12}
                                                        tickLine={false}
                                                        axisLine={false}
                                                        minTickGap={30}
                                                        tickFormatter={(value) => new Date(value).getFullYear().toString()}
                                                    />
                                                    <YAxis
                                                        stroke="#888888"
                                                        fontSize={12}
                                                        tickLine={false}
                                                        axisLine={false}
                                                        tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                                                    />
                                                    <RechartsTooltip
                                                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--card-foreground))" }}
                                                        labelFormatter={(label: any) => new Date(label).toLocaleDateString(undefined, { year: "numeric", month: "long" })}
                                                        formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name]}
                                                    />
                                                    <Legend />
                                                    {validItems.map((item) => (
                                                        <Line
                                                            key={item.name}
                                                            type="monotone"
                                                            dataKey={item.name}
                                                            stroke={item.color}
                                                            strokeWidth={2}
                                                            dot={false}
                                                        />
                                                    ))}
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card key={`annual-${calcKey}`}>
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <div>
                                            <CardTitle>Annual Returns</CardTitle>
                                            <CardDescription>Year-over-year performance.</CardDescription>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => downloadCSV(annualComparisonData, "annual-returns")}
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[300px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={annualComparisonData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                    <XAxis
                                                        dataKey="year"
                                                        stroke="#888888"
                                                        fontSize={12}
                                                        tickLine={false}
                                                        axisLine={false}
                                                    />
                                                    <YAxis
                                                        stroke="#888888"
                                                        fontSize={12}
                                                        tickLine={false}
                                                        axisLine={false}
                                                        tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                                                        domain={["auto", "auto"]}
                                                    />
                                                    <RechartsTooltip
                                                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--card-foreground))" }}
                                                        formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name]}
                                                    />
                                                    <Legend />
                                                    {validItems.map((item) => (
                                                        <Bar key={item.name} dataKey={item.name} fill={item.color} />
                                                    ))}
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </CardContent>
                                </Card>

                                <TimeToRecoveryChart
                                    key={`recovery-${calcKey}`}
                                    portfolio={primaryResult}
                                    items={slicedItems.map((i) => ({ name: i.name, color: i.color, result: i.result }))}
                                />

                                {(() => {
                                    const portfoliosList = validItems
                                        .filter(item => item.type === "portfolio")
                                        .map(item => {
                                            let itemWeights: Record<string, number> = {};
                                            if (item.id === "current") {
                                                itemWeights = weights;
                                            } else {
                                                const p = savedPortfolios.find(sp => sp.id === item.id);
                                                if (p) itemWeights = p.weights;
                                            }
                                            const assets = Object.entries(itemWeights)
                                                .filter(([_, weight]) => weight > 0)
                                                .map(([asset]) => asset);
                                            return {
                                                id: item.id,
                                                name: item.name,
                                                assets
                                            };
                                        })
                                        .filter(p => p.assets.length >= 2);

                                    // Handle case where individual assets are selected for comparison
                                    const selectedIndividualAssets = validItems
                                        .filter(item => item.type === "asset")
                                        .map(item => item.id);

                                    if (selectedIndividualAssets.length >= 2) {
                                        portfoliosList.push({
                                            id: "selected-assets",
                                            name: "Selected Assets",
                                            assets: selectedIndividualAssets
                                        });
                                    }

                                    return portfoliosList.length > 0 ? (
                                        <CorrelationMatrix
                                            norm={norm}
                                            portfolios={portfoliosList}
                                            startDate={startDate}
                                            endDate={endDate}
                                        />
                                    ) : null;
                                })()}
                            </>
                        ) : (
                            primaryResult && (
                                <div className="space-y-6">
                                    <RiskReturnScatterChart
                                        key={`single-risk-return-${calcKey}`}
                                        items={[{
                                            name: slicedItems[0]?.name || "Current Portfolio",
                                            color: COLORS[0],
                                            result: primaryResult
                                        }]}
                                    />
                                    <PortfolioChart key={`single-growth-${calcKey}`} portfolio={primaryResult} currency={currency} />
                                    <InflationImpactChart key={`single-inflation-${calcKey}`} portfolio={primaryResult} cpiMap={cpiMap} currency={currency} />
                                    <RollingReturnsChart key={`single-rolling-${calcKey}`} portfolio={primaryResult} />
                                    <DrawdownChart
                                        key={`single-dd-${calcKey}`}
                                        portfolios={[{
                                            name: slicedItems[0]?.name || "Current Portfolio",
                                            portfolio: primaryResult,
                                            color: COLORS[0]
                                        }]}
                                        mode={investmentMode}
                                    />
                                    <AnnualReturnsChart key={`single-annual-${calcKey}`} portfolio={primaryResult} />
                                    <TimeToRecoveryChart key={`single-recovery-${calcKey}`} portfolio={primaryResult} />
                                    {(() => {
                                        const assetList = Object.entries(weights)
                                            .filter(([_, w]) => w > 0)
                                            .map(([a]) => a);

                                        return assetList.length >= 2 ? (
                                            <CorrelationMatrix
                                                norm={norm}
                                                portfolios={[{
                                                    id: "current",
                                                    name: slicedItems[0]?.name || "Current Portfolio",
                                                    assets: assetList
                                                }]}
                                                startDate={startDate}
                                                endDate={endDate}
                                            />
                                        ) : null;
                                    })()}
                                </div>
                            )
                        )}
                    </TabsContent>



                    <TabsContent value="simulations" className="space-y-6 mt-6">
                        {(() => {
                            const targetKey = (validItems.length > 1 && simSelectedKey && validItems.find(i => makeKey(i) === simSelectedKey))
                                ? simSelectedKey
                                : (validItems.length > 0 ? makeKey(validItems[0]) : null);

                            const simulationItem = validItems.find(i => makeKey(i) === targetKey);

                            if (!simulationItem) {
                                return (
                                    <div className="flex h-48 items-center justify-center border rounded-lg bg-muted/10 border-dashed">
                                        <p className="text-muted-foreground text-sm">No valid data available for simulations.</p>
                                    </div>
                                );
                            }

                            // Extract weights
                            let simWeights: Record<string, number> = {};
                            if (simulationItem.type === "portfolio") {
                                if (simulationItem.weights) {
                                    simWeights = simulationItem.weights;
                                } else if (simulationItem.id === "current") {
                                    simWeights = weights;
                                } else {
                                    const p = savedPortfolios.find(sp => sp.id === simulationItem.id);
                                    if (p) simWeights = p.weights;
                                }
                            } else if (simulationItem.type === "asset") {
                                simWeights = { [simulationItem.id]: 1 };
                            }

                            return (
                                <div className="space-y-6">
                                    {validItems.length > 1 && (
                                        <div className="flex items-center justify-end">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-muted-foreground">Simulate for:</span>
                                                <Select
                                                    value={targetKey || ""}
                                                    onValueChange={setSimSelectedKey}
                                                >
                                                    <SelectTrigger className="w-[200px] h-8">
                                                        <SelectValue placeholder="Select portfolio" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {validItems.map(item => (
                                                            <SelectItem key={makeKey(item)} value={makeKey(item)}>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                                                    {item.name}
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    )}

                                    <EfficientFrontierChart
                                        key={`frontier-${targetKey}-${calcKey}`}
                                        norm={norm}
                                        weights={simWeights}
                                        startDate={startDate}
                                        endDate={endDate}
                                        rf={riskFreeRate}
                                    />
                                    <MonteCarloChart
                                        key={`monte-carlo-${targetKey}-${calcKey}`}
                                        norm={norm}
                                        weights={simWeights}
                                        startDate={startDate}
                                        endDate={endDate}
                                        rf={riskFreeRate}
                                        initialInvestment={initialInvestment}
                                        currency={currency}
                                    />
                                </div>
                            );
                        })()}
                    </TabsContent>
                </Tabs>
                {/* Debugging info can be hidden or removed in prod */}
                {/* <div className="text-xs text-muted-foreground mt-2">
                Debug: Common Range {slicedItems[0]?.result?.dates[0]} - {slicedItems[0]?.result?.dates[slicedItems[0].result.dates.length-1]}
            </div> */}
            </div>
        </div>
    );
}
