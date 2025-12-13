"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { usePortfolio } from "@/context/portfolio-context";
import { InvestmentMode, RebalancePeriod } from "@/lib/finance";
import { SlidersHorizontal, TrendingUp, RefreshCw, Calendar, DollarSign } from "lucide-react";

export function PortfolioControls() {
    const {
        startDate, setStartDate,
        endDate, setEndDate,
        initialInvestment, setInitialInvestment,
        monthlyInvestment, setMonthlyInvestment,
        investmentMode, setInvestmentMode,
        rebalance, setRebalance
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Mode</Label>
                        <Select value={investmentMode} onValueChange={(v) => setInvestmentMode(v as InvestmentMode)}>
                            <SelectTrigger className="h-8 text-sm">
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
                            <SelectTrigger className="h-8 text-sm">
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
                        <Label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Start Date</Label>
                        <DatePicker
                            value={startDate}
                            onChange={setStartDate}
                            placeholder="Select start date"
                            className="h-8 text-sm px-2"
                        />
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> End Date</Label>
                        <DatePicker
                            value={endDate}
                            onChange={setEndDate}
                            placeholder="Select end date"
                            className="h-8 text-sm px-2"
                        />
                    </div>

                    {investmentMode !== "recurring" && (
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Initial Inv.</Label>
                            <Input
                                type="number"
                                value={initialInvestment}
                                onChange={(e) => setInitialInvestment(Number(e.target.value))}
                                className="h-8 text-sm px-2"
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
                                className="h-8 text-sm px-2"
                            />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
