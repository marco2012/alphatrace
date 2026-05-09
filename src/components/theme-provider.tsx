"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// next-themes injects a <script> for FOUC prevention; React 19 warns about script
// elements in the render tree in dev mode. Suppress this specific dev-only warning.
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    const _origError = console.error.bind(console)
    console.error = (...args: unknown[]) => {
        if (typeof args[0] === "string" && args[0].includes("Encountered a script tag while rendering")) return
        _origError(...args)
    }
}

export function ThemeProvider({
    children,
    ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
    return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
