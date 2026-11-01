# Base de demonstração (dados fictícios)

O dashboard roda sem BigQuery: a Edge Function `dashboard-data` tem um **modo demo** (`CM_DEMO_MODE=true`)
que, no lugar de cada consulta, gera dados fictícios no mesmo formato (colunas, dimensões e totais
proporcionais ao período). O gerador está em `supabase/functions/dashboard-data/demo.ts`.

Evento fictício: **Coral Moment**. Nenhum dado real.

## Como subir

1. Rode `cm_01_estrutura.sql` no SQL Editor (schema `cm`: perfis, papéis, clientes, lista de e-mails autorizados).
2. Em **Project Settings → Data API → Exposed schemas**, adicione `cm`.
3. Publique as Edge Functions com o prefixo do app (o nome da função vem do nome da pasta) e as variáveis:
   ```bash
   cp -r supabase/functions/dashboard-data supabase/functions/cm-dashboard-data
   cp -r supabase/functions/admin-users supabase/functions/cm-admin-users
   cp -r supabase/functions/weather-forecast supabase/functions/cm-weather-forecast
   supabase functions deploy cm-dashboard-data cm-admin-users cm-weather-forecast --project-ref SEU-PROJETO
   supabase secrets set CM_DEMO_MODE=true CM_DB_SCHEMA=cm CM_APP_ID=cm --project-ref SEU-PROJETO
   ```
4. Autorize e crie o primeiro usuário (cadastros só entram se o e-mail estiver em `cm.emails_autorizados`):
   ```sql
   insert into cm.emails_autorizados (email) values ('seu-email@exemplo.com');
   ```
   Depois de criar a conta (com `raw_user_meta_data.app = 'cm'`), dê o papel de admin:
   `insert into cm.user_roles (user_id, role) select id, 'admin' from auth.users where email = 'seu-email@exemplo.com';`
5. Copie `.env.example` para `.env` e preencha URL e chave anon.

O analista de IA (`ai-analyst`) e a sincronização financeira (`conta-azul-sync`) dependem de chaves
externas e não funcionam na demo.
