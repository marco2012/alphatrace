"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ModeToggle } from "@/components/mode-toggle";
import { Input } from "@/components/ui/input";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { usePortfolio } from "@/context/portfolio-context";
import { Switch } from "@/components/ui/switch";
import { Globe } from "lucide-react";

import { cn } from "@/lib/utils";

export function SettingsPanel() {
    const { currency, setCurrency } = usePortfolio();
    const [riskFreeRate, setRiskFreeRate] = useState("0.02");

    useEffect(() => {
        const savedRate = localStorage.getItem("alphatrace_risk_free_rate");
        if (savedRate) setRiskFreeRate(savedRate);
    }, []);

    const handleRiskFreeRateChange = (value: string) => {
        const num = parseFloat(value);
        if (!isNaN(num) && num >= 0 && num <= 1) {
            setRiskFreeRate(value);
            localStorage.setItem("alphatrace_risk_free_rate", value);
            toast.success("Risk-free rate updated");
        } else {
            toast.error("Risk-free rate must be between 0 and 1");
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                        <CardTitle>Appearance</CardTitle>
                    </div>
                    <CardDescription>Customize the look and feel.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label>Theme</Label>
                        <ModeToggle />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Financial Settings</CardTitle>
                    <CardDescription>Configure calculation parameters.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Risk-Free Rate</Label>
                        <Input
                            type="number"
                            step="0.001"
                            min="0"
                            max="1"
                            value={riskFreeRate}
                            onChange={(e) => handleRiskFreeRateChange(e.target.value)}
                            placeholder="0.02"
                        />
                        <div className="text-xs text-muted-foreground">
                            Annual risk-free rate (e.g., 0.02 for 2%)
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                        <div className="space-y-0.5">
                            <Label className="flex items-center gap-2">
                                <Globe className="h-4 w-4 text-muted-foreground" />
                                Base Currency
                            </Label>
                            <div className="text-xs text-muted-foreground">
                                Select between EUR and USD for asset data.
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={cn("text-xs font-medium", currency === "EUR" ? "text-primary" : "text-muted-foreground")}>EUR</span>
                            <Switch
                                checked={currency === "USD"}
                                onCheckedChange={(checked) => setCurrency(checked ? "USD" : "EUR")}
                            />
                            <span className={cn("text-xs font-medium", currency === "USD" ? "text-primary" : "text-muted-foreground")}>USD</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
