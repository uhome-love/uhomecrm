# Eu Auditoria da tela de disparo (`DisparoCustomizadoCard`) + Redesign

## Problemas hoje

Fiz uma leitura da tela ponto a ponto e olhei o volume real da base para saber onde a UI está cega:

1. **"Descartados" é uma caixa preta.** Você escolhe a fonte e não sabe se são 3.900 ou 30.000, quantos são de julho, quantos são de fevereiro, quantos são Casa Tua. Hoje só existe volume total do banco: **jul/2026 = 2.202, jun = 1.488, mai = 376**. O usuário não tem esse mapa dentro da tela.
2. **Empreendimento é campo de texto livre.** Você digita "Casa Tua", mas há variações ("Casa Tua - Junho 2026", "Alto Lindóia" vs "Alto Lindoia"), e sem contador ao vivo. Existem **≥20 empreendimentos** com descartados; escolher às cegas gera erro de digitação silencioso.
3. **Não dá para disparar por múltiplos empreendimentos.** É um único input texto — ou 1 empreendimento, ou geral.
4. **Não existe "recência".** Sem controle "últimos 7d / 30d / 90d / 6m / +6m". Só um range de datas manual que ninguém preenche.
5. **Filtros empilhados verticalmente**, um embaixo do outro, sem hierarquia. Canal → Público → Tipo descarte → Arquivados → Etapas → Listas → Período → Empreendimento → Dedup → Cooldown → Template → Imagem → Preview → Disparar. É uma escada de 13 degraus.
6. **Preview é manual.** Você mexe em algo, esquece de clicar "Prévia", dispara com o número velho. Deveria recalcular sozinho.
7. **Funil já retorna do backend** (`total_bruto`, `duplicados_removidos`, `suprimidos_meta`, `em_cooldown`, `elegiveis`…) mas está enterrado em texto pequeno. Deveria ser o item mais visível da tela.
8. **Sem breakdown de saída.** Você não vê "dos 1.200 elegíveis, 830 são Casa Tua, 220 Open Bosque". Isso importa pra escolher o template certo.
9. **Sem "quem já recebeu esse template".** Você não sabe se acabou de disparar `casatua_junho25k` pros mesmos números ontem.
10. **Sem estimativa de custo/tempo.** 1.200 números × 3–6s = 60–120 min. Nunca mostrado.

## Redesign proposto: "Segment Builder" em 3 abas + funil ao vivo persistente

### Layout novo (uma linha, duas colunas fixas)

```text
┌─────────────────────────────────────────────┬───────────────────┐
│  [1. Público] [2. Filtros] [3. Mensagem]    │  📊 FUNIL AO VIVO │
│  ────────────────────────                    │  Total bruto: 4.812│
│  (conteúdo da aba selecionada)              │  − Duplicados: 210 │
│                                              │  − Pipeline ativo:180│
│                                              │  − Suprimidos Meta:410│
│                                              │  − Anti-fadiga: 90 │
│                                              │  ─────────────    │
│                                              │  = Elegíveis: 3.922│
│                                              │                   │
│                                              │  Por empreend.:   │
│                                              │  • Casa Tua  1.204│
│                                              │  • Open Bosque 487│
│                                              │  • Orygem      214│
│                                              │  …               │
│                                              │  ⏱ ~2h 40min      │
│                                              │  🎯 Meta / casatua│
│                                              │  [🚀 Disparar]   │
└─────────────────────────────────────────────┴───────────────────┘
```

Coluna direita **fica sempre visível** e **atualiza sozinha** (debounce 400ms) enquanto o usuário mexe nos filtros.

### Aba 1 — PÚBLICO

Três cards grandes, clicáveis, com **contador ao vivo** dentro do card:

```text
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ 🗂  Descartados│ │ 🎯 Oferta Ativa│ │ ⚙️ Pipeline    │
│ 4.066 leads   │ │ 12 listas ativas│ │ 7 etapas       │
│ ✅ selecionado │ │                │ │                │
└───────────────┘ └───────────────┘ └───────────────┘
```

Múltiplo permitido (combina + dedup), badge "combinado" continua.

### Aba 2 — FILTROS (adaptativos à fonte escolhida)

**Se DESCARTADOS:**

- **Recência** (pills com contador ao vivo — o que hoje não existe):
  ```
  [Últimos 7d · 412] [30d · 2.202] [90d · 3.690] [3-6m · 376] [+6m · 0] [Todos]
  ```
  Badge **🔥 NOVO** nos 7d.
- **Empreendimento** (multi-select combobox — hoje é texto livre):
  ```
  [Buscar empreendimento…]
  ☑ Casa Tua              1.331
  ☑ Open Bosque             487
  ☐ Orygem                  214
  ☐ Lake Eyre               189
  ☐ Casa Tua - Junho 2026    54
  … busca digitando ("Casa" filtra todos que contêm)
  ```
  Contador ao vivo baseado no que já foi filtrado por recência.
- **Tipo de descarte** (mantém): reengajável / definitivo / todos.
- **Motivo do descarte** (novo, opcional): chips com contador para "sem interesse", "sem retorno", "financeiro", etc. — puxando de `motivo_descarte` real.
- **Incluir arquivados** (mantém, mas vira toggle discreto).

**Se OFERTA ATIVA:**

- Filtro por empreendimento **em cima** da lista de listas (hoje é combobox único, difícil de escanear).
- Ordenação padrão: mais recente primeiro, badge "🔥 nova" nas <7d.
- Contador de leads por lista, com estado "já disparei ontem" quando aplicável.

**Se PIPELINE ATIVO:**

- Cada etapa com contador ao vivo `Qualificação · 342`.
- Filtro adicional por dias parados na etapa.

**Regras (colapsável, resumo em 1 linha):**

```
🛡  Excluir quem já recebeu nos últimos 7 dias · Excluir suprimidos Meta   [Ajustar]
```

Popover abre o dedup atual (cooldown / exclude_sent / only_sent_before).

### Aba 3 — MENSAGEM

Continua o que já existe: seletor de template Meta (ou Evolution free-text), preview da imagem de header, botão "Atualizar templates aprovados". Só reagrupado.

### Coluna direita — Funil ao vivo

- Todos os campos do funil que o backend **já retorna** viram uma pilha visual em cascata, com o **Elegíveis grande** no fim.
- **Breakdown por empreendimento** (top 5) dos elegíveis. Ao clicar em uma linha, filtra a seleção só para aquele empreendimento — atalho poderoso.
- **Estimativa de tempo** = elegíveis × 4,5s média.
- Botão **Disparar** aqui embaixo, sempre visível, sem precisar rolar.

## Ajustes backend necessários

- `reengajamento-audience-preview` já devolve `funil`; adicionar:
  - `breakdown_por_empreendimento`: `[{empreendimento, total}]`
  - `breakdown_por_recencia`: `{ '7d': n, '30d': n, '90d': n, '180d': n, 'mais': n }`
  - `breakdown_por_motivo_descarte`: `[{motivo, total}]`
  - `ultimo_disparo_template`: `{ template, quantos, quando }` (pra alertar se acabou de disparar ontem)
- Ativar recálculo automático da preview no frontend via `useQuery` com key `(sources, filters)` e `debounce`.

## Arquivos que serão tocados (só na fase de implementação)

- `src/components/central-nutricao/DisparoCustomizadoCard.tsx` — refatorar em 3 abas + funil lateral. Como o arquivo já está com **921 linhas** (acima da diretriz de 500), vai ser quebrado em:
  - `DisparoCustomizadoCard.tsx` (shell + estado)
  - `disparo/TabPublico.tsx`
  - `disparo/TabFiltros.tsx` (com `RecenciaPills`, `EmpreendimentoMultiSelect`, `MotivoDescartesPills`)
  - `disparo/TabMensagem.tsx`
  - `disparo/FunilLateral.tsx`
  - `disparo/useAudienceState.ts` (hook com estado + preview automático)
- `supabase/functions/reengajamento-audience-preview/index.ts` — adicionar breakdowns.

Nenhuma mudança na lógica de dedup, disparo, throttle ou nas edges de execução (`reengajamento-descartados-enqueue`, `whatsapp-campaign-dispatch`). Só na experiência de **selecionar** o público e **visualizar** o funil.

## O que não muda

- Regras de segurança (blacklist, pause travada, cooldown).
- Multi-fonte com dedup por telefone.
- Templates Meta e imagem de header por template.
- Fluxo de "Preview → Confirma → Fila cria → Micro-lotes".

## Ordem sugerida de implementação

1. Backend: enriquecer o preview com os 3 breakdowns.
2. Frontend: quebrar o arquivo grande em subcomponentes (sem mudar UI).
3. Frontend: introduzir as 3 abas + funil lateral, migrando os campos existentes.
4. Frontend: adicionar recência pills + empreendimento multi-select + motivo do descarte.
5. Frontend: recálculo automático da preview (debounce).
6. Frontend: alerta "você acabou de disparar esse template ontem".

Cada passo é entregável isolado e testável.