"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Download, Upload, Settings2 } from "lucide-react";
import { toast } from "sonner";

export function SettingsPanel() {
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
            const response = await fetch("/curvo_data_202511.xlsx");
            if (!response.ok) throw new Error("Failed to fetch default file");
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "curvo_data_202511.xlsx";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success("Default database downloaded");
        } catch {
            toast.error("Failed to download default file");
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
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
            } catch {
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
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Database Settings</CardTitle>
                    <CardDescription>Manage the Excel database file for asset data.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col gap-4">
                        <div>
                            <Label>Current Database</Label>
                            <div className="mt-1 text-sm">
                                {customFileName ? (
                                    <span className="font-medium">{customFileName}</span>
                                ) : (
                                    <span className="text-muted-foreground">Default: curvo_data_202511.xlsx</span>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
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
    );
}
