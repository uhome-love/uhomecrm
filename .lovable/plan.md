# Correções de segurança — itens restantes

Já aplicado nesta sessão (migration concluída):
- `melnick_campaign_analytics`: INSERT restrito a admin/gestor (automações via service role seguem funcionando).
- `tarefas`: acesso elevado agora usa `has_role()` (admin/backoffice), não mais `profiles.cargo`.
- `voice_campaigns`: leitura restrita a admin/gestor ou criador da campanha.
- Storage `homi-documents`: upload restrito a admin/gestor (removidas as policies abertas e a baseada em `cargo`).

## O que falta

### 1. Token Mapbox (warn) — sem token novo
Você não precisa de token novo: o valor público (`pk....`) já existe no código. Plano:
- Manter o token atual como **valor padrão (fallback)** no código, lendo de `import.meta.env.VITE_MAPBOX_TOKEN` quando existir, senão usar o token atual.
- Assim nada quebra e fica pronto para rotação futura sem novo deploy.
- Recomendação (opcional, feita por você no painel Mapbox): restringir o token por URL para `uhomesales.com`.

```text
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "pk...(token atual)";
```

### 2. PII hardcoded em `gerar-intermediacao` (ERROR)
CPF, RG, endereço e e-mails de dois funcionários estão fixos no código da edge function.
- Mover LUCAS / GABRIELLE para segredos do backend (`Deno.env.get(...)`), ex.: `INTERMEDIACAO_LUCAS_JSON` e `INTERMEDIACAO_GABRIELLE_JSON` (ou campos individuais).
- A função passa a ler esses valores do ambiente; sem eles, retorna erro claro de configuração.
- Vou solicitar o cadastro desses segredos (você cola os dados uma vez, com segurança).

### 3. `typesense-search` sem autenticação (warn)
Endpoint público repassa `filter_by/sort_by/query_by/facet_by` direto ao Typesense.
- Adicionar whitelist de campos permitidos para `query_by`, `filter_by`, `facet_by` (rejeitar campos fora da lista).
- Limitar `per_page` no servidor (ex.: máx 50).
- Forçar `ativo = true` por padrão nos resultados.
- Mantém busca pública de imóveis funcionando, mas sem injeção de filtros arbitrários.

### 4. Cron functions sem auth (ERROR)
`nurturing-orchestrator`, `cron-nurturing-sequencer`, `sweep-descartados`, `auto-one-on-one`, `stalled-deals-notify` aceitam POST sem validação.
- Criar helper `_shared/cron-auth.ts` que valida header `x-cron-secret === CRON_SECRET` (ou Bearer service-role para chamadas internas encadeadas).
- Aplicar em todas as funções acima; retornar 401 se faltar credencial.
- Atualizar os agendamentos (pg_cron/jobs internos) para enviar o header `x-cron-secret`.
- Vou solicitar o cadastro do segredo `CRON_SECRET`.

## Segredos que vou pedir (via cadastro seguro)
- `INTERMEDIACAO_LUCAS_JSON`, `INTERMEDIACAO_GABRIELLE_JSON` (dados dos funcionários)
- `CRON_SECRET` (chave compartilhada das crons)

## Observações
- Nenhuma mudança quebra fluxo de usuário comum; corretores perdem apenas acessos indevidos.
- Os 311 itens do linter (views SECURITY DEFINER, search_path) são pré-existentes e fora do escopo destas varreduras — posso tratá-los depois, em plano próprio.
