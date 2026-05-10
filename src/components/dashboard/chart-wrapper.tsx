"use client";

import { useLayoutEffect, useRef, useState } from "react";

interface ChartWrapperProps {
    className?: string;
    children: React.ReactNode;
}

// Defers rendering until the container has been laid out by the browser.
// Prevents Recharts v3 from logging width/height -1 on initial render.
export function ChartWrapper({ className, children }: ChartWrapperProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (el.getBoundingClientRect().width > 0) {
            setReady(true);
            return;
        }
        const obs = new ResizeObserver(entries => {
            if (entries[0]?.contentRect.width > 0) {
                setReady(true);
                obs.disconnect();
            }
        });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    return (
        <div ref={ref} className={className}>
            {ready && children}
        </div>
    );
}
