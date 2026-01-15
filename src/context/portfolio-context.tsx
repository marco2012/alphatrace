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
    buildMonthlyCPI,
    InvestmentMode,
    RebalancePeriod,
    YearSelection,
    PortfolioResult
} from "@/lib/finance";

interface PortfolioContextType {
    // Data
    rows: any[];
    isLoading: boolean;
    columns: string[];
    cpiMap: Record<string, number>;
    firstValidDates: Record<string, string>;

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

    // Year Selection
    yearSelection: YearSelection;
    setYearSelection: (y: YearSelection) => void;
    handleYearSelectionChange: (y: YearSelection) => void;

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
    duplicatePortfolio: (id: string) => SavedPortfolio | null;
    togglePortfolioHighlight: (id: string) => void;

    // Analysis
    computeAssetPortfolio: (asset: string) => PortfolioResult | null;
    computeCustomPortfolio: (customWeights: Record<string, number>) => PortfolioResult | null;
    createNewPortfolio: () => void;
    norm: any;
    resetPortfolioSelection: () => void;
    currency: "EUR" | "USD";
    setCurrency: (c: "EUR" | "USD") => void;
}

export interface SavedPortfolio {
    id: string;
    name: string;
    weights: Record<string, number>;
    date: string;
    highlighted?: boolean;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
    const [rows, setRows] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [weights, setWeights] = useState<Record<string, number>>({});
    const [startDate, setStartDate] = useState("1994-11-01");
    const [endDate, setEndDate] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [investmentMode, setInvestmentMode] = useState<InvestmentMode>("lump_sum");
    const [initialInvestment, setInitialInvestment] = useState(10000);
    const [monthlyInvestment, setMonthlyInvestment] = useState(1000);
    const [rebalance, setRebalance] = useState<RebalancePeriod>("Annual");
    const [yearSelection, setYearSelection] = useState<YearSelection>("MAX");
    const [riskFreeRate, setRiskFreeRateState] = useState(0.02);
    const [savedPortfolios, setSavedPortfolios] = useState<SavedPortfolio[]>([]);
    const [currency, setCurrencyState] = useState<"EUR" | "USD">("EUR");

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

    // Initialize with MAX years setting the appropriate start date
    useEffect(() => {
        if (yearSelection === "MAX") {
            const maxStartDate = calculateStartDate("MAX");
            if (startDate !== maxStartDate) {
                setStartDate(maxStartDate);
            }
        }
    }, []);

    // Load Data
    useEffect(() => {
        async function loadData() {
            try {
                let buffer: ArrayBuffer;

                // Use default file
                const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
                const response = await fetch(`${basePath}/alphatrace_data.xlsx`);
                if (!response.ok) throw new Error('Failed to fetch data');
                buffer = await response.arrayBuffer();

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

        const migrated = (loaded || []).map((p: any) => ({
            ...p,
            highlighted: Boolean(p?.highlighted),
        })) as SavedPortfolio[];

        if (JSON.stringify(loaded) !== JSON.stringify(migrated)) {
            localStorage.setItem("alphatrace_portfolios", JSON.stringify(migrated));
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

        setSavedPortfolios(migrated);
    }, []);

    // Columns & Sorting
    const columns = useMemo(() => {
        if (!rows.length) return [];
        const rawCols = Object.keys(rows[0]).filter(k => k.toLowerCase() !== "date");
        const filtered = rawCols.filter(c => c.endsWith(`(${currency})`));
        const CATEGORY_ORDER = ["stocks", "bonds", "cash", "gold"];
        return filtered.sort((a, b) => {
            const ca = getAssetCategory(a), cb = getAssetCategory(b);
            const ia = CATEGORY_ORDER.indexOf(ca), ib = CATEGORY_ORDER.indexOf(cb);
            if (ia !== ib) return ia - ib;
            return a.localeCompare(b);
        });
    }, [rows, currency]);

    // Normalize Data
    const norm = useMemo(() => !rows.length ? null : normalizeAndInterpolate(rows, startDate), [rows, startDate]);

    const cpiMap = useMemo(() => {
        if (!norm) return {};
        return buildMonthlyCPI(norm.dates, currency);
    }, [norm, currency]);

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

    const setCurrency = (newCurrency: "EUR" | "USD") => {
        if (newCurrency === currency) return;

        // Migrate weights
        const newWeights: Record<string, number> = {};
        const oldSuffix = `(${currency})`;
        const newSuffix = `(${newCurrency})`;

        Object.entries(weights).forEach(([asset, weight]) => {
            if (weight === 0) return;
            const baseName = asset.replace(oldSuffix, "").trim();
            // Find the corresponding asset in the new currency
            const matchingAsset = Object.keys(rows[0] || {}).find(k =>
                k.startsWith(baseName) && k.endsWith(newSuffix)
            );
            if (matchingAsset) {
                newWeights[matchingAsset] = weight;
            }
        });

        // Fill remaining assets with 0
        Object.keys(rows[0] || {}).forEach(k => {
            if (k.toLowerCase() !== "date" && k.endsWith(newSuffix) && !newWeights[k]) {
                newWeights[k] = 0;
            }
        });

        setWeights(newWeights);
        setCurrencyState(newCurrency);
    };

    // Calculate start date based on year selection
    const calculateStartDate = (years: YearSelection): string => {
        const now = new Date();
        if (years === "MAX") return "1994-11-01";
        if (years === "dotcom_crash") return "2000-02-01";
        if (years === "financial_crisis") return "2008-08-01";
        if (years === "covid_crash") return "2020-01-01";
        if (years === "2000s") return "2000-02-01";

        if (typeof years === "number") {
            const yearsBack = now.getFullYear() - years;
            const resultDate = new Date(yearsBack, now.getMonth(), 1);

            // Ensure start date is not earlier than available data (1994-11-01)
            const minDate = new Date("1994-11-01");
            if (resultDate < minDate) {
                return "1994-11-01";
            }
            return toMonthStr(resultDate);
        }

        return "1994-11-01";
    };


    // Update start date when year selection changes
    const handleYearSelectionChange = (years: YearSelection) => {
        setYearSelection(years);
        const newStartDate = calculateStartDate(years);
        setStartDate(newStartDate);

        // Determine end date
        const now = new Date();
        const currentMaxDate = toMonthStr(new Date(now.getFullYear(), now.getMonth(), 1));

        let newEndDate = currentMaxDate;

        if (years === "dotcom_crash") newEndDate = "2003-03-01";
        else if (years === "financial_crisis") newEndDate = "2009-03-01";
        else if (years === "covid_crash") newEndDate = "2020-03-01";
        else if (years === "2000s") newEndDate = "2009-03-01";

        setEndDate(newEndDate);
    };

    // Validate and update end date to ensure it's within available data range
    const validateAndUpdateEndDate = () => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // End date should not be later than current month
        const maxEndDate = toMonthStr(new Date(currentYear, currentMonth, 1));

        // Also ensure end date is not earlier than start date
        const minEndDate = startDate;

        if (endDate > maxEndDate) {
            setEndDate(maxEndDate);
        } else if (endDate < minEndDate) {
            setEndDate(maxEndDate); // Default to max if end date is too early
        }
    };

    // Validate dates when they change to ensure they're within available data range
    useEffect(() => {
        validateAndUpdateEndDate();
    }, [startDate]);

    const savePortfolio = (name: string) => {
        const trimmed = (name || "").trim();
        if (!trimmed) return;

        const now = new Date().toISOString();

        if (activePortfolioId && savedPortfolios.some(p => p.id === activePortfolioId)) {
            const updated = savedPortfolios.map(p =>
                p.id === activePortfolioId
                    ? { ...p, name: trimmed, weights: { ...weights }, date: now, highlighted: Boolean(p.highlighted) }
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
            date: now,
            highlighted: false,
        };
        const updated = [...savedPortfolios, newPortfolio];
        setSavedPortfolios(updated);
        localStorage.setItem("alphatrace_portfolios", JSON.stringify(updated));
        setActivePortfolioId(newPortfolio.id);
        setActivePortfolioName(newPortfolio.name);
    };

    const togglePortfolioHighlight = (id: string) => {
        const updated = savedPortfolios.map(p =>
            p.id === id ? { ...p, highlighted: !Boolean(p.highlighted) } : p
        );
        setSavedPortfolios(updated);
        localStorage.setItem("alphatrace_portfolios", JSON.stringify(updated));
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
            // Detect currency from weights
            const assets = Object.keys(p.weights).filter(k => p.weights[k] > 0);
            if (assets.length > 0) {
                const firstAsset = assets[0];
                if (firstAsset.endsWith("(USD)")) {
                    setCurrencyState("USD");
                } else if (firstAsset.endsWith("(EUR)")) {
                    setCurrencyState("EUR");
                }
            }
            setWeights(p.weights);
            setActivePortfolioId(p.id);
            setActivePortfolioName(p.name);
        }
    };

    const duplicatePortfolio = (id: string) => {
        const p = savedPortfolios.find(p => p.id === id);
        if (!p) return null;

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
            highlighted: false,
        };

        const updated = [...savedPortfolios, clone];
        setSavedPortfolios(updated);
        localStorage.setItem("alphatrace_portfolios", JSON.stringify(updated));

        // Load the duplicated portfolio
        setWeights(clone.weights);
        setActivePortfolioId(clone.id);
        setActivePortfolioName(clone.name);

        return clone;
    };

    useEffect(() => {
        if (didAutoLoadDefault) return;
        if (hasInitialShareParams) return;
        if (activePortfolioId) return;
        if (!savedPortfolios.length) return;

        if (isLoading) return;
        if (!rows.length) return;
        if (Object.keys(weights || {}).length === 0) return;

        const p = savedPortfolios[0];
        if (!p) return;
        setWeights(p.weights);
        setActivePortfolioId(p.id);
        setActivePortfolioName(p.name);
        setDidAutoLoadDefault(true);
    }, [didAutoLoadDefault, hasInitialShareParams, activePortfolioId, savedPortfolios, isLoading, rows.length, weights]);

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
            cpiMap,
            firstValidDates: norm?.firstValidDates || {},
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
            yearSelection,
            setYearSelection,
            handleYearSelectionChange,
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
            togglePortfolioHighlight,
            computeAssetPortfolio,
            computeCustomPortfolio,
            createNewPortfolio: () => {
                const now = new Date().toISOString();
                const zeroWeights: Record<string, number> = {};
                // Use current weights keys to ensure we have all assets
                Object.keys(weights).forEach(k => zeroWeights[k] = 0);

                const newPortfolio: SavedPortfolio = {
                    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    name: "Untitled",
                    weights: zeroWeights,
                    date: now,
                    highlighted: false,
                };

                const updated = [...savedPortfolios, newPortfolio];
                setSavedPortfolios(updated);
                localStorage.setItem("alphatrace_portfolios", JSON.stringify(updated));

                setWeights(zeroWeights);
                setActivePortfolioId(newPortfolio.id);
                setActivePortfolioName(newPortfolio.name);
            },
            norm,
            resetPortfolioSelection: () => {
                setActivePortfolioId(null);
                setActivePortfolioName(null);
            },
            currency,
            setCurrency
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
