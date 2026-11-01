import { TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

interface KPICardProps {
  title: React.ReactNode;
  value: string;
  subtitle?: string;
  variation?: number;
  icon?: React.ReactNode;
  delay?: number;
  /** Tarja de aviso exibida logo abaixo do título (ex.: integração parada). */
  banner?: React.ReactNode;
  /** Texto no lugar da variação quando ela não pode ser calculada com sentido. */
  variationNote?: string;
}

export function KPICard({ title, value, subtitle, variation, icon, delay = 0, banner, variationNote }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="kpi-card"
    >
      <div className="flex items-center justify-between mb-2">
        {typeof title === "string" ? (
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
        ) : (
          title
        )}
        {icon && <span className="text-primary">{icon}</span>}
      </div>
      {banner}
      <div className="text-2xl font-bold font-mono tracking-tight">{value}</div>
      {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
      {variation !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${variation >= 0 ? "text-success" : "text-destructive"}`}>
          {variation >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {variation >= 0 ? "+" : ""}{variation.toFixed(1)}% vs ano anterior
        </div>
      )}
      {variation === undefined && variationNote && (
        <div className="mt-2 text-xs font-semibold text-muted-foreground">{variationNote}</div>
      )}
    </motion.div>
  );
}
