import { Info } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

interface FilterBlock {
  year?: string;
  filters: string[];
}

interface FilterTooltipProps {
  title: string;
  blocks: FilterBlock[];
  className?: string;
  titleClassName?: string;
}

export function FilterTooltip({ title, blocks, className, titleClassName }: FilterTooltipProps) {
  return (
    <div className={cn("flex", className)}>
      <HoverCard openDelay={100} closeDelay={50}>
        <HoverCardTrigger asChild>
          <span className="inline-flex items-center gap-1 cursor-help">
            <span className={cn("text-[10px] font-medium text-muted-foreground uppercase tracking-wider", titleClassName)}>{title}</span>
            <Info className="w-3 h-3 text-muted-foreground/60" />
          </span>
        </HoverCardTrigger>
        <HoverCardContent className="w-96" align="start">
          <div className="space-y-3">
            <p className="text-xs font-bold text-foreground">Filtros aplicados</p>
            {blocks.map((b, idx) => (
              <div key={b.year || idx} className="space-y-1">
                {b.year && <p className="text-[11px] font-semibold text-primary">{b.year}</p>}
                <ul className="space-y-0.5">
                  {b.filters.map((f, i) => (
                    <li key={i} className="text-[11px] font-mono text-muted-foreground leading-snug break-words">
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}
