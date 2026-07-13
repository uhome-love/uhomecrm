# Reengajamento — Análise crítica + roteiro de qualificação

Diagnóstico feito lendo o código (7 componentes, 3.700+ linhas) e capturando a UI ao vivo em desktop (1280px) e mobile (390px), nas 4 abas.

## 1. Diagnóstico visual (o que está fraco hoje)

**Disparo manual**
- No desktop o formulário é uma coluna única estreita com metade da tela vazia à direita — desperdício grave de espaço. Deveria ser 2 colunas (público/filtros | template/preview/ação).
- A ação principal fica confusa: o botão grande "Faça o preview primeiro" aparece desabilitado e cinza, enquanto o "Calcular público" (o passo real) é discreto. O fluxo calcular→disparar não guia o olho.
- Campos de data nativos em formato `mm/dd/yyyy` (americano) — quebra o padrão BRT/pt-BR do projeto.
- Checkbox "Incluir arquivados" é `<input type=checkbox>` cru, fora do design system (resto usa shadcn).
- URL da imagem do header exposta crua num input longo — poluição visual.
- Excesso de textos `10px/11px` — legibilidade e acessibilidade ruins.

**Nutrição**
- Boa estrutura, mas só permite ligar/desligar passo a passo. Falta o "ativar um fluxo inteiro" com 1 clique (o pedido original: "escolher uma nutrição para ativar").
- A chave mestra avisa "lembre de desligar", mas nada desliga sozinho — risco operacional. Falta salvaguarda (auto-desligar após processar, ou timer).

**Ao vivo**
- Conteúdo redundante: "Respostas recebidas hoje" aparece 2x (bloco fixo no topo + collapsible logo abaixo). IA confusa.
- A tabela de disparos **estoura horizontalmente no mobile** (colunas cortadas, ilegível). Sem layout de cards responsivo.
- Muitos "Falha" nos disparos recentes sem destaque de saúde de entrega no topo — informação crítica escondida.

**Configurações**
- Contém controles do **motor automático** (Ativo, janelas de horário, limite diário, lookback, "Retomar disparo") que contradizem a diretriz "100% manual". Sobra de automação = confusão.
- "Saúde do número" aparece vazia (`Qualidade: —`) sem estado de carregando/erro claro.
- Mistura tudo num scroll gigante: instância, saúde, melhor lista, config, histórico.

**Mobile (geral)**
- Popup do HOMI AI sobrepõe o CTA inferior.
- Formulários muito longos + datas nativas + tabela que vaza.

## 2. Diagnóstico de código (dívida técnica)

- **Arquivos gigantes** violando as regras do projeto (>500/800 linhas): `ReengajamentoTab` 1.279, `DisparoCustomizadoCard` 773, `AuditoriaWebhookTab` 648.
- **`as any` proibido em código novo**: 56 ocorrências (32 só no ReengajamentoTab) — tabelas sem tipagem (`reengajamento_config as any`, `blocked_templates as any`).
- **Cores hardcoded** violando o design system: 217 ocorrências (`text-indigo-600`, `bg-white`, `text-red-700` etc.), várias sem variante dark → quebram no modo escuro (ex.: `RespostasRecebidasHoje` usa `bg-white`/`text-red-700` fixos).
- **`confirm()`/`alert()` nativos** (6 usos) em vez de AlertDialog — visual amador e não temável.
- **Lógica duplicada**: `classifyText` replicado no front espelhando o backend (whatsapp-webhook) → risco de divergência silenciosa.
- Queries inline espalhadas, query-keys soltas, sem hooks compartilhados (`useReengajamento`).

## 3. Roteiro de qualificação (proposto, por fases)

**Fase 1 — UI/UX de alto nível (impacto visual imediato)**
- Reconstruir "Disparo manual" em grid 2 colunas no desktop (público+filtros | template+preview+disparar), coluna única no mobile.
- Barra de ação fixa/destacada: `Calcular público` → mostra contagem → `Disparar` habilita só após preview, com resumo do que vai ser enviado (canal, base, template, nº leads).
- Trocar datas nativas por date picker localizado pt-BR; checkbox cru → shadcn `Checkbox`.
- Padronizar tipografia (mínimo `text-xs`), esconder URL da imagem atrás de "avançado".

**Fase 2 — Aba Ao vivo profissional**
- Remover a duplicação de "Respostas recebidas hoje".
- Card de **Saúde de entrega** no topo (enviados/entregues/lidos/falhas + % e alerta se falha alta).
- Tabela → layout responsivo (cards no mobile) com scroll/colunas fixas no desktop.

**Fase 3 — Nutrição acionável**
- Botão "Ativar fluxo inteiro" por cadência (liga todos os passos de uma vez) + salvaguarda de auto-desligar a chave mestra após o processamento.

**Fase 4 — Limpeza da aba Configurações**
- Remover/ocultar os controles do motor automático incompatíveis com o modo manual; manter só instância, templates, saúde do número e histórico, em seções colapsáveis.

**Fase 5 — Saúde do código (sem mudar comportamento)**
- Quebrar os 3 arquivos grandes em subcomponentes (<300–400 linhas).
- Extrair hooks (`useReengajamentoAudience`, `useNutricao`, `useDispatchRuns`) e tipar as tabelas para eliminar `as any`.
- Substituir cores hardcoded por tokens semânticos (corrige dark mode) e `confirm()` por `AlertDialog`.
- Centralizar `classifyText` num único módulo compartilhável.

### Notas técnicas
- Nada aqui altera regras de disparo/negócio nem o gate manual (`campaign_dispatch_enabled`) — Fases 1–4 são frontend; Fase 5 é refactor sem mudança de comportamento.
- Tokens já existem em `index.css`/`tailwind.config.ts`; a migração de cores usa `primary/muted/destructive/emerald` via variantes.

Posso implementar tudo em sequência ou só as fases que você priorizar. Recomendo começar pela Fase 1 (maior ganho visual) e Fase 2.
