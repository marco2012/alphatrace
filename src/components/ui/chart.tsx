"use client"

import * as React from "react"
import {
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts"

import { cn } from "@/lib/utils"

export type ChartConfig = Record<
  string,
  {
    label: string
    color?: string
  }
>

function getPayloadConfigEntry(
  config: ChartConfig,
  payloadEntry: any,
  nameKey?: string
): { label: string; color?: string } | null {
  const key = nameKey ? payloadEntry?.payload?.[nameKey] : payloadEntry?.name
  if (key && config[key]) return config[key]
  return null
}

export function ChartContainer({
  config,
  className,
  children,
}: {
  config: ChartConfig
  className?: string
  children: React.ReactNode
}) {
  const styleVars = React.useMemo(() => {
    const vars: Record<string, string> = {}
    for (const [key, entry] of Object.entries(config)) {
      if (!entry?.color) continue
      vars[`--color-${key}`] = entry.color
    }
    return vars as React.CSSProperties
  }, [config])

  return (
    <div
      className={cn("w-full", className)}
      style={styleVars}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children as any}
      </ResponsiveContainer>
    </div>
  )
}

export function ChartTooltip(props: React.ComponentProps<typeof RechartsTooltip>) {
  return <RechartsTooltip {...props} />
}

type ChartTooltipContentProps = {
  active?: boolean
  payload?: any[]
  label?: any
  nameKey?: string
  hideLabel?: boolean
  config?: ChartConfig
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  nameKey,
  hideLabel,
  config,
}: ChartTooltipContentProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      {!hideLabel && label != null && (
        <div className="mb-1 font-medium text-foreground">{String(label)}</div>
      )}
      <div className="space-y-1">
        {payload.map((entry: any, idx: number) => {
          const cfg = config ? getPayloadConfigEntry(config, entry, nameKey) : null
          const labelText = cfg?.label ?? String(entry.name)
          const color = cfg?.color ?? entry.color
          const value = entry.value

          return (
            <div key={idx} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-[2px]"
                  style={{ backgroundColor: color }}
                />
                <span className="text-muted-foreground">{labelText}</span>
              </div>
              <span className="font-medium text-foreground">
                {typeof value === "number" ? value.toFixed(1) : String(value)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
