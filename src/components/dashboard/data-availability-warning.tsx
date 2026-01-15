"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface DataAvailabilityWarningProps {
    backfilledAssets: { asset: string; actualStartDate: string }[];
}

export function DataAvailabilityWarning({ backfilledAssets }: DataAvailabilityWarningProps) {
    if (!backfilledAssets.length) return null;

    return (
        <Alert variant="default" className="mb-4 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
            <AlertDescription className="text-sm text-amber-800 dark:text-amber-300">
                <span className="font-semibold">Note:</span> Some assets have limited historical data.{" "}
                {backfilledAssets.length === 1 ? (
                    <>
                        <strong>{backfilledAssets[0].asset}</strong> data starts on{" "}
                        <strong>{new Date(backfilledAssets[0].actualStartDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}</strong>.
                        Earlier values are estimated.
                    </>
                ) : (
                    <>
                        Earlier values are estimated for:{" "}
                        {backfilledAssets.map((item, idx) => (
                            <span key={item.asset}>
                                <strong>{item.asset}</strong> (from{" "}
                                {new Date(item.actualStartDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })})
                                {idx < backfilledAssets.length - 1 ? ", " : ""}
                            </span>
                        ))}
                    </>
                )}
            </AlertDescription>
        </Alert>
    );
}
