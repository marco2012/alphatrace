"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { usePortfolio } from "@/context/portfolio-context";
import { Trash2, Upload, Plus, Briefcase, Share2, Copy } from "lucide-react";
import { AssetAllocation } from "@/components/dashboard/asset-allocation";
import { CategoryAllocationPie } from "@/components/dashboard/category-allocation-pie";
import { AnalysisSection } from "@/components/dashboard/analysis-section";
import { getAssetCategory } from "@/lib/finance";
import { toast } from "sonner";

export default function PortfoliosPage() {
    const { savedPortfolios, savePortfolio, deletePortfolio, loadPortfolio, duplicatePortfolio, activePortfolioId, activePortfolioName, weights, handleWeightChange, columns } = usePortfolio();
    const [newPortfolioName, setNewPortfolioName] = useState("");
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [portfolioToDelete, setPortfolioToDelete] = useState<{ id: string; name: string } | null>(null);

    const formatClassBreakdown = (w: Record<string, number>) => {
        const entries = Object.entries(w || {}).filter(([, v]) => (v ?? 0) > 0);
        const total = entries.reduce((sum, [, v]) => sum + (v ?? 0), 0) || 1;
        const byCat: Record<string, number> = {};
        for (const [asset, v] of entries) {
            const cat = getAssetCategory(asset) || "other";
            byCat[cat] = (byCat[cat] || 0) + (v ?? 0);
        }
        const order = ["stocks", "bonds", "cash", "gold", "other"];
        return order
            .filter((k) => byCat[k] != null)
            .map((k) => `${k.toUpperCase()}: ${Math.round((byCat[k] / total) * 100)}%`)
            .join(" · ");
    };

    const getCategoryPercentage = (weights: Record<string, number>, category: string) => {
        const entries = Object.entries(weights || {}).filter(([, v]) => (v ?? 0) > 0);
        const total = entries.reduce((sum, [, v]) => sum + (v ?? 0), 0) || 1;
        const byCat: Record<string, number> = {};
        for (const [asset, v] of entries) {
            const cat = getAssetCategory(asset) || "other";
            byCat[cat] = (byCat[cat] || 0) + (v ?? 0);
        }
        const percentage = byCat[category] || 0;
        return Math.round((percentage / total) * 100);
    };

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
        const nameToSave = (newPortfolioName || activePortfolioName || "").trim();
        if (!nameToSave) return;
        savePortfolio(nameToSave);
        setNewPortfolioName(nameToSave);
    };

    const handleLoad = (id: string, name: string) => {
        loadPortfolio(id);
        setNewPortfolioName(name);
    };

    const handleDeleteClick = (id: string, name: string) => {
        setPortfolioToDelete({ id, name });
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = () => {
        if (portfolioToDelete) {
            deletePortfolio(portfolioToDelete.id);
            setDeleteDialogOpen(false);
            setPortfolioToDelete(null);
        }
    };

    return (
        <>
            <DashboardLayout>
                <div className="flex flex-col gap-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Portfolio Builder</h1>
                        <p className="text-muted-foreground">Manage assets and build your portfolio.</p>
                    </div>

                    <div className="flex flex-col gap-6">
                        {/* Saved Portfolios */}
                        <div id="saved-portfolios" className="space-y-3 scroll-mt-24">
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
                                            toast.success("Link to share all portfolios copied!", { duration: 1800 });
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
                                            <Plus className="mr-2 h-4 w-4" /> {activePortfolioId ? "Update" : "Save"}
                                        </Button>
                                    </div>
                                    {savedPortfolios.length === 0 ? (
                                        <div className="text-center py-10 text-muted-foreground">
                                            <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                            <p>No portfolios saved yet.</p>
                                        </div>
                                    ) : (
                                        <div className="rounded-md border overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Name</TableHead>
                                                        <TableHead className="hidden text-center sm:table-cell">Stocks</TableHead>
                                                        <TableHead className="hidden text-center sm:table-cell">Bonds</TableHead>
                                                        <TableHead className="hidden text-center sm:table-cell">Cash</TableHead>
                                                        <TableHead className="hidden text-center sm:table-cell">Gold</TableHead>
                                                        <TableHead>Date</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {savedPortfolios.map((p) => (
                                                        <TableRow key={p.id} className={activePortfolioId === p.id ? "bg-muted/30" : undefined}>
                                                            <TableCell className="max-w-[180px] truncate font-medium sm:max-w-none">{p.name}</TableCell>
                                                            <TableCell className="hidden text-center text-sm sm:table-cell">
                                                                {getCategoryPercentage(p.weights, 'stocks')}%
                                                            </TableCell>
                                                            <TableCell className="hidden text-center text-sm sm:table-cell">
                                                                {getCategoryPercentage(p.weights, 'bonds')}%
                                                            </TableCell>
                                                            <TableCell className="hidden text-center text-sm sm:table-cell">
                                                                {getCategoryPercentage(p.weights, 'cash')}%
                                                            </TableCell>
                                                            <TableCell className="hidden text-center text-sm sm:table-cell">
                                                                {getCategoryPercentage(p.weights, 'gold')}%
                                                            </TableCell>
                                                            <TableCell className="text-muted-foreground text-xs">
                                                                {new Date(p.date).toLocaleDateString()}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex flex-col justify-end gap-2 sm:flex-row sm:flex-wrap">
                                                                    <Button className="w-full sm:w-auto" variant="secondary" size="sm" onClick={() => {
                                                                        const url = getShareUrl(p.weights);
                                                                        navigator.clipboard.writeText(url);
                                                                        toast.success(`Link for '${p.name}' copied to clipboard!`, { duration: 1800 });
                                                                    }}>
                                                                        <Share2 className="h-4 w-4 sm:mr-2" />
                                                                        <span className="hidden sm:inline">Share</span>
                                                                    </Button>
                                                                    <Button className="w-full sm:w-auto" variant="secondary" size="sm" onClick={() => handleLoad(p.id, p.name)}>
                                                                        <Upload className="h-4 w-4 sm:mr-2" />
                                                                        <span className="hidden sm:inline">Load</span>
                                                                    </Button>
                                                                    <Button className="w-full sm:w-auto" variant="secondary" size="sm" onClick={() => duplicatePortfolio(p.id)}>
                                                                        <Copy className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button className="w-full sm:w-auto" variant="destructive" size="sm" onClick={() => handleDeleteClick(p.id, p.name)}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
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

                        {/* Asset Allocation */}
                        <div id="asset-allocation" className="space-y-3 min-h-0 scroll-mt-24">
                            <div className="grid gap-6 lg:grid-cols-3 items-start">
                                <div className="lg:col-span-2">
                                    <AssetAllocation
                                        weights={weights}
                                        onWeightChange={handleWeightChange}
                                        assets={columns}
                                        portfolioName={activePortfolioName}
                                    />
                                </div>
                                <CategoryAllocationPie weights={weights} />
                            </div>
                        </div>

                        {/* Analysis */}
                        <div id="analysis" className="space-y-3 scroll-mt-24">
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight">Analysis</h2>
                                <p className="text-muted-foreground">Analyze and compare performance strategies.</p>
                            </div>
                            <AnalysisSection />
                        </div>
                    </div>
                </div>
            </DashboardLayout>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Portfolio</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{portfolioToDelete?.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
