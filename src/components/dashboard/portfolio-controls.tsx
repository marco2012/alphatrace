"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthPickerInput } from "@/components/ui/month-picker-input";
import { usePortfolio } from "@/context/portfolio-context";
import { InvestmentMode, RebalancePeriod, YearSelection } from "@/lib/finance";
import { SlidersHorizontal, TrendingUp, RefreshCw, Calendar, DollarSign, History } from "lucide-react";

export function PortfolioControls() {
    const {
        startDate, setStartDate,
        endDate, setEndDate,
        initialInvestment, setInitialInvestment,
        monthlyInvestment, setMonthlyInvestment,
        investmentMode, setInvestmentMode,
        rebalance, setRebalance,
        yearSelection, handleYearSelectionChange
    } = usePortfolio();

    return (
        <Card>
            <CardHeader className="py-3 px-4 border-b">
                <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base font-medium">Strategy Settings</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Mode</Label>
                        <Select value={investmentMode} onValueChange={(v) => setInvestmentMode(v as InvestmentMode)}>
                            <SelectTrigger className="h-8 text-sm w-full">
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
                        <Label className="text-xs text-muted-foreground flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Rebalancing</Label>
                        <Select value={rebalance} onValueChange={(v) => setRebalance(v as RebalancePeriod)}>
                            <SelectTrigger className="h-8 text-sm w-full">
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
                        <Label className="text-xs text-muted-foreground flex items-center gap-1"><History className="h-3 w-3" /> Years</Label>
                        <Select value={yearSelection.toString()} onValueChange={(v) => handleYearSelectionChange(v === "MAX" ? "MAX" : Number(v) as YearSelection)}>
                            <SelectTrigger className="h-8 text-sm w-full">
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
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Start Date</Label>
                        <MonthPickerInput
                            value={startDate}
                            onChange={setStartDate}
                            placeholder="Select start month"
                            className="h-8 text-sm px-2 w-full"
                        />
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> End Date</Label>
                        <MonthPickerInput
                            value={endDate}
                            onChange={setEndDate}
                            placeholder="Select end month"
                            className="h-8 text-sm px-2 w-full"
                        />
                    </div>

                    {investmentMode !== "recurring" && (
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Initial Inv.</Label>
                            <Input
                                type="number"
                                value={initialInvestment}
                                onChange={(e) => setInitialInvestment(Number(e.target.value))}
                                className="h-8 text-sm px-2 w-full"
                            />
                        </div>
                    )}

                    {investmentMode !== "lump_sum" && (
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Monthly Inv.</Label>
                            <Input
                                type="number"
                                value={monthlyInvestment}
                                onChange={(e) => setMonthlyInvestment(Number(e.target.value))}
                                className="h-8 text-sm px-2 w-full"
                            />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
