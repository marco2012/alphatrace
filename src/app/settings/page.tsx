"use client";

import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
    const [riskFreeRate, setRiskFreeRate] = useState("0.02");
    const [customFileName, setCustomFileName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const savedRate = localStorage.getItem("alphatrace_risk_free_rate");
        if (savedRate) setRiskFreeRate(savedRate);
        const savedFile = localStorage.getItem("alphatrace_custom_file");
        if (savedFile) setCustomFileName(savedFile);
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

    const downloadDefaultFile = async () => {
        try {
            const response = await fetch('/curvo_data_202511.xlsx');
            if (!response.ok) throw new Error('Failed to fetch default file');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'curvo_data_202511.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success("Default database downloaded");
        } catch (error) {
            toast.error("Failed to download default file");
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            toast.error("Please upload an Excel file (.xlsx or .xls)");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                localStorage.setItem("alphatrace_custom_file", file.name);
                localStorage.setItem("alphatrace_custom_file_data", btoa(String.fromCharCode(...data)));
                setCustomFileName(file.name);
                toast.success(`Custom database uploaded: ${file.name}`);
            } catch (error) {
                toast.error("Failed to process file");
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const resetToDefault = () => {
        localStorage.removeItem("alphatrace_custom_file");
        localStorage.removeItem("alphatrace_custom_file_data");
        setCustomFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        toast.success("Reset to default database");
    };

    return (
        <DashboardLayout>
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                    <p className="text-muted-foreground">Manage application preferences.</p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Appearance</CardTitle>
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
                        </CardContent>
                    </Card>

                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle>Database Settings</CardTitle>
                            <CardDescription>Manage the Excel database file for asset data.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                                <div className="flex-1">
                                    <Label>Current Database</Label>
                                    <div className="mt-1 text-sm">
                                        {customFileName ? (
                                            <span className="font-medium">{customFileName}</span>
                                        ) : (
                                            <span className="text-muted-foreground">Default: curvo_data_202511.xlsx</span>
                                        )}
                                    </div>
                                </div>
                                <Button variant="outline" onClick={downloadDefaultFile}>
                                    <Download className="mr-2 h-4 w-4" /> Download Default
                                </Button>
                                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                                    <Upload className="mr-2 h-4 w-4" /> Upload Custom
                                </Button>
                                {customFileName && (
                                    <Button variant="outline" onClick={resetToDefault}>
                                        Reset to Default
                                    </Button>
                                )}
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                            <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <div>
                                    Upload a custom Excel file with asset data. The file should contain a Date column and asset return columns.
                                    After uploading, refresh the page to apply changes.
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
