# Central de Disparos — ferramenta autônoma de campanhas WhatsApp

Refatorar o disparo que já existe (dentro da Central de Nutrição — sem página nova, sem duplicidade) numa ferramenta self-service de alta performance: trocar template em 2 cliques, escolher público (descartados, oferta ativa ou ambos), disparar com Pausar/Retomar/Parar e acompanhar relatório em tempo real. Sem refatorar código a cada campanha.

## O que JÁ funciona (reaproveitado, não recriado)
- Picker de **templates aprovados da Meta** dinâmico (`meta-templates-list`) — qualquer template novo aprovado aparece automaticamente, sem código.
- Envio via Graph API com imagem de cabeçalho + auto-retry sem header (#132018).
- Loop com throttle, janela de horário, dedup, **pausa ao vivo** (lê `config.paused` no meio do loop) e auto-pausa por qualidade Meta.
- `reengajamento_dispatch_runs` (status/enviados/falhas) + webhook gravando `delivered_at/read_at/responded_at/button_response` em `reengajamento_meta_disparos`.

## O que falta (o foco deste plano)
1. Público **"ambos"** (descartados + oferta ativa) com dedup por telefone.
2. Botões **Pausar (retomável) + Parar (encerra)** + **Retomar**.
3. **Relatório em tempo real** por campanha com KPIs de entrega.
4. Reorganizar a UI numa ferramenta limpa e dividir o arquivo grande.

## Implementação

### 1. Backend — público combinado + dedup (1 vez por telefone)
`reengajamento-audience-preview/index.ts` e `reengajamento-descartados-enqueue/index.ts`:
- Aceitar `audience.sources: string[]` (ex.: `["descartados","oferta_ativa_lista"]`), mantendo `source` único por compatibilidade.
- Construir cada fonte e **unir**, deduplicando pelos **últimos 8 dígitos** do telefone (regra canônica do projeto). Prioridade: descartados > oferta ativa (descartado vence em colisão).
- Preview retorna `funil` com contagem por fonte + `duplicados_removidos`.

### 2. Backend — Parar (encerrar) campanha
- Migração (1, DDL apenas): `ALTER TABLE reengajamento_dispatch_runs ADD COLUMN cancel_requested boolean NOT NULL DEFAULT false;`
- No loop do enqueue, na mesma iteração em que já lê `config.paused`, ler também `cancel_requested` da run atual. Se `true` → encerra com `status='cancelled'`, `motivo_parada='Parado pelo usuário'` e retorna.
- **Pausar** continua usando `config.paused=true` (loop encerra a run com `status='paused'`).
- **Retomar** = `config.paused=false` + re-invocar o enqueue com o mesmo `audience` (o `dedup_mode='exclude_sent'` pula quem já recebeu, continuando os restantes).

### 3. Frontend — refatorar `DisparoCustomizadoCard.tsx` (680 linhas → dividir)
Quebrar em componentes focados (regra de arquivo >500 linhas), todos dentro de `src/components/central-nutricao/`:

```text
CampanhaConsole.tsx        (orquestra: formulário + controles + relatório)
campanha/CampanhaForm.tsx  (canal, público, template, filtros, preview)
campanha/CampanhaControles.tsx  (Disparar / Pausar / Retomar / Parar)
campanha/CampanhaRelatorioVivo.tsx (KPIs em tempo real)
campanha/useCampanhaRun.ts (hook: run ativa + métricas, polling)
```
`ReengajamentoTab` passa a renderizar `CampanhaConsole` no lugar do card atual.

**Seleção de público (multi-fonte):** trocar o `Select` único por checkboxes/toggles:
- ☑ Descartados (com tipo: reengajáveis / definitivos / todos + incluir arquivados)
- ☑ Lista da Oferta Ativa (multi-seleção de listas)
- Marcar as duas = "ambos". Demais fontes (pipeline ativo, visita amanhã) seguem disponíveis.
- Envia `sources: string[]` no `buildAudience()`.

**Template (self-service):** mantém o picker dos templates aprovados da Meta + botão "Atualizar lista". Trocar de campanha = só escolher outro template aprovado. Mostra badges do template (categoria, tem botões, idioma). Imagem de cabeçalho puxada da config automaticamente.

### 4. Frontend — Controles ao vivo
`CampanhaControles` aparece quando há run `running`/`paused`:
- **Disparar** (estado inicial, exige preview > 0)
- **Pausar** → `config.paused=true` (retomável)
- **Retomar** → `config.paused=false` + re-invoca enqueue com mesmo audience
- **Parar** → `cancel_requested=true` na run (encerra, sem retomar) — com confirmação
Estado e botões derivados da run via polling (2s).

### 5. Frontend — Relatório em tempo real
`CampanhaRelatorioVivo` consulta `reengajamento_meta_disparos` pelo `run_id` da run ativa/última (polling 3–4s):
```text
Enviados | Entregues | Lidos | Respostas | SIM | NÃO | Falhas/Inválidos
Taxas: entrega %, leitura %, resposta %, opt-out %
Barra de progresso: enviados / total_alvo
Veredito automático: ✅ saudável | 🟡 atenção | 🔴 ruim
```
Critérios (ajustáveis): entrega ≥ 90%, leitura ≥ 50%, resposta ≥ 5%, falhas/inválidos < 5%, opt-out < 3%. Botão **Exportar CSV** da campanha.

## Fluxo final do usuário (sem pedir nada ao dev)
1. Criar/aprovar o template na Meta (Business Manager).
2. Central de Nutrição → Console de Campanhas: escolher Canal Meta, marcar público (Descartados e/ou Oferta Ativa), escolher o template aprovado, ajustar limite/throttle.
3. Preview → Disparar.
4. Acompanhar relatório ao vivo; Pausar/Retomar/Parar conforme necessário.
5. Repetir com qualquer template novo — zero código.

## Garantias / fora de escopo
- Nada move etapa do lead nem altera atribuição.
- Dedup por 8 dígitos garante que ninguém recebe 2x ao combinar fontes.
- Sem wrappers de rede; usa `@/integrations/supabase/client`. Tudo em BRT.
- Variáveis de template: apenas nome + imagem fixa (conforme definido). Templates com mais variáveis ficam para evolução futura.
- Sem nova rota/página — refatora a Central existente.

## Sequência de execução (após aprovação)
1. Migração `cancel_requested` em `reengajamento_dispatch_runs`.
2. Edge functions: multi-fonte + dedup + parada (deploy).
3. Refatorar card em `CampanhaConsole` + subcomponentes.
4. Controles Pausar/Retomar/Parar ligados à run.
5. Relatório ao vivo + export CSV.
6. Validar com um preview real e um disparo pequeno de teste.
