## Contexto — a dúvida do "1.000"

Não, você **não tem exatamente 1.000 leads descartados**. O número real no banco é maior:

- **1.493** leads com `motivo_descarte` do tipo "Descartado:" (reengajáveis por definição do prefixo)
- **969** com "Inativado:" (definitivos)
- **4.035** já arquivados (o cron de 24h arquiva quase todos)
- **4.055** têm telefone

O "**Todos 1.000**" que aparece nas pills de recência é um **bug de agregação**: o backend calcula os buckets de recência/motivo/empreendimento fazendo `range(0, 4999)` no PostgREST, mas o cliente Supabase por padrão **corta em 1.000 linhas por request**. Ou seja, todas as pills de recência, o multi-select de empreendimento e as badges de motivo estão sendo alimentadas por no máximo 1.000 leads amostrados — mesmo quando existem mais elegíveis. O card "Elegíveis" do funil lateral (que usa `count: exact`) mostra o número correto, mas os filtros mostram uma foto incompleta. Isso precisa ser corrigido antes de qualquer refinamento visual.

## Auditoria completa — o que vou revisar e corrigir

### 1. Correção crítica — tampão de 1.000 nos breakdowns
Arquivo: `supabase/functions/reengajamento-audience-preview/index.ts`

- Paginar `aggData` em chunks de 1.000 até esgotar (ou até um teto seguro tipo 20 mil) em vez de um único `range(0, 4999)`.
- Aplicar o mesmo tratamento aos breakdowns do fluxo combinado (`sourcesArr.length > 1`) e do `oferta_ativa_lista`.
- Retornar um campo `breakdown_truncado: boolean` para o front alertar se o teto foi atingido.

### 2. Dados — coerência dos números exibidos
- **Descartados/reengajáveis**: garantir que `elegiveis` (usado no botão "Disparar N") e a soma das pills de recência batam. Hoje divergem quando há >1.000 elegíveis.
- **Empreendimento multi-select**: hoje as opções vêm do breakdown paginado; após correção, cada opção mostrará o total real.
- **Motivos de descarte (informativo)**: idem — número por motivo hoje é limitado a 1.000.
- **Alerta "Template já disparado nas últimas 24h"**: validar que a janela usa o `created_at` do último disparo −24h (parece correto, mas conferir com dado real).

### 3. Opções — o que existe hoje e o que ajustar
- Aba **Público**: Canal (Meta/Evolution), Fonte multi-select (Descartados/Oferta Ativa/Pipeline ativo) — ok.
- Aba **Filtros**: Recência (7d/30d/90d/3–6m/+6m/Todos), Empreendimento multi-select, Tipo de descarte, Incluir arquivados, Etapas (pipeline), Listas (oferta ativa), Regras de dedup colapsáveis — ok, mas:
  - Adicionar **filtro por motivo de descarte** (clicar numa badge de motivo deveria filtrar, hoje é só informativo).
  - "Incluir arquivados" está marcado por padrão como recomendado — validar contra o comportamento do backend (`include_archived`).
- Aba **Mensagem**: Template Meta + Modo teste cauteloso — ok.

### 4. Seleções e cliques
- Pills de recência: clique já troca `recencia` — ok. Adicionar estado "hover" com contagem mesmo quando inativo (já mostra a badge, ok).
- `EmpreendimentoMultiSelect`: seleção, limpar, remover pill individual — funciona. Adicionar suporte a **selecionar por checkbox no funil lateral** (hoje o click no funil lateral chama `onFocusEmpreendimento` mas o handler não está passado; conferir wiring em `DisparoCustomizadoCard`).
- Badges de motivo: hoje inertes. Tornar clicáveis para adicionar/remover ao filtro `motivos_descarte`.
- Botão "Disparar": disabled correto quando `elegiveis===0` — ok.

### 5. Formatos
- Números com `toLocaleString("pt-BR")` em todos os lugares — auditoria rápida para pegar qualquer `n.toString()` remanescente (badges de motivo em l.492 usam `{m.total}` sem locale — corrigir).
- Datas relativas ("há 3d") — já centralizado em `FunilLateral`. Ok.

### 6. Responsividade mobile (viewport 440×799 do print)
Problemas visíveis no screenshot que você mandou:
- **Funil lateral some no mobile** — `grid lg:grid-cols-[1fr_320px]` faz ele virar bloco abaixo do conteúdo. Solução: transformar num **sheet/drawer fixo no rodapé** com CTA "Ver funil (1.234 elegíveis)" ou num sticky bar inferior no mobile, mantendo o botão Disparar sempre visível.
- **TabsList "3 abas" + subtabs internos**: os TabsList da página (Disparo/Nutrição/Ao vivo/Histórico/Config) já quebram em 2 linhas no mobile, o que empurra o card para baixo. Aceitável, mas dá para reduzir `h-11` no mobile.
- **Pills de recência** quebram em 3 linhas — ok, mas apertar o gap (`gap-1` no mobile).
- **Empreendimento select**: o `PopoverContent` com `w-[--radix-popover-trigger-width]` funciona; conferir que a busca não quebra em telas <380px.
- **Badges de motivo**: no mobile viram scroll horizontal implícito. Trocar por `flex-wrap` (já está) e limitar a 6 no mobile com "ver mais".

### 7. Fora do card — coerência da página
- `LiveDispatchBanner`, `RespostasRecebidasHoje`, `AuditoriaWebhookTab`: rápida checagem de que consomem `elegiveis`/`count` corretos.
- Aba **Histórico** (`FilaReenvioCard`) e aba **Config** (`ReengajamentoTab`): checagem visual e responsividade, sem mudança funcional.

## Entregáveis desta rodada

1. **Fix backend**: paginação real dos breakdowns (elimina o teto artificial de 1.000).
2. **Fix frontend**: badges de motivo clicáveis viram filtro; wiring do `onFocusEmpreendimento`; formatação `pt-BR` universal.
3. **Mobile**: funil lateral vira drawer inferior com CTA de disparo sempre acessível; ajustes finos de spacing nas pills.
4. **Aviso de truncamento**: se algum breakdown ainda estourar o teto de segurança, mostrar "aproximado" com tooltip.

Sem tocar em lógica de disparo, supressão Meta, modo teste cauteloso ou fluxo de auto-pausa — tudo isso permanece como está.
