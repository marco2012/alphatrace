"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MonthPicker } from "@/components/ui/month-picker"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface MonthPickerInputProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
}

export function MonthPickerInput({ value, onChange, placeholder = "Pick a month", className }: MonthPickerInputProps) {
  const [date, setDate] = React.useState<Date | undefined>(() => 
    value ? new Date(value) : undefined
  )

  React.useEffect(() => {
    setDate(value ? new Date(value) : undefined)
  }, [value])

  const handleMonthSelect = (selectedDate: Date) => {
    setDate(selectedDate)
    if (onChange) {
      // Format as YYYY-MM-01 (always first day of month)
      const formatted = format(selectedDate, "yyyy-MM-01")
      onChange(formatted)
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "MMMM yyyy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <MonthPicker
          selectedMonth={date}
          onMonthSelect={handleMonthSelect}
        />
      </PopoverContent>
    </Popover>
  )
}
