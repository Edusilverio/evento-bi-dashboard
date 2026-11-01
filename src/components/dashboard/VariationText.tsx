export function VariationText({ current, previous, suffix = "" }: { current: number; previous: number; suffix?: string }) {
  if (!previous) return null;
  const pct = ((current / previous) - 1) * 100;
  const isNeg = pct < 0;
  return (
    <span className={`text-xs font-semibold ${isNeg ? "text-destructive" : "text-emerald-600"}`}>
      {isNeg ? "" : "+"}{pct.toFixed(1)}%{suffix}
    </span>
  );
}

export function ValueWithColor({ value, format }: { value: number; format: (v: number) => string }) {
  return (
    <span className={value < 0 ? "text-destructive" : ""}>{format(value)}</span>
  );
}
