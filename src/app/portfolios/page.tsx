"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePortfolio } from "@/context/portfolio-context";
import { Trash2, Upload, Plus, Briefcase, Share2 } from "lucide-react";
import { AssetAllocation } from "@/components/dashboard/asset-allocation";
import { toast } from "sonner";

export default function PortfoliosPage() {
    const { savedPortfolios, savePortfolio, deletePortfolio, loadPortfolio, weights, handleWeightChange, columns } = usePortfolio();
    const [newPortfolioName, setNewPortfolioName] = useState("");

    const getShareUrl = (weights: Record<string, number>) => {
        const active = Object.entries(weights).reduce((acc, [k, v]) => {
            if (v > 0) acc[k] = v;
            return acc;
        }, {} as Record<string, number>);
        const data = btoa(JSON.stringify(active));
        const url = new URL(window.location.href);
        url.search = ""; // clear existing params
        url.searchParams.set("share", data);
        return url.toString();
    };

    const getShareAllUrl = (portfolios: any[]) => {
        const optimized = portfolios.map(p => ({
            n: p.name,
            w: Object.entries(p.weights).reduce((acc, [k, v]) => {
                if ((v as number) > 0) acc[k] = (v as number);
                return acc;
            }, {} as Record<string, number>)
        }));
        const data = btoa(JSON.stringify(optimized));
        const url = new URL(window.location.href);
        url.search = "";
        url.searchParams.set("share_all", data);
        return url.toString();
    };

    const handleSave = () => {
        if (newPortfolioName) {
            savePortfolio(newPortfolioName);
            setNewPortfolioName("");
        }
    };

    return (
        <DashboardLayout>
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Portfolio Builder</h1>
                    <p className="text-muted-foreground">Manage assets and build your portfolio.</p>
                </div>

                <div className="flex flex-col gap-6">
                    {/* Top: Asset Allocation */}
                    <div className="min-h-0">
                        <AssetAllocation
                            weights={weights}
                            onWeightChange={handleWeightChange}
                            assets={columns}
                        />
                    </div>

                    {/* Bottom: Management */}
                    <div>
                        <Card>
                            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <CardTitle>Saved Portfolios</CardTitle>
                                    <CardDescription>Save a new composition and revisit it any time.</CardDescription>
                                </div>
                                {savedPortfolios.length > 0 && (
                                    <Button variant="outline" size="sm" onClick={() => {
                                        const url = getShareAllUrl(savedPortfolios);
                                        navigator.clipboard.writeText(url);
                                        toast.success("Link to share all portfolios copied!");
                                    }}>
                                        <Share2 className="mr-2 h-4 w-4" /> Share All
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                                    <div className="flex-1">
                                        <Input
                                            placeholder="Portfolio Name"
                                            value={newPortfolioName}
                                            onChange={(e) => setNewPortfolioName(e.target.value)}
                                        />
                                    </div>
                                    <Button onClick={handleSave} className="sm:w-auto">
                                        <Plus className="mr-2 h-4 w-4" /> Save
                                    </Button>
                                </div>
                                {savedPortfolios.length === 0 ? (
                                    <div className="text-center py-10 text-muted-foreground">
                                        <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                        <p>No portfolios saved yet.</p>
                                    </div>
                                ) : (
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {savedPortfolios.map((p) => (
                                                    <TableRow key={p.id}>
                                                        <TableCell className="font-medium">{p.name}</TableCell>
                                                        <TableCell className="text-muted-foreground text-xs">
                                                            {new Date(p.date).toLocaleDateString()}
                                                        </TableCell>
                                                        <TableCell className="text-right space-x-2">
                                                            <Button variant="secondary" size="sm" onClick={() => {
                                                                const url = getShareUrl(p.weights);
                                                                navigator.clipboard.writeText(url);
                                                                toast.success(`Link for '${p.name}' copied to clipboard!`);
                                                            }}>
                                                                <Share2 className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="secondary" size="sm" onClick={() => loadPortfolio(p.id)}>
                                                                <Upload className="h-4 w-4" /> Load
                                                            </Button>
                                                            <Button variant="destructive" size="sm" onClick={() => deletePortfolio(p.id)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
