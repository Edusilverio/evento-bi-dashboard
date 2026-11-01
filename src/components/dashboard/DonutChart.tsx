import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";

interface DonutChartProps {
  value: number;
  total: number;
  label: string;
  colors?: [string, string];
  compact?: boolean;
}

export function DonutChart({ value, total, label, colors = ["#0D4F4F", "#1a2e2e"], compact = false }: DonutChartProps) {
  const pct = Math.min((value / total) * 100, 100);
  const data = [
    { name: "Realizado", value: value },
    { name: "Restante", value: Math.max(total - value, 0) },
  ];

  if (compact) {
    const radius = 44;
    const stroke = 10;
    const circumference = 2 * Math.PI * radius;
    const filled = (pct / 100) * circumference;
    const size = 120;
    const center = size / 2;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center"
      >
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={center} cy={center} r={radius} fill="none" stroke="#E5E7EB" strokeWidth={stroke} />
            <circle
              cx={center} cy={center} r={radius}
              fill="none" stroke={colors[0]} strokeWidth={stroke}
              strokeDasharray={`${filled} ${circumference - filled}`}
              strokeDashoffset={circumference * 0.25}
              strokeLinecap="round"
              style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold font-mono">{pct.toFixed(1)}%</span>
            <span className="text-[8px] text-muted-foreground">da meta</span>
          </div>
        </div>
        <span className="text-xs text-muted-foreground mt-1 text-center">{label}</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="kpi-card flex flex-col items-center"
    >
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{label}</span>
      <div className="relative w-48 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              stroke="none"
            >
              <Cell fill={colors[0]} />
              <Cell fill={colors[1]} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold font-mono">{pct.toFixed(1)}%</span>
          <span className="text-[10px] text-muted-foreground">da meta</span>
        </div>
      </div>
    </motion.div>
  );
}
