import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Columns3 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

interface Column {
  key: string;
  label: string;
  format?: (val: any) => string;
  render?: (val: any, row: any) => React.ReactNode;
  progressBar?: boolean;
  totalKey?: string;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  pageSize?: number;
  totals?: Record<string, { value: number; format?: (v: number) => string }>;
}

function ProgressCell({ value, max, formatted }: { value: number; max: number; formatted: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-mono">{formatted}</span>
      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function DataTable({ columns, data, pageSize = 10, totals }: DataTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(
    () => new Set(columns.map(c => c.key))
  );

  const maxValues = useMemo(() => {
    const result: Record<string, number> = {};
    columns.filter(c => c.progressBar).forEach(col => {
      result[col.key] = data.reduce((max, row) => Math.max(max, Number(row[col.key]) || 0), 0);
    });
    return result;
  }, [data, columns]);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      if (!sortKey) return 0;
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const toggleColumn = (key: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(key) && next.size > 1) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visibleColumns = columns.filter(c => visibleKeys.has(c.key));

  return (
    <div className="glass-card overflow-hidden">
      {/* Column selector */}
      <div className="flex justify-end px-4 py-2 border-b border-border">
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted">
              <Columns3 className="w-3.5 h-3.5" />
              Colunas
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-2">
            {columns.map(col => (
              <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-muted rounded">
                <Checkbox
                  checked={visibleKeys.has(col.key)}
                  onCheckedChange={() => toggleColumn(col.key)}
                />
                {col.label}
              </label>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {visibleColumns.map(col => (
                <th key={col.key} onClick={() => handleSort(col.key)} className="cursor-pointer select-none hover:text-foreground transition-colors">
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr key={i}>
                {visibleColumns.map(col => (
                  <td key={col.key}>
                    {col.render ? (
                      col.render(row[col.key], row)
                    ) : col.progressBar ? (
                      <ProgressCell
                        value={Number(row[col.key]) || 0}
                        max={maxValues[col.key] || 1}
                        formatted={col.format ? col.format(row[col.key]) : String(row[col.key])}
                      />
                    ) : (
                      col.format ? col.format(row[col.key]) : row[col.key]
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {/* Totals row */}
            {totals && (
              <tr className="border-t-2 border-border bg-muted/50 font-semibold">
                {visibleColumns.map((col, i) => (
                  <td key={col.key} className="text-xs">
                    {totals[col.key]
                      ? (totals[col.key].format
                          ? totals[col.key].format!(totals[col.key].value)
                          : String(totals[col.key].value))
                      : (i === 0 ? "Total" : "")}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <span className="text-xs text-muted-foreground">{data.length} registros</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs">{page + 1}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1 rounded hover:bg-muted disabled:opacity-30">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
