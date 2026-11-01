import { useState } from "react";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { UpdateBadge } from "@/components/dashboard/UpdateBadge";
import type { DateRange } from "react-day-picker";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";

import { ConsolidacaoSection, DetalhesVendasSection } from "@/components/dashboard/sections/ConsolidacaoSection";
import { PassaporteSection } from "@/components/dashboard/sections/PassaporteSection";
import { MetasPVSection } from "@/components/dashboard/sections/MetasPVSection";
import { MetasLoteSection } from "@/components/dashboard/sections/MetasLoteSection";
import { DemograficoSection } from "@/components/dashboard/sections/DemograficoSection";
import { ParcelamentosSection } from "@/components/dashboard/sections/ParcelamentosSection";
import { SunsetBoatSextaSection } from "@/components/dashboard/sections/SunsetBoatSextaSection";
import { SunsetBoatSabadoSection } from "@/components/dashboard/sections/SunsetBoatSabadoSection";
import { GeneroFestaSection } from "@/components/dashboard/sections/GeneroFestaSection";
import { BrunchSection } from "@/components/dashboard/sections/BrunchSection";
import { SimpleEventSection } from "@/components/dashboard/sections/SimpleEventSection";
import { CorridaEndorfinaSection } from "@/components/dashboard/sections/CorridaEndorfinaSection";
import { AereoMargemSection } from "@/components/dashboard/sections/AereoMargemSection";
import { ConciergeSection } from "@/components/dashboard/sections/ConciergeSection";
import { ExportReportButton } from "@/components/dashboard/ExportReportButton";
import { PrevisaoTempoSection } from "@/components/dashboard/sections/PrevisaoTempoSection";

const getDefaultDateRange = (): DateRange => ({
  from: new Date(2026, 0, 1),
  to: new Date(),
});

const ConsolidadoCM = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(getDefaultDateRange);

  return (
    <div className="page-container space-y-4">
      <div className="rounded-xl p-5" style={{ backgroundColor: "#0D4F4F" }}>
        <h1 className="text-xl font-bold text-white tracking-wide">Coral Moment 2026 - CONSOLIDADO</h1>
        <p className="text-white/70 text-xs mt-1">Lançamento 13/01</p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <UpdateBadge />
          <ExportReportButton targetId="dashboard-export-root" />
        </div>
        <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
      </div>

      <div id="dashboard-export-root" className="space-y-4">
      {/* 0. Previsão do Tempo */}
      <SectionHeader title="Previsão do Tempo — 1 a 7 de setembro" />
      <PrevisaoTempoSection />

      {/* 1. Faturamento */}
      <ConsolidacaoSection dateRange={dateRange} />

      {/* 1b. Margem do aéreo — logo abaixo do card FAT. AÉREO, que continua no consolidado */}
      <SectionHeader title="Margem do Aéreo" />
      <AereoMargemSection dateRange={dateRange} />

      {/* 1c. Concierge x venda direta */}
      <SectionHeader title="Concierge × Venda Direta" />
      <ConciergeSection dateRange={dateRange} />




      {/* 2. Passaporte */}
      <SectionHeader title="Passaporte Coral Moment" />
      <PassaporteSection dateRange={dateRange} />




      {/* 3. Demográfico */}
      <SectionHeader title="Demográfico" />
      <DemograficoSection dateRange={dateRange} />

      {/* 2c. Detalhes de Vendas */}
      <SectionHeader title="Detalhes de Vendas" />
      <DetalhesVendasSection dateRange={dateRange} />

      {/* 4. Lote */}
      <SectionHeader title="Metas PV - 13/01 a 23/04" />
      <MetasPVSection dateRange={dateRange} />

      <SectionHeader title="Metas 1º Lote - 24/4 - 11/6" />
      <MetasLoteSection dateRange={dateRange} lote="1º Lote" page="metas-lote1" />

      <SectionHeader title="Metas 2º Lote - 12/6 - 16/7" />
      <MetasLoteSection dateRange={dateRange} lote="2º Lote" page="metas-lote2" />

      <SectionHeader title="Metas 3º Lote - 17/7 - 20/8" />
      <MetasLoteSection dateRange={dateRange} lote="3º Lote" page="metas-lote3" />

      <SectionHeader title="Metas 4º Lote" />
      <MetasLoteSection dateRange={dateRange} lote="4º Lote" page="metas-lote4" />






      {/* 6. Demais áreas - Sunset Boat */}
      <SectionHeader title="Sunset Boat Party - Escuna (Sexta)" />
      <SunsetBoatSextaSection dateRange={dateRange} />

      <SectionHeader title="Sunset Boat Party - Spritz (Sábado)" />
      <SunsetBoatSabadoSection dateRange={dateRange} />

      <SectionHeader title="Coral Moment - Brunch" />
      <BrunchSection dateRange={dateRange} />

      <SectionHeader title="Lumen" />
      <SimpleEventSection dateRange={dateRange} page="lumen" label="Lumen" keyword="lumen" meta={100} />

      <SectionHeader title="Brisa" />
      <SimpleEventSection dateRange={dateRange} page="brisa" label="Brisa" keyword="brisa" meta={100} />

      <SectionHeader title="Opening Party" />
      <SimpleEventSection dateRange={dateRange} page="opening-party" label="Opening Party" keyword="opening party" meta={100} hideMetrics />

      <SectionHeader title="Corrida Endorfina - Clube de Corrida" />
      <CorridaEndorfinaSection dateRange={dateRange} />


      {/* 7. Gênero por Festa */}
      <SectionHeader title="Gênero por Festa" />
      <GeneroFestaSection dateRange={dateRange} />
      </div>
    </div>
  );
};

export default ConsolidadoCM;
