# HOMI Workspace — a IA de CRM em tela cheia

Hoje o HOMI é um pop-up lateral de 380px (`HomiPanel`) com 8 atalhos, 15 ferramentas de CRM e RAG do Método Uhome. O cérebro já é bom; a **tela** é que limita. O plano transforma o HOMI numa página completa de trabalho — nível ChatGPT/Claude, só que especialista no CRM e no Método Uhome — e espalha um gatilho contextual do HOMI em cada página.

## O que o usuário vai ver

### 1. `/homi` — a tela do HOMI (substitui o pop-up)
Layout de três áreas, igual às melhores IAs de mercado, mas com conteúdo de CRM:

```text
┌────────────┬───────────────────────────────┬──────────────┐
│ CONVERSAS  │        CONVERSA               │  PAINEL VIVO │
│ + Nova     │  mensagens em streaming       │  Briefing    │
│ Hoje       │  cartões (imóvel, lead,       │  Pendências  │
│ Ontem      │  tarefa, visita, gráfico)     │  Leads       │
│ 7 dias     │  ações inline (criar/enviar)  │  parados     │
│            │  ─────────────────────────    │  Visitas     │
│ Modo:      │  [ composer + anexos ]        │  hoje        │
│ Corretor / │  sugestões contextuais        │  Atalhos     │
│ Gerente /  │                               │              │
│ CEO        │                               │              │
└────────────┴───────────────────────────────┴──────────────┘
```

- **Threads persistentes** com URL própria (`/homi/:threadId`), renomear, fixar, apagar, busca. Recarregar a página volta na mesma conversa.
- **Painel vivo à direita** (não é chat): briefing do dia, tarefas atrasadas, visitas de hoje, leads parados — cada item vira um clique que já abre a conversa certa ("me ajuda com esses 4 leads parados").
- **Cartões acionáveis** dentro da conversa: imóvel com preview, lead com resumo 360, tarefa/visita com botão de criar e concluir, mensagem de WhatsApp com "copiar / enviar", gráfico de performance.
- **Streaming de verdade** + "pensando…", parar geração, regenerar, copiar, feedback 👍/👎 (alimenta a base de melhoria).
- **Modo por papel** (Corretor / Gerente / CEO) visível e trocável por quem tem permissão — mesma IA, lente diferente.
- Mobile: mesma tela em coluna única, com o painel vivo virando a primeira aba.

### 2. Botão HOMI em cada página (contextual)
Um botão pequeno e fixo no cabeçalho de cada página que **já sabe onde você está** e abre a tela do HOMI com a pergunta certa pronta:

| Página | O que o botão faz |
| --- | --- |
| Pipeline | "Diagnostica meu funil e me dá as 5 ações de maior impacto agora" |
| Detalhe do lead | "Me ajuda nesse atendimento" (contexto do lead já carregado) |
| Agenda de visitas | "Prepara minhas visitas de hoje e as confirmações" |
| Minhas tarefas | "Resolve minhas atrasadas comigo, uma por vez" |
| Imóveis / Vitrine | "Busca imóvel para a demanda de um cliente" |
| Performance / Relatórios | "Lê meus números e me diz o que mudar" |
| PDN / Meu time (gestor) | "Onde meu time está travando e o que cobrar hoje" |
| Dashboard CEO | "Resumo executivo da semana e riscos" |
| Oferta ativa / Ligação | "Quebra de objeção ao vivo" |
| Academia / Materiais | "Qual conteúdo eu preciso para essa situação" |

O pop-up lateral atual é **removido**; o botão do cabeçalho passa a levar para a tela.

### 3. Capacidades novas do cérebro
Além das 15 ferramentas atuais (pendências, buscar imóvel, briefing, criar tarefa/visita, resumo de lead, leads esfriando, preparar visita…):

- **Leads parados com diagnóstico** — não só a lista: por que parou, qual o próximo passo e a mensagem pronta.
- **Follow-up em lote** — "gera follow-up para esses 6 leads", cada um personalizado com nome, produto e último contato, com aprovação um a um antes de enviar.
- **Relatórios em linguagem natural** — VGV, visitas, conversão, comparação de períodos e de equipes pela fonte única (`rpc_metricas`/`v_fato_venda`), com gráfico no cartão.
- **Coach de script** — script de ligação, quebra de objeção e roteiro de visita ancorados no Método Uhome, citando o bloco (ex.: MU-09.3).
- **Análise de conversa** — cola o print/texto do WhatsApp e o HOMI diz temperatura, objeção real e a próxima mensagem.
- **Raciocínio profundo sob demanda** — botão "Aprofundar" troca para o modelo de raciocínio nas análises pesadas; o dia a dia continua rápido.
- **Proatividade** — o HOMI abre o dia com o briefing e sinaliza no botão quando há algo urgente (SLA estourando, visita sem confirmação, lead quente parado).

### 4. Segurança e verdade
- Corretor vê só o dele; gestor, a equipe; CEO, tudo — reaproveitando as regras de acesso já existentes.
- Toda métrica sai das fontes canônicas (nada de número inventado). Sem dado, o HOMI diz que vai confirmar.
- Preço, estoque e condição sempre do sistema, nunca de memória.

## Fases (uma por vez, com validação no preview)

| Fase | Entrega |
| --- | --- |
| 1 | Tela `/homi` com threads, conversa, streaming, cartões e painel vivo. Pop-up desligado. |
| 2 | Botão contextual do HOMI nas páginas principais (tabela acima). |
| 3 | Ferramentas novas: leads parados com diagnóstico, follow-up em lote, relatórios com gráfico. |
| 4 | Coach de script/objeção + análise de conversa + "Aprofundar" com modelo de raciocínio. |
| 5 | Proatividade (briefing automático, alertas no botão) e painel de qualidade (feedback 👍/👎, perguntas sem resposta). |

## Detalhes técnicos

- Nova página `src/pages/HomiWorkspace.tsx` + rotas `/homi` e `/homi/:threadId` no `pageRegistry`; `HomiAssistant`, `HomiGerencial` e `HomiCeo` passam a redirecionar para ela (mesma IA, papel resolvido por `useUserRole`).
- `HomiContext` deixa de controlar o painel lateral e passa a expor thread ativa, envio, streaming e ações; `HomiPanel` é removido e `HomiHeaderButton` navega para `/homi`.
- Threads persistidas em `homi_conversations` (já existe) + tabela de mensagens por thread, com RLS por usuário; o `threadId` da URL é a fonte da conversa ativa.
- Backend continua em `homi-chat` (cérebro único `_shared/homi-brain.ts`): novas ferramentas em `homi-tools.ts` (`leads_parados_diagnostico`, `followup_em_lote`, `relatorio_metricas`, `analisar_conversa`), sempre com escopo por papel.
- Modelo padrão `google/gemini-3.6-flash`; "Aprofundar" usa `google/gemini-3.1-pro-preview` (constante já existente).
- Botão contextual: um componente único (`HomiPageAction`) alimentado por um mapa rota → prompt, encaixado nos cabeçalhos já padronizados (`PageHeader`).
- Sem mudança nas telas de negócio (pipeline, PDN, performance) além do botão.

## Fora de escopo
- Trocar o HOMI Ana (marketing) e a LIA do atendimento externo.
- Qualquer alteração em regra de negócio, cálculo de VGV ou disparo de WhatsApp em massa.
