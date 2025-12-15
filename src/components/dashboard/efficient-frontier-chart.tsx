"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
    CartesianGrid,
    Legend,
    ReferenceArea,
    ResponsiveContainer,
    Scatter,
    ScatterChart,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Download, Search, ZoomIn, ZoomOut, Move, MousePointer2 } from "lucide-react";
import { NormalizedData, getAssetCategory, pctChangeSeries } from "@/lib/finance";

type FrontierPoint = {
    vol: number;
    ret: number;
    sharpe: number;
    weights: Record<string, number>;
    composition: Record<string, number>;
    label: string;
};

type EfficientFrontierChartProps = {
    norm: NormalizedData | null;
    weights: Record<string, number>;
    startDate: string;
    endDate: string;
    rf?: number;
};

function mean(xs: number[]) {
    if (!xs.length) return 0;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function covariance(a: number[], b: number[], ma: number, mb: number) {
    const n = Math.min(a.length, b.length);
    if (n <= 1) return 0;
    let s = 0;
    for (let i = 0; i < n; i++) s += (a[i] - ma) * (b[i] - mb);
    return s / (n - 1);
}

function portfolioStats(weights: number[], means: number[], cov: number[][]) {
    let mu = 0;
    for (let i = 0; i < weights.length; i++) mu += weights[i] * means[i];

    let v = 0;
    for (let i = 0; i < weights.length; i++) {
        for (let j = 0; j < weights.length; j++) {
            v += weights[i] * weights[j] * cov[i][j];
        }
    }

    const annualReturn = Math.pow(1 + mu, 12) - 1;
    const annualVol = Math.sqrt(Math.max(v, 0) * 12);

    return { annualReturn, annualVol };
}

export function EfficientFrontierChart({ norm, weights, startDate, endDate, rf = 0.02 }: EfficientFrontierChartProps) {
    const [points, setPoints] = useState<FrontierPoint[]>([]);
    const [frontier, setFrontier] = useState<FrontierPoint[]>([]);
    const [highlights, setHighlights] = useState<FrontierPoint[]>([]);
    const [currentPoint, setCurrentPoint] = useState<FrontierPoint | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Zoom state
    const [zoomDomain, setZoomDomain] = useState<{
        x: [number | "dataMin", number | "dataMax"];
        y: [number | "dataMin", number | "dataMax"];
    } | null>(null);
    const [refAreaLeft, setRefAreaLeft] = useState<number | string>("");
    const [refAreaRight, setRefAreaRight] = useState<number | string>("");
    const [refAreaBottom, setRefAreaBottom] = useState<number | string>("");
    const [refAreaTop, setRefAreaTop] = useState<number | string>("");
    const [interactionMode, setInteractionMode] = useState<"zoom" | "pan">("zoom");
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const panStartRef = useRef<{ x: number; y: number; xDomain: [number, number]; yDomain: [number, number] } | null>(null);
    const [isPanning, setIsPanning] = useState(false);

    const [constraintsError, setConstraintsError] = useState<string | null>(null);

    useEffect(() => {
        setPoints([]);
        setFrontier([]);
        setHighlights([]);
        setCurrentPoint(null);
        setZoomDomain(null);
        setRefAreaLeft("");
        setRefAreaRight("");
        setRefAreaBottom("");
        setRefAreaTop("");
    }, [norm, weights, startDate, endDate, rf]);

    const { activeAssets, assetCount, canCompute } = useMemo(() => {
        if (!norm) return { activeAssets: [] as string[], assetCount: 0, canCompute: false };
        const activeAssets = Object.entries(weights)
            .filter(([, w]) => (w ?? 0) > 0)
            .map(([k]) => k)
            .filter((k) => norm.series[k] != null);
        const assetCount = activeAssets.length;
        return { activeAssets, assetCount, canCompute: assetCount >= 2 };
    }, [norm, weights]);

    const activeCategories = useMemo(() => {
        const CATEGORY_ORDER = ["stocks", "bonds", "cash", "gold", "other"];
        const s = new Set<string>();
        for (const a of activeAssets) s.add(getAssetCategory(a) || "other");
        return Array.from(s).sort((a, b) => {
            const ia = CATEGORY_ORDER.indexOf(a);
            const ib = CATEGORY_ORDER.indexOf(b);
            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        });
    }, [activeAssets]);



    const compute = async () => {
        if (!norm || activeAssets.length < 2) return;

        setIsLoading(true);

        try {
            setConstraintsError(null);

            const dates = norm.dates;
            const lastDate = endDate || dates[dates.length - 1];
            const i0 = dates.findIndex((d) => d >= startDate);
            const i1 = dates.findIndex((d) => d >= lastDate);
            const endIdx = i1 === -1 ? dates.length - 1 : i1;

            const slicedSeries = activeAssets.map((a) => (norm.series[a] as number[]).slice(i0, endIdx + 1));
            const rets = slicedSeries.map((s) => pctChangeSeries(s));
            const n = rets[0]?.length || 0;
            if (n < 12) return;

            const means = rets.map((r) => mean(r));
            const cov = rets.map((ri, i) => rets.map((rj, j) => covariance(ri, rj, means[i], means[j])));

            const buildComposition = (wVec: number[]) => {
                const comp: Record<string, number> = {};
                for (let i = 0; i < activeAssets.length; i++) {
                    const cat = getAssetCategory(activeAssets[i]) || "stocks";
                    comp[cat] = (comp[cat] || 0) + (wVec[i] || 0);
                }
                return comp;
            };

            const buildWeightsMap = (wVec: number[]) => {
                const out: Record<string, number> = {};
                for (let i = 0; i < activeAssets.length; i++) out[activeAssets[i]] = wVec[i] || 0;
                return out;
            };

            const statsToPoint = (label: string, wVec: number[]) => {
                const st = portfolioStats(wVec, means, cov);
                const vol = st.annualVol;
                const ret = st.annualReturn;
                const sharpe = vol > 0 ? (ret - rf) / vol : 0;
                return {
                    label,
                    vol: vol * 100,
                    ret: ret * 100,
                    sharpe,
                    weights: buildWeightsMap(wVec),
                    composition: buildComposition(wVec),
                };
            };

            const wRaw = activeAssets.map((a) => weights[a] ?? 0);
            const wSum = wRaw.reduce((a, b) => a + b, 0) || 1;
            const wCur = wRaw.map((w) => w / wSum);
            const curPoint = statsToPoint("My Portfolio", wCur);
            setCurrentPoint(curPoint);

            const SIMULATION_COUNT = 10000; // High count for accurate frontier/stats
            const DISPLAY_LIMIT = 1200;     // Lower count for rendering performance (SVG lag)
            const allSims: FrontierPoint[] = [];

            // 1. Add Corner Portfolios (100% in each asset)
            for (let i = 0; i < activeAssets.length; i++) {
                const wCorner = new Array(activeAssets.length).fill(0);
                wCorner[i] = 1;
                allSims.push(statsToPoint("Asset " + activeAssets[i], wCorner));
            }

            // 2. Generate random portfolios
            for (let i = 0; i < SIMULATION_COUNT; i++) {
                const rands = new Array(activeAssets.length).fill(0).map(() => Math.random());
                const s = rands.reduce((a, b) => a + b, 0) || 1;
                const w = rands.map((x) => x / s);
                allSims.push(statsToPoint("Simulated", w));
            }

            if (!allSims.length) {
                setConstraintsError("Could not generate portfolios.");
                setPoints([]);
                setFrontier([]);
                setHighlights([]);
                return;
            }

            // Compute Frontier and Best Points using ALL simulations for accuracy
            const sorted = [...allSims].sort((a, b) => a.vol - b.vol);
            const fr: FrontierPoint[] = [];
            let best = -Infinity;
            for (const p of sorted) {
                if (p.ret > best) {
                    fr.push(p);
                    best = p.ret;
                }
            }

            const bestCagr = allSims.reduce((best, p) => (p.ret > best.ret ? p : best), allSims[0]);
            const bestSharpe = allSims.reduce((best, p) => (p.sharpe > best.sharpe ? p : best), allSims[0]);
            const minRisk = allSims.reduce((best, p) => (p.vol < best.vol ? p : best), allSims[0]);

            // Set state: Only render a subset of points to prevent SVG lag
            // We include corner portfolios (first N) + random sample
            const displayPoints = allSims.slice(0, Math.min(allSims.length, DISPLAY_LIMIT));

            setPoints(displayPoints);
            setFrontier(fr);
            setHighlights([
                { ...bestCagr, label: "Highest CAGR" },
                { ...bestSharpe, label: "Highest Sharpe" },
                { ...minRisk, label: "Lowest Risk" },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!canCompute) return;
        if (!norm) return;
        if (!currentPoint && points.length === 0) return;

        const t = window.setTimeout(() => {
            void compute();
        }, 350);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canCompute, norm]);

    const downloadCSV = () => {
        const csv = [
            ["Label", "Volatility (%)", "CAGR/Return (%)", "Sharpe"],
            ...points.map((p) => [p.label, p.vol.toFixed(4), p.ret.toFixed(4), p.sharpe.toFixed(6)]),
        ]
            .map((row) => row.join(","))
            .join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "efficient-frontier.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const handleZoom = () => {
        if (refAreaLeft === refAreaRight || refAreaBottom === refAreaTop) {
            setRefAreaLeft("");
            setRefAreaRight("");
            setRefAreaBottom("");
            setRefAreaTop("");
            return;
        }

        const left = Number(refAreaLeft);
        const right = Number(refAreaRight);
        const bottom = Number(refAreaBottom);
        const top = Number(refAreaTop);

        if (isNaN(left) || isNaN(right) || isNaN(bottom) || isNaN(top)) {
            setRefAreaLeft("");
            setRefAreaRight("");
            setRefAreaBottom("");
            setRefAreaTop("");
            return;
        }

        let minX = Math.min(left, right);
        let maxX = Math.max(left, right);
        let minY = Math.min(bottom, top);
        let maxY = Math.max(bottom, top);

        // Add a small buffer just in case
        setZoomDomain({ x: [minX, maxX], y: [minY, maxY] });
        setRefAreaLeft("");
        setRefAreaRight("");
        setRefAreaBottom("");
        setRefAreaTop("");
    };

    const getValues = () => {
        // Calculate data bounds if we need them
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        if (points.length) {
            points.forEach(p => {
                if (p.vol < minX) minX = p.vol;
                if (p.vol > maxX) maxX = p.vol;
                if (p.ret < minY) minY = p.ret;
                if (p.ret > maxY) maxY = p.ret;
            });
        }
        // Add padding
        const paddingX = (maxX - minX) * 0.1 || 1;
        const paddingY = (maxY - minY) * 0.1 || 1;
        return {
            dataMinX: minX - paddingX,
            dataMaxX: maxX + paddingX,
            dataMinY: minY - paddingY,
            dataMaxY: maxY + paddingY
        };
    };

    const handleResetZoom = () => {
        setZoomDomain(null);
    };

    const handleZoomIn = () => {
        const { dataMinX, dataMaxX, dataMinY, dataMaxY } = getValues();

        let x1 = zoomDomain ? (zoomDomain.x[0] !== "dataMin" ? Number(zoomDomain.x[0]) : dataMinX) : dataMinX;
        let x2 = zoomDomain ? (zoomDomain.x[1] !== "dataMax" ? Number(zoomDomain.x[1]) : dataMaxX) : dataMaxX;
        let y1 = zoomDomain ? (zoomDomain.y[0] !== "dataMin" ? Number(zoomDomain.y[0]) : dataMinY) : dataMinY;
        let y2 = zoomDomain ? (zoomDomain.y[1] !== "dataMax" ? Number(zoomDomain.y[1]) : dataMaxY) : dataMaxY;

        // Zoom factor 0.8 (20% closer)
        const factor = 0.8;
        const width = x2 - x1;
        const height = y2 - y1;

        const cx = x1 + width / 2;
        const cy = y1 + height / 2;

        const newWidth = width * factor;
        const newHeight = height * factor;

        setZoomDomain({
            x: [cx - newWidth / 2, cx + newWidth / 2],
            y: [cy - newHeight / 2, cy + newHeight / 2]
        });
    };

    const handleZoomOutStep = () => {
        const { dataMinX, dataMaxX, dataMinY, dataMaxY } = getValues();

        if (!zoomDomain) return; // Already fully out

        let x1 = zoomDomain.x[0] !== "dataMin" ? Number(zoomDomain.x[0]) : dataMinX;
        let x2 = zoomDomain.x[1] !== "dataMax" ? Number(zoomDomain.x[1]) : dataMaxX;
        let y1 = zoomDomain.y[0] !== "dataMin" ? Number(zoomDomain.y[0]) : dataMinY;
        let y2 = zoomDomain.y[1] !== "dataMax" ? Number(zoomDomain.y[1]) : dataMaxY;

        // Zoom factor 1.25 (inverse of 0.8)
        const factor = 1.25;
        const width = x2 - x1;
        const height = y2 - y1;

        const cx = x1 + width / 2;
        const cy = y1 + height / 2;

        const newWidth = width * factor;
        const newHeight = height * factor;

        // If we exceed data bounds significantly, nice to verify, but simple calc is fine.
        // We can just rely on auto domain if we are close to bounds, but simpler to just set coordinates.
        // If the new domain is wider than data bounds, we could reset, but let's just zoom out freely or clamp?
        // Clamping to data bounds gives a "Reset" feel when hitting the edge.

        let nx1 = cx - newWidth / 2;
        let nx2 = cx + newWidth / 2;
        let ny1 = cy - newHeight / 2;
        let ny2 = cy + newHeight / 2;

        // Simple clamp check: if we are encompassing the data, reset to null (auto) to be clean
        if (nx1 <= dataMinX && nx2 >= dataMaxX && ny1 <= dataMinY && ny2 >= dataMaxY) {
            setZoomDomain(null);
        } else {
            setZoomDomain({
                x: [nx1, nx2],
                y: [ny1, ny2]
            });
        }
    };

    const handlePanStart = (e: any) => {
        if (interactionMode !== "pan" || !e) return;

        // If zoomDomain is null, set it to current data bounds so we can pan
        let currentXDomain = zoomDomain?.x;
        let currentYDomain = zoomDomain?.y;

        if (!currentXDomain || !currentYDomain || currentXDomain[0] === "dataMin" || currentYDomain[0] === "dataMin") {
            const { dataMinX, dataMaxX, dataMinY, dataMaxY } = getValues();
            currentXDomain = [
                zoomDomain && zoomDomain.x[0] !== "dataMin" ? Number(zoomDomain.x[0]) : dataMinX,
                zoomDomain && zoomDomain.x[1] !== "dataMax" ? Number(zoomDomain.x[1]) : dataMaxX
            ];
            currentYDomain = [
                zoomDomain && zoomDomain.y[0] !== "dataMin" ? Number(zoomDomain.y[0]) : dataMinY,
                zoomDomain && zoomDomain.y[1] !== "dataMax" ? Number(zoomDomain.y[1]) : dataMaxY
            ];
            // Initialize domain state silently or just use these values for the pan start
            setZoomDomain({ x: currentXDomain as [number, number], y: currentYDomain as [number, number] });
        }

        panStartRef.current = {
            x: e.chartX,
            y: e.chartY,
            xDomain: [Number(currentXDomain[0]), Number(currentXDomain[1])],
            yDomain: [Number(currentYDomain[0]), Number(currentYDomain[1])]
        };
        setIsPanning(true);
    };

    const handlePanMove = (e: any) => {
        if (!isPanning || !panStartRef.current || !e || !chartContainerRef.current) return;

        const containerWidth = chartContainerRef.current.clientWidth;
        const containerHeight = chartContainerRef.current.clientHeight;

        // Approximate plot dimensions (container minus margins/axes)
        // Recharts margin supplied is { top: 20, right: 20, bottom: 20, left: 10 }
        // Axis widths approx: YAxis Left ~60px, XAxis Bottom ~30px.
        // Let's approximate plot area.
        const plotWidth = containerWidth - 80; // 60 left + 20 right
        const plotHeight = containerHeight - 60; // 20 top + 40 bottom

        const dxPixels = e.chartX - panStartRef.current.x;
        const dyPixels = e.chartY - panStartRef.current.y;

        const xDomainWidth = panStartRef.current.xDomain[1] - panStartRef.current.xDomain[0];
        const yDomainHeight = panStartRef.current.yDomain[1] - panStartRef.current.yDomain[0];

        const dxData = (dxPixels / plotWidth) * xDomainWidth;
        const dyData = (dyPixels / plotHeight) * yDomainHeight;

        // Panning direction: Drag Left (dx < 0) -> Move View Left (MinX Decreases)? 
        // No, dragging paper left moves view RIGHT (MinX Increases).
        // Wait. Drag Map Left -> Map moves Left. View moves Right over map.
        // Drag Point Left -> Point moves Left. 
        // We want "Grab the paper" feel.
        // If I grab point at X=10 and drag it LEFT to X=5 screen position.
        // The point X=10 should now be at the new screen pos.
        // Meaning the bounds shifted RIGHT.
        // So newMinX = oldMinX + delta? OR - delta?
        // Let's try: newMinX = startMinX - dxData.

        // Y Axis: Recharts pixels increase DOWN. Data increases UP.
        // Drag Down (dy > 0). Point moves down.
        // We want chart to move down.
        // So view moves UP (MinY increases).
        // dyData is positive. We want MinY to Increase.
        // So newMinY = startMinY + dyData.

        setZoomDomain({
            x: [panStartRef.current.xDomain[0] - dxData, panStartRef.current.xDomain[1] - dxData],
            y: [panStartRef.current.yDomain[0] + dyData, panStartRef.current.yDomain[1] + dyData]
        });
    };

    const handlePanEnd = () => {
        setIsPanning(false);
        panStartRef.current = null;
    };

    return (
        <Card className="col-span-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                    <CardTitle>Efficient Frontier</CardTitle>
                    <CardDescription>
                        Risk/return trade-off from simulated portfolios ({assetCount} assets).
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <div className="mr-2 flex items-center rounded-md border bg-muted/50 p-1">
                        <Button
                            variant={interactionMode === "zoom" ? "secondary" : "ghost"}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setInteractionMode("zoom")}
                            title="Zoom Selection Mode"
                        >
                            <MousePointer2 className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={interactionMode === "pan" ? "secondary" : "ghost"}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setInteractionMode("pan")}
                            title="Pan Mode"
                        >
                            <Move className="h-4 w-4" />
                        </Button>
                    </div>

                    <Button variant="outline" size="icon" onClick={handleZoomIn} disabled={points.length === 0} title="Zoom In (+)">
                        <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleZoomOutStep} disabled={!zoomDomain} title="Zoom Out (-)">
                        <ZoomOut className="h-4 w-4" />
                    </Button>
                    {zoomDomain && (
                        <Button variant="outline" size="sm" onClick={handleResetZoom} title="Reset Zoom">
                            Reset
                        </Button>
                    )}
                    <Button variant="outline" size="icon" onClick={downloadCSV} disabled={points.length === 0} title="Download CSV">
                        <Download className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pl-2">

                {constraintsError && (
                    <div className="mb-4 text-sm text-destructive">{constraintsError}</div>
                )}
                <div className="h-[450px] w-full select-none" ref={chartContainerRef}>
                    {points.length === 0 || !currentPoint ? (
                        <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
                            {isLoading ? (
                                <>
                                    <Spinner size="lg" />
                                    <div>Computing efficient frontier...</div>
                                </>
                            ) : (
                                <>
                                    <div>Click Compute to generate the efficient frontier.</div>
                                    <Button onClick={compute} disabled={!canCompute} size="lg">
                                        Compute
                                    </Button>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="relative h-full w-full">
                            {isLoading && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Spinner size="sm" />
                                        <span>Recomputing...</span>
                                    </div>
                                </div>
                            )}
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart
                                    onMouseDown={(e: any) => {
                                        if (interactionMode === "pan") {
                                            handlePanStart(e);
                                        } else {
                                            if (e && e.xValue !== undefined && e.yValue !== undefined) {
                                                setRefAreaLeft(e.xValue);
                                                setRefAreaBottom(e.yValue);
                                            }
                                        }
                                    }}
                                    onMouseMove={(e: any) => {
                                        if (interactionMode === "pan") {
                                            handlePanMove(e);
                                        } else {
                                            if (refAreaLeft !== "") {
                                                if (e && e.xValue !== undefined && e.yValue !== undefined) {
                                                    setRefAreaRight(e.xValue);
                                                    setRefAreaTop(e.yValue);
                                                }
                                            }
                                        }
                                    }}
                                    onMouseUp={(e) => {
                                        if (interactionMode === "pan") {
                                            handlePanEnd();
                                        } else {
                                            handleZoom();
                                        }
                                    }}
                                    margin={{ top: 20, right: 20, bottom: 20, left: 10 }}
                                    style={{ cursor: interactionMode === "pan" ? (isPanning ? "grabbing" : "grab") : "crosshair" }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis
                                        type="number"
                                        dataKey="vol"
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                                        name="Volatility"
                                        label={{ value: "Risk (Annualized Volatility)", position: "insideBottom", offset: -10 }}
                                        domain={zoomDomain ? zoomDomain.x : ["auto", "auto"]}
                                        allowDataOverflow={true}
                                    />
                                    <YAxis
                                        type="number"
                                        dataKey="ret"
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                                        name="Return"
                                        label={{ value: "CAGR / Annual Return", angle: -90, position: "insideLeft", offset: 10 }}
                                        domain={zoomDomain ? zoomDomain.y : ["auto", "auto"]}
                                        allowDataOverflow={true}
                                    />
                                    <Tooltip
                                        cursor={{ strokeDasharray: '3 3' }}
                                        wrapperStyle={{ outline: 'none' }}
                                        content={({ active, payload }: any) => {
                                            if (!active || !payload?.length) return null;
                                            const p = payload[0]?.payload as FrontierPoint;
                                            if (!p) return null;
                                            // Colors
                                            let borderColor = "border-border";
                                            let bgColor = "bg-card";
                                            let titleColor = "text-foreground";

                                            if (p.label === "Highest CAGR") borderColor = "border-green-500";
                                            else if (p.label === "Highest Sharpe") borderColor = "border-purple-500";
                                            else if (p.label === "Lowest Risk") borderColor = "border-amber-500";
                                            else if (p.label === "My Portfolio") borderColor = "border-red-500";

                                            // Asset composition sorted by weight
                                            const compItems = Object.entries(p.composition || {})
                                                .filter(([, v]) => v > 0.01) // hide < 1%
                                                .sort((a, b) => b[1] - a[1]);

                                            return (
                                                <div className={`w-64 rounded-lg border-2 ${borderColor} bg-card shadow-xl overflow-hidden`}>
                                                    <div className="bg-muted px-3 py-2 border-b">
                                                        <div className={`font-bold ${titleColor}`}>{p.label}</div>
                                                    </div>
                                                    <div className="p-3 grid gap-2">
                                                        <div className="grid grid-cols-3 gap-2 text-center">
                                                            <div>
                                                                <div className="text-[10px] uppercase text-muted-foreground font-semibold">Return</div>
                                                                <div className="font-mono font-medium text-green-600">{p.ret.toFixed(2)}%</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] uppercase text-muted-foreground font-semibold">Risk</div>
                                                                <div className="font-mono font-medium text-red-500">{p.vol.toFixed(2)}%</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] uppercase text-muted-foreground font-semibold">Sharpe</div>
                                                                <div className="font-mono font-medium">{p.sharpe.toFixed(2)}</div>
                                                            </div>
                                                        </div>
                                                        {compItems.length > 0 && (
                                                            <div className="mt-1 space-y-1">
                                                                <div className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Top Holdings</div>
                                                                {compItems.slice(0, 5).map(([k, v]) => (
                                                                    <div key={k} className="flex justify-between text-xs">
                                                                        <span className="capitalize">{k}</span>
                                                                        <span className="font-mono text-muted-foreground">{(v * 100).toFixed(1)}%</span>
                                                                    </div>
                                                                ))}
                                                                {compItems.length > 5 && (
                                                                    <div className="text-[10px] text-muted-foreground italic">+ {compItems.length - 5} others</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    />
                                    <Legend verticalAlign="top" height={36} />
                                    <Scatter name="Simulated" data={points} fill="#94a3b8" />
                                    <Scatter name="Frontier" data={frontier} fill="#3b82f6" line />
                                    <Scatter
                                        name={`My Portfolio (${currentPoint.ret.toFixed(2)}%)`}
                                        data={[currentPoint]}
                                        fill="#ef4444"
                                        shape="star"
                                    />
                                    <Scatter
                                        name={(() => {
                                            const p = highlights.find((h) => h.label === "Highest CAGR");
                                            return p ? `Highest CAGR (${p.ret.toFixed(2)}%)` : "Highest CAGR";
                                        })()}
                                        data={highlights.filter((p) => p.label === "Highest CAGR")}
                                        fill="#22c55e"
                                        shape="triangle"
                                    />
                                    <Scatter
                                        name={(() => {
                                            const p = highlights.find((h) => h.label === "Highest Sharpe");
                                            return p ? `Highest Sharpe (${p.ret.toFixed(2)}%)` : "Highest Sharpe";
                                        })()}
                                        data={highlights.filter((p) => p.label === "Highest Sharpe")}
                                        fill="#a855f7"
                                        shape="cross"
                                    />
                                    <Scatter
                                        name={(() => {
                                            const p = highlights.find((h) => h.label === "Lowest Risk");
                                            return p ? `Lowest Risk (${p.ret.toFixed(2)}%)` : "Lowest Risk";
                                        })()}
                                        data={highlights.filter((p) => p.label === "Lowest Risk")}
                                        fill="#f59e0b"
                                        shape="diamond"
                                    />
                                    {refAreaLeft && refAreaRight ? (
                                        <ReferenceArea
                                            x1={refAreaLeft}
                                            x2={refAreaRight}
                                            y1={refAreaBottom}
                                            y2={refAreaTop}
                                            strokeOpacity={0.3}
                                            fill="#8884d8"
                                            fillOpacity={0.3}
                                        />
                                    ) : null}
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
