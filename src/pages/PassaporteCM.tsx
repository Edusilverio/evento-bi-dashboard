import { useState } from "react";
import { DateRangeFilter, DEFAULT_DATE_RANGE } from "@/components/dashboard/DateRangeFilter";
import { UpdateBadge } from "@/components/dashboard/UpdateBadge";
import type { DateRange } from "react-day-picker";
import { PassaporteSection } from "@/components/dashboard/sections/PassaporteSection";

const PassaporteCM = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(DEFAULT_DATE_RANGE);

  return (
    <div className="page-container space-y-4">
      <div className="rounded-xl p-5 bg-primary flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary-foreground tracking-wide">Passaporte Coral Moment</h1>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <UpdateBadge />
        <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
      </div>

      <PassaporteSection dateRange={dateRange} />
    </div>
  );
};

export default PassaporteCM;
