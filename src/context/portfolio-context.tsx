"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import * as XLSX from "xlsx";
import {
    DEFAULT_WEIGHTS,
    getAssetCategory,
    toMonthStr,
    normalizeAndInterpolate,
    computePortfolio,
    computeRecurringPortfolio,
    computeHybridPortfolio,
    InvestmentMode,
    RebalancePeriod,
    PortfolioResult
} from "@/lib/finance";

interface PortfolioContextType {
    // Data
    rows: any[];
    isLoading: boolean;
    columns: string[];

    // Configuration
    weights: Record<string, number>;
    setWeights: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    handleWeightChange: (asset: string, value: number) => void;

    startDate: string;
    setStartDate: (d: string) => void;
    endDate: string;
    setEndDate: (d: string) => void;

    investmentMode: InvestmentMode;
    setInvestmentMode: (m: InvestmentMode) => void;

    initialInvestment: number;
    setInitialInvestment: (v: number) => void;

    monthlyInvestment: number;
    setMonthlyInvestment: (v: number) => void;

    rebalance: RebalancePeriod;
    setRebalance: (r: RebalancePeriod) => void;

    // Financial Settings
    riskFreeRate: number;
    setRiskFreeRate: (r: number) => void;

    // Results
    portfolio: PortfolioResult | null;

    // Saved Portfolios
    savedPortfolios: SavedPortfolio[];
    activePortfolioId: string | null;
    activePortfolioName: string | null;
    savePortfolio: (name: string) => void;
    deletePortfolio: (id: string) => void;
    loadPortfolio: (id: string) => void;
    duplicatePortfolio: (id: string) => void;

    // Analysis
    computeAssetPortfolio: (asset: string) => PortfolioResult | null;
    computeCustomPortfolio: (customWeights: Record<string, number>) => PortfolioResult | null;
    norm: any;
}

export interface SavedPortfolio {
    id: string;
    name: string;
    weights: Record<string, number>;
    date: string;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
    const [rows, setRows] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [weights, setWeights] = useState<Record<string, number>>({});
    const [startDate, setStartDate] = useState("1994-11-01");
    const [endDate, setEndDate] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [investmentMode, setInvestmentMode] = useState<InvestmentMode>("lump_sum");
    const [initialInvestment, setInitialInvestment] = useState(100000);
    const [monthlyInvestment, setMonthlyInvestment] = useState(1000);
    const [rebalance, setRebalance] = useState<RebalancePeriod>("Annual");
    const [riskFreeRate, setRiskFreeRateState] = useState(0.02);
    const [savedPortfolios, setSavedPortfolios] = useState<SavedPortfolio[]>([]);

    const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);
    const [activePortfolioName, setActivePortfolioName] = useState<string | null>(null);

    const [hasInitialShareParams] = useState(() => {
        if (typeof window === "undefined") return false;
        const params = new URLSearchParams(window.location.search);
        return params.has("share") || params.has("share_all");
    });

    const [didAutoLoadDefault, setDidAutoLoadDefault] = useState(false);

    // Load risk-free rate from localStorage
    useEffect(() => {
        const savedRate = localStorage.getItem("alphatrace_risk_free_rate");
        if (savedRate) {
            const rate = parseFloat(savedRate);
            if (!isNaN(rate) && rate >= 0 && rate <= 1) {
                setRiskFreeRateState(rate);
            }
        }
    }, []);

    // Load Data
    useEffect(() => {
        async function loadData() {
            try {
                let buffer: ArrayBuffer;
                
                // Check for custom file first
                const customFileData = localStorage.getItem("alphatrace_custom_file_data");
                if (customFileData) {
                    // Convert base64 back to binary
                    const binaryString = atob(customFileData);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    buffer = bytes.buffer;
                } else {
                    // Use default file
                    const response = await fetch('/curvo_data_202511.xlsx');
                    if (!response.ok) throw new Error('Failed to fetch data');
                    buffer = await response.arrayBuffer();
                }
                
                const wb = XLSX.read(buffer, { type: "array" });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as any[][];

                if (!json.length) return;

                const headers = json[0].map(h => String(h).trim());
                let dateIdx = headers.findIndex(h => h.toLowerCase() === "date");
                if (dateIdx === -1) dateIdx = 0;

                const body = json.slice(1).filter(r => Array.isArray(r) && r.some(x => x != null && x !== ""));
                const normalized = body.map(arr => {
                    const obj: any = {};
                    headers.forEach((h, i) => {
                        if (!h) return;
                        const v = arr[i];
                        if (i === dateIdx) {
                            if (typeof v === "number") {
                                const dc = XLSX.SSF.parse_date_code(v);
                                const d = new Date(dc.y, dc.m - 1, dc.d);
                                obj["Date"] = toMonthStr(d);
                            } else {
                                obj["Date"] = toMonthStr(v);
                            }
                        } else {
                            obj[h] = (v === null || v === undefined || v === "") ? null : Number(v);
                        }
                    });
                    return obj;
                });

                setRows(normalized);

                // Initialize weights
                const cols = Object.keys(normalized[0] || {}).filter(k => k.toLowerCase() !== "date");
                const w: Record<string, number> = {};
                for (const c of cols) w[c] = 0;

                // Check for share param
                if (typeof window !== "undefined") {
                    const params = new URLSearchParams(window.location.search);
                    const shareData = params.get("share");
                    if (shareData) {
                        try {
                            const decoded = JSON.parse(atob(shareData));
                            Object.keys(decoded).forEach(k => {
                                // Simple case-insensitive match or exact match depending on data quality
                                // The keys in w are exactly from the excel header.
                                if (Object.prototype.hasOwnProperty.call(w, k)) {
                                    w[k] = Number(decoded[k]);
                                }
                            });
                            // toast.success("Shared portfolio loaded!"); // Cannot use toast here easily without extra deps or duplicate import
                        } catch (e) {
                            console.error("Invalid share data", e);
                        }
                    }
                }

                setWeights(w);

            } catch (error) {
                console.error("Error loading data:", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, []);

    // Load saved portfolios from local storage and check for share_all
    useEffect(() => {
        let loaded: SavedPortfolio[] = [];
        const saved = localStorage.getItem("alphatrace_portfolios");
        if (saved) {
            try {
                loaded = JSON.parse(saved);
            } catch (e) {
                console.error("Failed to parse saved portfolios", e);
            }
        }

        // Check for share_all param
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const shareAllData = params.get("share_all");

            if (shareAllData) {
                try {
                    const normalizeWeights = (weights: Record<string, number>) =>
                        Object.entries(weights || {})
                            .map(([k, v]) => [k, Number(v)] as [string, number])
                            .filter(([, v]) => !Number.isNaN(v) && Math.abs(v) > 1e-6)
                            .sort((a, b) => a[0].localeCompare(b[0]));

                    const weightsEqual = (a: Record<string, number>, b: Record<string, number>) => {
                        const na = normalizeWeights(a);
                        const nb = normalizeWeights(b);
                        if (na.length !== nb.length) return false;
                        return na.every(([asset, value], idx) => {
                            const [assetB, valueB] = nb[idx];
                            return asset === assetB && Math.abs(value - valueB) < 1e-6;
                        });
                    };

                    const isDuplicatePortfolio = (existing: SavedPortfolio, name: string, weights: Record<string, number>) =>
                        existing.name.trim().toLowerCase() === name.trim().toLowerCase() && weightsEqual(existing.weights, weights);

                    const getWeightSignature = (weights: Record<string, number>) =>
                        normalizeWeights(weights)
                            .map(([asset, value]) => `${asset}:${value.toFixed(6)}`)
                            .join("|");

                    const decoded = JSON.parse(atob(shareAllData));
                    if (Array.isArray(decoded)) {
                        const seenSignatures = new Set<string>();

                        const uniqueCandidates = decoded.reduce((acc: { name: string; weights: Record<string, number> }[], raw: any) => {
                            const candidateName = (raw?.n || "Imported Portfolio").toString().trim() || "Imported Portfolio";
                            const candidateWeights = typeof raw?.w === "object" && raw?.w !== null ? raw.w as Record<string, number> : {};
                            const signature = `${candidateName.toLowerCase()}|${getWeightSignature(candidateWeights)}`;

                            if (seenSignatures.has(signature)) return acc;
                            if (loaded.some(existing => isDuplicatePortfolio(existing, candidateName, candidateWeights))) return acc;

                            seenSignatures.add(signature);
                            acc.push({ name: candidateName, weights: candidateWeights });
                            return acc;
                        }, []);

                        if (uniqueCandidates.length > 0) {
                            const imported: SavedPortfolio[] = uniqueCandidates.map((candidate) => ({
                                id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36), // Unique ID
                                name: candidate.name,
                                weights: candidate.weights,
                                date: new Date().toISOString()
                            }));

                            loaded = [...loaded, ...imported];

                            // Update storage immediately
                            localStorage.setItem("alphatrace_portfolios", JSON.stringify(loaded));
                        }

                        // Optionally clear the query param
                        const newUrl = window.location.pathname;
                        window.history.replaceState({}, '', newUrl);
                    }
                } catch (e) {
                    console.error("Invalid share_all data", e);
                }
            }
        }

        setSavedPortfolios(loaded);
    }, []);

    // Columns & Sorting
    const columns = useMemo(() => {
        if (!rows.length) return [];
        const rawCols = Object.keys(rows[0]).filter(k => k.toLowerCase() !== "date");
        const CATEGORY_ORDER = ["stocks", "bonds", "cash", "gold"];
        return rawCols.sort((a, b) => {
            const ca = getAssetCategory(a), cb = getAssetCategory(b);
            const ia = CATEGORY_ORDER.indexOf(ca), ib = CATEGORY_ORDER.indexOf(cb);
            if (ia !== ib) return ia - ib;
            return a.localeCompare(b);
        });
    }, [rows]);

    // Normalize Data
    const norm = useMemo(() => !rows.length ? null : normalizeAndInterpolate(rows, startDate), [rows, startDate]);

    // Compute Portfolio
    const portfolio = useMemo<PortfolioResult | null>(() => {
        if (!norm) return null;
        const { dates, series } = norm;
        const lastDate = endDate || dates[dates.length - 1];
        const i0 = dates.findIndex(d => d >= startDate);
        const i1 = dates.findIndex(d => d >= lastDate);
        const endIdx = i1 === -1 ? dates.length - 1 : i1;
        const adates = dates.slice(i0, endIdx + 1);
        const aseries: Record<string, (number | null)[]> = {};
        for (const c of Object.keys(series)) aseries[c] = series[c].slice(i0, endIdx + 1);

        if (investmentMode === "recurring") {
            return computeRecurringPortfolio(adates, aseries, weights, rebalance, monthlyInvestment);
        } else if (investmentMode === "hybrid") {
            return computeHybridPortfolio(adates, aseries, weights, rebalance, initialInvestment, monthlyInvestment);
        } else {
            return computePortfolio(adates, aseries, weights, rebalance, initialInvestment);
        }
    }, [norm, weights, investmentMode, initialInvestment, monthlyInvestment, rebalance, endDate, startDate]);

    const handleWeightChange = (asset: string, value: number) => {
        setWeights(prev => ({ ...prev, [asset]: value }));
    };

    const setRiskFreeRate = (rate: number) => {
        if (rate >= 0 && rate <= 1) {
            setRiskFreeRateState(rate);
            localStorage.setItem("alphatrace_risk_free_rate", rate.toString());
        }
    };

    const savePortfolio = (name: string) => {
        const trimmed = (name || "").trim();
        if (!trimmed) return;

        const now = new Date().toISOString();

        if (activePortfolioId && savedPortfolios.some(p => p.id === activePortfolioId)) {
            const updated = savedPortfolios.map(p =>
                p.id === activePortfolioId
                    ? { ...p, name: trimmed, weights: { ...weights }, date: now }
                    : p
            );
            setSavedPortfolios(updated);
            localStorage.setItem("alphatrace_portfolios", JSON.stringify(updated));
            setActivePortfolioName(trimmed);
            return;
        }

        const newPortfolio: SavedPortfolio = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: trimmed,
            weights: { ...weights },
            date: now
        };
        const updated = [...savedPortfolios, newPortfolio];
        setSavedPortfolios(updated);
        localStorage.setItem("alphatrace_portfolios", JSON.stringify(updated));
        setActivePortfolioId(newPortfolio.id);
        setActivePortfolioName(newPortfolio.name);
    };

    const deletePortfolio = (id: string) => {
        const updated = savedPortfolios.filter(p => p.id !== id);
        setSavedPortfolios(updated);
        localStorage.setItem("alphatrace_portfolios", JSON.stringify(updated));

        if (activePortfolioId === id) {
            setActivePortfolioId(null);
            setActivePortfolioName(null);
        }
    };

    const loadPortfolio = (id: string) => {
        const p = savedPortfolios.find(p => p.id === id);
        if (p) {
            setWeights(p.weights);
            setActivePortfolioId(p.id);
            setActivePortfolioName(p.name);
        }
    };

    const duplicatePortfolio = (id: string) => {
        const p = savedPortfolios.find(p => p.id === id);
        if (!p) return;

        const base = `${p.name} Copy`;
        let candidate = base;
        let i = 2;
        while (savedPortfolios.some(sp => sp.name.trim().toLowerCase() === candidate.trim().toLowerCase())) {
            candidate = `${base} ${i}`;
            i++;
        }

        const now = new Date().toISOString();
        const clone: SavedPortfolio = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: candidate,
            weights: { ...p.weights },
            date: now,
        };

        const updated = [...savedPortfolios, clone];
        setSavedPortfolios(updated);
        localStorage.setItem("alphatrace_portfolios", JSON.stringify(updated));
    };

    useEffect(() => {
        if (didAutoLoadDefault) return;
        if (hasInitialShareParams) return;
        if (activePortfolioId) return;
        if (!savedPortfolios.length) return;

        const sumWeights = Object.values(weights || {}).reduce((a, b) => a + (b ?? 0), 0);
        if (sumWeights !== 0) return;

        const p = savedPortfolios[0];
        if (!p) return;
        setWeights(p.weights);
        setActivePortfolioId(p.id);
        setActivePortfolioName(p.name);
        setDidAutoLoadDefault(true);
    }, [didAutoLoadDefault, hasInitialShareParams, activePortfolioId, savedPortfolios, weights]);

    const computeAssetPortfolio = (asset: string) => {
        if (!norm) return null;
        const { dates, series } = norm;
        if (!series[asset]) return null;

        const lastDate = endDate || dates[dates.length - 1];
        const i0 = dates.findIndex(d => d >= startDate);
        const i1 = dates.findIndex(d => d >= lastDate);
        const endIdx = i1 === -1 ? dates.length - 1 : i1;
        const adates = dates.slice(i0, endIdx + 1);

        // Construct single asset series
        const aseries: Record<string, (number | null)[]> = {
            [asset]: series[asset].slice(i0, endIdx + 1)
        };
        const singleWeight = { [asset]: 1 };

        if (investmentMode === "recurring") {
            return computeRecurringPortfolio(adates, aseries, singleWeight, rebalance, monthlyInvestment);
        } else if (investmentMode === "hybrid") {
            return computeHybridPortfolio(adates, aseries, singleWeight, rebalance, initialInvestment, monthlyInvestment);
        } else {
            return computePortfolio(adates, aseries, singleWeight, rebalance, initialInvestment);
        }
    };

    const computeCustomPortfolio = (customWeights: Record<string, number>) => {
        if (!norm) return null;
        const { dates, series } = norm;

        const lastDate = endDate || dates[dates.length - 1];
        const i0 = dates.findIndex(d => d >= startDate);
        const i1 = dates.findIndex(d => d >= lastDate);
        const endIdx = i1 === -1 ? dates.length - 1 : i1;
        const adates = dates.slice(i0, endIdx + 1);

        const aseries: Record<string, (number | null)[]> = {};
        for (const c of Object.keys(series)) aseries[c] = series[c].slice(i0, endIdx + 1);

        if (investmentMode === "recurring") {
            return computeRecurringPortfolio(adates, aseries, customWeights, rebalance, monthlyInvestment);
        } else if (investmentMode === "hybrid") {
            return computeHybridPortfolio(adates, aseries, customWeights, rebalance, initialInvestment, monthlyInvestment);
        } else {
            return computePortfolio(adates, aseries, customWeights, rebalance, initialInvestment);
        }
    };

    return (
        <PortfolioContext.Provider value={{
            rows,
            isLoading,
            columns,
            weights,
            setWeights,
            handleWeightChange,
            startDate,
            setStartDate,
            endDate,
            setEndDate,
            investmentMode,
            setInvestmentMode,
            initialInvestment,
            setInitialInvestment,
            monthlyInvestment,
            setMonthlyInvestment,
            rebalance,
            setRebalance,
            riskFreeRate,
            setRiskFreeRate,
            portfolio,
            // Saved Portfolios
            savedPortfolios,
            activePortfolioId,
            activePortfolioName,
            savePortfolio,
            deletePortfolio,
            loadPortfolio,
            duplicatePortfolio,
            computeAssetPortfolio,
            computeCustomPortfolio,
            norm
        }}>
            {children}
        </PortfolioContext.Provider>
    );
}

export function usePortfolio() {
    const context = useContext(PortfolioContext);
    if (context === undefined) {
        throw new Error("usePortfolio must be used within a PortfolioProvider");
    }
    return context;
}
