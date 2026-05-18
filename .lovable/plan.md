# Plano — Central de Reengajamento (auditoria + organização)

## Problemas atuais
1. `AuditoriaWebhookTab` faz `.limit(300)` → trava em 300 disparos.
2. Não mostra **qual disparo** (template + audience_source + run_id) gerou cada linha.
3. Atualiza só com `refetchInterval: 5s` (sem realtime).
4. Coluna "Mensagem recebida" não diferencia bem **botão clicado** vs **texto digitado**.
5. Página `CentralNutricao` mistura 4 seções empilhadas — visual pesado, sem hierarquia clara para o fluxo "selecionar lista → selecionar modelo → enviar → ver retorno".

## Mudanças (apenas frontend + leitura)

### 1. `AuditoriaWebhookTab.tsx` — refatorar
- **Remover `.limit(300)`** e adotar paginação por `range()` de 100 em 100 com botão "Carregar mais" + contador "Mostrando X de Y" (total via `count: 'exact', head: true`).
- **Realtime**: assinar canal Postgres em `reengajamento_meta_disparos` (INSERT + UPDATE) e dar `queryClient.invalidateQueries(['auditoria-meta-webhook'])` no callback. Mostrar pill "🟢 ao vivo".
- **Nova coluna "Disparo"**: exibir `template_name` + badge colorido do `audience_source` (Descartados / Pipeline ativo / Oferta ativa / Visita amanhã / Legacy). Permitir filtrar por audience_source e por template via selects.
- **Coluna "Mensagem recebida"** reformulada:
  - Se `button_response` ∈ {sim,nao} → mostrar chip "Botão: SIM/NÃO".
  - Senão se `response_text` → mostrar texto livre com ícone 💬.
  - Senão "—".
- **Buscar também por nome do template** no input de busca.
- **Stats cards** ganham um a mais: "Aguardando entrega" (sent sem delivered).

### 2. `CentralNutricao.tsx` — reorganizar layout
Estrutura de 2 colunas em telas grandes, mais respiro:

```text
┌─────────────────────────────────────────────────────────────┐
│  Header: Central de Reengajamento (subtítulo curto)         │
├─────────────────────────────────────────────────────────────┤
│  [Tabs grandes]  ① Novo disparo   ② Retorno (auditoria)    │
│                  ③ Configurações                            │
└─────────────────────────────────────────────────────────────┘
```

- Trocar a pilha atual de `<section>`s por **Tabs** (`@/components/ui/tabs`) com 3 abas: "Novo disparo", "Retorno em tempo real", "Configurações".
- Aba 1 = `DisparoCustomizadoCard` (já tem o fluxo lista → modelo → enviar).
- Aba 2 = `AuditoriaWebhookTab` refatorado (com realtime).
- Aba 3 = `ReengajamentoTab` + `VisitaAmanhaTab` collapsibles dentro.
- KPI bar fixa no topo de Aba 2 com 6 cards já existentes + "Aguardando".
- Manter `max-w-[1600px]`, padding consistente, hierarquia tipográfica (`text-2xl` no h1).

### 3. Detalhes técnicos
- Realtime: `supabase.channel('audit-meta').on('postgres_changes', { event: '*', schema: 'public', table: 'reengajamento_meta_disparos' }, () => qc.invalidateQueries(...)).subscribe()`; cleanup no `useEffect` return.
- Habilitar realtime na tabela: **migration necessária** → `ALTER PUBLICATION supabase_realtime ADD TABLE public.reengajamento_meta_disparos;` (verificar se já não está; é a única alteração de DB).
- Paginação: estado `page`, queryKey `['auditoria-meta-webhook', page]`, `keepPreviousData`.
- Audience source badges: mapa local com cores semânticas (sem cores diretas — usar tokens existentes `bg-*-50 text-*-700`).

## Fora de escopo
- Mudanças no `DisparoCustomizadoCard` (já refinado).
- Mudanças no fluxo de webhook (whatsapp-webhook/evolution-webhook).
- Novos templates, novos canais, recorrência.

## Arquivos
- `src/components/central-nutricao/AuditoriaWebhookTab.tsx` (refatorar)
- `src/pages/CentralNutricao.tsx` (reorganizar em Tabs)
- 1 migration: adicionar tabela à publicação `supabase_realtime` (se ainda não estiver)
