# Coral Moment Insights

Crie um dashboard BI completo chamado "Coral Moment Dashboard" com as seguintes especificacoes:

## AUTENTICACAO

- Tela de login com email e senha usando Supabase Auth

- Controle de acesso por usuario (admin e viewer)

- Sidebar com navegacao entre paginas

- Design dark mode profissional, cores em tons de teal/dark (#0D4F4F como primario)

## PAGINAS DO DASHBOARD (7 paginas)

### 1. Consolidado CM (pagina principal)

- Header: "Coral Moment 2026 - CONSOLIDADO"

- Filtro de data (calendario) no topo direito

- KPI Cards: Faturamento vs Meta CC/Pix, Total Geral de Ingressos CC/Pix, Total Geral de Hospedagem

- Cada KPI com comparativo ano anterior (%) em vermelho/verde

- Grafico rosca: Venda x Meta (meta R$2.500.000) com percentual no centro

- Card: Faturamento Bruto com breakdown CC e Pix

- Grafico barras comparativo 2025 vs 2026 (ingressos)

- Grafico barras: Visao mensal comparativo

- Tabela detalhada: Calendario, Ingresso, Qtd Ingresso, Receita Bruta

- Card: Fat. Hospedagem CC/Pix

### 2. GA4

- Header: "Coral Moment 2026 - GA4"

- KPI Cards: Receita de Compra, Transacoes, Sessoes, Duracao media

- Graficos pizza: Dispositivos, Regiao, Sistema Operacional

- Tabela: Performance de Origem/Midia (campaign, Receita, Transacoes, Sessoes Total)

- Tabela: Performance por Regiao (regiao, Sessoes, Receita)

- Tabela: FAQ (perguntas frequentes e quantidade)

- Secao: Pousadas

### 3. Meta Ads

- Header: "Coral Moment 2026 - Meta Ads"

- KPI Cards: Impressoes, Clicks, Alcance, Engajamento, CPC, Custo

- Tabela: Performance de Campanha (Campanha, Custo, CPC, Impressoes, Clicks, Alcance, Frequencia)

- Graficos pizza: Genero, Plataforma, Faixa Etaria

- Tabela: Performance de Criativos (data, imagem criativo, nome, impressions, clicks, reach, spend)

### 4. Google Ads

- Header: "Coral Moment 2026 - Google Ads"

- Filtro: campaign_name

- KPI Cards: Custo de midia, Impressoes, Cliques, CPC

- Graficos pizza: Dispositivos, Regiao, Sistema Operacional

- Grafico linha: custo_total e CPC por campaign_date

### 5. Investimento

- Header: "Coral Moment 2026 - Investimento"

- KPI Cards: Investimento Total, Custo Meta Ads, Custo Google Ads

- Grafico rosca: Meta Investimento (R$82.000) vs realizado com % no centro

- Grafico barras empilhadas 100%: Google Ads e Meta Ads por Mes

### 6. Consolidado PR

- Header: "POS REVEILLON 2026 - CONSOLIDADO"

- Mesma estrutura do Consolidado CM mas para evento Pos Reveillon

- Meta de venda R$90.000

### 7. Auditoria

- Header: "Auditoria CM 25"

- Cards: Valores site Ingresse (PIX e CC), Valores API (PIX e CC)

- Cards: Cupom, TX 1.9%, Valor Cortesia

- Cards: Bruto - Cupom - Tx, Bruto - Cupom

## AI INSIGHTS

- Pagina dedicada de AI Analysis

- Input para perguntas sobre os dados

- Analise automatica com resumos e recomendacoes

- Integracao com Supabase Edge Functions para chamar API de AI

## DADOS (usar Supabase como backend)

Criar tabelas no Supabase que espelham os dados do BigQuery projeto coral-moment:

- vendas_cm (Ano, Data, Data_da_compra, Email, Estado, Evento_ID, Faixa_Etaria, Genero, Ingresso, Meio_de_Pagamento, Mes, Nome, Parcelas, Qtd, Telefone, ticket_code, ticket_id, Transacao_ID, Valor_Final, Valor_Liquido, Desconto, Bruto_Cupom)

- vendas_pr (mesma estrutura para Pos Reveillon)

- meta_ads_insights (date_start, campaign_name, impressions, clicks, reach, spend, cpc, frequency, engagement)

- meta_ads_demographics (date_start, campaign_name, age, gender, device_platform, impressions, clicks, reach, spend)

- meta_ads_creatives (date_start, creative_name, creative_image_url, impressions, clicks, reach, spend)

- google_ads_report (campaign_date, campaign_name, impressions, clicks, cost, cpc, device, region, os)

- ga4_sessions (date, source_medium, campaign, sessions, transactions, revenue, avg_session_duration, device_category, region, operating_system)

- ga4_faq (question, count)

- calendario (data, ano, mes, dia, dia_semana)

- metas (evento, meta_vendas, meta_investimento, ano)

- auditoria (valores_pix, valores_cc, valores_api_pix, valores_api_cc, cupom, tx, valor_cortesia)

## DESIGN

- Usar shadcn/ui components

- Dark mode como padrao

- Sidebar colapsavel com icones para cada pagina

- Responsivo

- Graficos usando Recharts

- Tabelas com ordenacao e paginacao

- Badge de atualizacao "Atualizado em: DD/MM/YYYY HH:MM:SS"

- Cores: header teal escuro (#0D4F4F), cards com fundo escuro, texto branco, acentos em teal

Crie dados mock realistas para popular o dashboard.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://placehold.co/1200x630?text=Coral+Moment

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

---

> **Nota:** projeto adaptado de um trabalho profissional para fins de portfólio. Nomes de clientes, credenciais e dados foram substituídos por valores fictícios.
