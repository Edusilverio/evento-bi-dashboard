import { AlertTriangle, Info } from "lucide-react";

export interface UltimoDadoRow {
  ultima_data: string | null;
  dias: string | number | null;
}

/**
 * Uma integração de mídia pode parar de trazer dado e o card continua desenhando
 * um número — que passa a ser lido como "corte de verba" em vez de "feed morto".
 * Foi o que deixou o Google Ads ficar 166 dias parado sem ninguém notar.
 */
export const DIAS_TOLERANCIA = 7;

export function diasSemDado(row: UltimoDadoRow | undefined): number | null {
  const dias = Number(row?.dias);
  if (!row?.ultima_data || !Number.isFinite(dias)) return null;
  return dias;
}

export function integracaoParada(row: UltimoDadoRow | undefined): boolean {
  const dias = diasSemDado(row);
  return dias !== null && dias > DIAS_TOLERANCIA;
}

export function IntegracaoParadaBanner({ row }: { row: UltimoDadoRow | undefined }) {
  if (!integracaoParada(row)) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-400 px-2 py-1.5 mb-2 text-[11px] font-semibold text-amber-950">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
      <span>Integração parada — último dado em {row!.ultima_data} ({diasSemDado(row)} dias)</span>
    </div>
  );
}

/**
 * Tarja fixa, sem query. Para fonte que não é integrada de verdade: a
 * tiktok.base_projecao é tabela externa apoiada no Google Drive e nem dá para
 * consultar por SQL ("Access Denied: Permission denied while getting Drive
 * credentials"), então não existe "último dado" para medir.
 */
export function FonteNaoIntegradaBanner({ texto }: { texto: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-muted px-2 py-1.5 mb-2 text-[11px] font-medium text-muted-foreground">
      <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
      <span>{texto}</span>
    </div>
  );
}

/**
 * Mesma ideia da tarja acima, medida em horas: a carga do Conta Azul é diária,
 * então acima de 30h já houve uma rodada que não entregou. Abaixo disso a idade
 * do dado continua visível, discreta — o dado sempre diz quando foi carregado.
 */
export const HORAS_TOLERANCIA_SYNC = 30;

export function DadoDesatualizadoBanner({ quando, horas }: { quando?: string | null; horas?: number | null }) {
  if (!quando || !Number.isFinite(Number(horas))) {
    return <FonteNaoIntegradaBanner texto="Sem registro de carga do Conta Azul." />;
  }
  const h = Number(horas);
  if (h > HORAS_TOLERANCIA_SYNC) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-400 px-2 py-1.5 text-[11px] font-semibold text-amber-950">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
        <span>Dado desatualizado — última carga em {quando} ({h}h atrás)</span>
      </div>
    );
  }
  return <p className="text-[11px] text-muted-foreground">Atualizado em {quando}</p>;
}

