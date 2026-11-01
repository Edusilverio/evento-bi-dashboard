import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Clock, RefreshCw } from "lucide-react";
import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

const AUTO_REFRESH_MS = 3600000; // 1 hour

export function UpdateBadge() {
  const queryClient = useQueryClient();
  const isFetching = useIsFetching();
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries();
    setLastUpdate(new Date());
  }, [queryClient]);

  useEffect(() => {
    const interval = setInterval(handleRefresh, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [handleRefresh]);

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full">
        <Clock className="w-3 h-3" />
        Atualizado em: {format(lastUpdate, "dd/MM/yyyy HH:mm:ss")}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={isFetching > 0}
        className="gap-2 text-xs"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isFetching > 0 ? "animate-spin" : ""}`} />
        {isFetching > 0 ? "Atualizando..." : "Atualizar Dados"}
      </Button>
    </div>
  );
}
