import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Sun, CloudSun, Cloud, CloudDrizzle, CloudRain, CloudLightning, Wind, Droplets } from "lucide-react";

interface WeatherDay {
  data: string;
  temp_max: number | null;
  temp_min: number | null;
  precipitacao: number | null;
  probabilidade_chuva: number | null;
  vento: number | null;
  weather_code: number | null;
  fonte: "previsao" | "climatologia";
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function weatherIcon(code: number | null) {
  const c = code ?? 0;
  if (c === 0) return Sun;
  if (c <= 2) return CloudSun;
  if (c === 3 || c === 45 || c === 48) return Cloud;
  if (c >= 51 && c <= 57) return CloudDrizzle;
  if (c >= 95) return CloudLightning;
  return CloudRain;
}

function label(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${WEEKDAYS[dt.getDay()]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

const fmt = (v: number | null, suffix: string, digits = 0) =>
  v === null || v === undefined ? "—" : `${v.toFixed(digits)}${suffix}`;

export function PrevisaoTempoSection() {
  const { data, isLoading, error } = useQuery<{ days: WeatherDay[] }>({
    queryKey: ["weather-forecast"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(((import.meta.env.VITE_FUNCTIONS_PREFIX as string | undefined) ?? "") + "weather-forecast", { body: {} });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="kpi-card p-4 space-y-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !data?.days?.length) {
    return (
      <div className="kpi-card p-4 text-sm text-muted-foreground">
        Não foi possível carregar a previsão do tempo agora.
      </div>
    );
  }

  const hasClimatologia = data.days.some((d) => d.fonte === "climatologia");

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {data.days.map((day) => {
          const Icon = weatherIcon(day.weather_code);
          const historico = day.fonte === "climatologia";
          return (
            <div
              key={day.data}
              className={`kpi-card p-4 flex flex-col items-center text-center gap-2 ${
                historico ? "opacity-60 border-dashed" : ""
              }`}
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {label(day.data)}
              </span>
              <Icon className="w-8 h-8 text-primary" />
              <div className="font-mono text-lg font-bold leading-none">
                {fmt(day.temp_max, "°")}
                <span className="text-sm font-medium text-muted-foreground ml-1">
                  / {fmt(day.temp_min, "°")}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Droplets className="w-3 h-3" />
                {fmt(day.probabilidade_chuva, "%")}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Wind className="w-3 h-3" />
                {fmt(day.vento, " km/h")}
              </div>
              {historico && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-dashed border-border rounded px-1.5 py-0.5">
                  média histórica
                </span>
              )}
            </div>
          );
        })}
      </div>
      {hasClimatologia && (
        <p className="text-xs text-muted-foreground">
          Os dias marcados como <strong>média histórica</strong> ainda estão fora do horizonte de previsão
          (~16 dias) e mostram a média dos últimos anos para a data. Eles passam a exibir previsão real
          conforme a data se aproxima.
        </p>
      )}
    </div>
  );
}
