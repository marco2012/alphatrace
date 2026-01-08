"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthPickerInput } from "@/components/ui/month-picker-input";
import { usePortfolio } from "@/context/portfolio-context";
import { InvestmentMode, RebalancePeriod, YearSelection } from "@/lib/finance";
import { SlidersHorizontal, TrendingUp, RefreshCw, Calendar, DollarSign, History, ChevronDown, ChevronUp, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PortfolioControls() {
    const {
        startDate, setStartDate,
        endDate, setEndDate,
        initialInvestment, setInitialInvestment,
        monthlyInvestment, setMonthlyInvestment,
        investmentMode, setInvestmentMode,
        rebalance, setRebalance,
        yearSelection, handleYearSelectionChange,
        currency, setCurrency
    } = usePortfolio();

    const [isExpanded, setIsExpanded] = useState(false);

    // Auto-expand on desktop
    useEffect(() => {
        if (window.innerWidth >= 1024) {
            setIsExpanded(true);
        }
    }, []);

    return (
        <div className="sticky top-14 z-50 pt-2 pb-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <Card className="shadow-lg border-primary/10 overflow-hidden">
                <CardHeader
                    className="py-2 px-4 border-b cursor-pointer hover:bg-muted/50 transition-colors select-none"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                            <SlidersHorizontal className="h-4 w-4 text-primary" />
                            <CardTitle className="text-sm font-semibold">Strategy Settings</CardTitle>
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-transparent">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className={cn(
                    "p-3 transition-all duration-300",
                    isExpanded ? "h-auto opacity-100" : "h-0 p-0 opacity-0 overflow-hidden"
                )}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-8 gap-3">
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Mode</Label>
                            <Select value={investmentMode} onValueChange={(v) => setInvestmentMode(v as InvestmentMode)}>
                                <SelectTrigger className="h-8 text-xs w-full bg-muted/50 border-none hover:bg-muted transition-colors">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="lump_sum">Lump Sum</SelectItem>
                                    <SelectItem value="recurring">Recurring</SelectItem>
                                    <SelectItem value="hybrid">Hybrid</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" /> Currency</Label>
                            <Select value={currency} onValueChange={(v) => setCurrency(v as "EUR" | "USD")}>
                                <SelectTrigger className="h-8 text-xs w-full bg-muted/50 border-none hover:bg-muted transition-colors">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="EUR">EUR</SelectItem>
                                    <SelectItem value="USD">USD</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Rebalancing</Label>
                            <Select value={rebalance} onValueChange={(v) => setRebalance(v as RebalancePeriod)}>
                                <SelectTrigger className="h-8 text-xs w-full bg-muted/50 border-none hover:bg-muted transition-colors">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Monthly">Monthly</SelectItem>
                                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                                    <SelectItem value="Annual">Annual</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1"><History className="h-3 w-3" /> Years</Label>
                            <Select
                                value={yearSelection.toString()}
                                onValueChange={(v) => handleYearSelectionChange(
                                    (v === "MAX" || v === "dotcom_crash" || v === "financial_crisis" || v === "covid_crash" || v === "2000s")
                                        ? v as YearSelection
                                        : Number(v) as YearSelection
                                )}
                            >
                                <SelectTrigger className="h-8 text-xs w-full bg-muted/50 border-none hover:bg-muted transition-colors">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1 Year</SelectItem>
                                    <SelectItem value="3">3 Years</SelectItem>
                                    <SelectItem value="5">5 Years</SelectItem>
                                    <SelectItem value="10">10 Years</SelectItem>
                                    <SelectItem value="15">15 Years</SelectItem>
                                    <SelectItem value="20">20 Years</SelectItem>
                                    <SelectItem value="25">25 Years</SelectItem>
                                    <SelectItem value="30">30 Years</SelectItem>
                                    <SelectItem value="MAX">MAX</SelectItem>
                                    <SelectItem value="dotcom_crash">Dotcom Crash (2000-2003)</SelectItem>
                                    <SelectItem value="financial_crisis">Financial Crisis (2008-2009)</SelectItem>
                                    <SelectItem value="covid_crash">Covid Crash (2020)</SelectItem>
                                    <SelectItem value="2000s">The 2000s (2000-2009)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Start Date</Label>
                            <MonthPickerInput
                                value={startDate}
                                onChange={setStartDate}
                                placeholder="Select start month"
                                className="h-8 text-xs px-2 w-full bg-muted/50 border-none hover:bg-muted transition-colors"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> End Date</Label>
                            <MonthPickerInput
                                value={endDate}
                                onChange={setEndDate}
                                placeholder="Select end month"
                                className="h-8 text-xs px-2 w-full bg-muted/50 border-none hover:bg-muted transition-colors"
                            />
                        </div>

                        {investmentMode !== "recurring" && (
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Initial Inv.</Label>
                                <Input
                                    type="number"
                                    value={initialInvestment}
                                    onChange={(e) => setInitialInvestment(Number(e.target.value))}
                                    className="h-8 text-xs px-2 w-full bg-muted/50 border-none hover:bg-muted transition-colors"
                                />
                            </div>
                        )}

                        {investmentMode !== "lump_sum" && (
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Monthly Inv.</Label>
                                <Input
                                    type="number"
                                    value={monthlyInvestment}
                                    onChange={(e) => setMonthlyInvestment(Number(e.target.value))}
                                    className="h-8 text-xs px-2 w-full bg-muted/50 border-none hover:bg-muted transition-colors"
                                />
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
