import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import type { DateRange } from "react-day-picker";

export type DashboardPage =
  | "consolidado-cm"
  | "ga4"
  | "meta-ads"
  | "google-ads"
  | "investimento"
  | "consolidado-pr"
  | "auditoria"
  | "metas-pv"
  | "metas-lote1"
  | "metas-lote2"
  | "metas-lote3"
  | "metas-lote4"
  | "passaporte-cm"
  | "sunset-boat-sexta"
  | "sunset-boat-sabado"
  | "demografico"
  | "genero-festa"
  | "parcelamentos"
  | "brunch"
  | "lumen"
  | "brisa"
  | "opening-party"
  | "corrida-endorfina"
  | "financeiro-cm"
  | "tiktok"
  | "aereo-margem"
  | "concierge";

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function useDashboardData<T = Record<string, any[]>>(
  page: DashboardPage,
  dateRange: DateRange | undefined,
  edicao?: string
) {
  const { user } = useAuth();
  const startDate = dateRange?.from ? formatDate(dateRange.from) : "2026-01-01";
  const endDate = dateRange?.to ? formatDate(dateRange.to) : "2026-02-28";
  const sensitive = page === "financeiro-cm";

  return useQuery<T>({
    // user id in the key so sensitive data never survives a user switch
    queryKey: ["dashboard-data", user?.id ?? "anon", page, startDate, endDate, edicao ?? ""],
    enabled: !sensitive || !!user,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(((import.meta.env.VITE_FUNCTIONS_PREFIX as string | undefined) ?? "") + "dashboard-data", {
        body: { page, startDate, endDate, edicao },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data?.data as T;
    },
    staleTime: sensitive ? 0 : 5 * 60 * 1000,
    gcTime: sensitive ? 0 : 5 * 60 * 1000,
    retry: 1,
  });
}


