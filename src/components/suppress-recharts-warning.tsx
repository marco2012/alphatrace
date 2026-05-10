"use client";

import { useEffect } from "react";

// Recharts ResponsiveContainer fires a console.warn with width/height -1
// during its own initialization before its internal ResizeObserver fires.
// Charts render correctly immediately after, so this warning is a false positive.
export function SuppressRechartsWarning() {
    useEffect(() => {
        const original = console.warn;
        console.warn = (...args: any[]) => {
            if (typeof args[0] === "string" && args[0].includes("width(-1) and height(-1)")) return;
            original.apply(console, args);
        };
        return () => { console.warn = original; };
    }, []);
    return null;
}
