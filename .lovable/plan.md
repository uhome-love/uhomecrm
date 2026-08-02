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

### 4. Memória e personalização
- **Memória do corretor** — jeito de escrever, produtos que domina, meta do mês, horários de trabalho. Ele para de perguntar as mesmas coisas toda vez.
- **Perfil vivo do cliente** — o que já foi conversado sobre aquele lead aparece em qualquer thread, sem o corretor ter que recontar.
- **Editável e apagável** — uma tela "O que o HOMI sabe de mim", onde o corretor corrige ou apaga qualquer memória.

### 5. Ações de verdade (não só texto)
- **Executa por mim** — criar tarefa, agendar visita, mover etapa, gerar mensagem de WhatsApp: o HOMI monta e mostra o que vai fazer, o corretor aprova num clique, com "desfazer" logo depois. Nada sai sem aprovação.
- **Modo condução** — o HOMI toca o dia inteiro, um lead por vez (estilo Modo Foco com a IA junto): contexto, sugestão, ação, próximo.
- **Anexos** — colar print de conversa, PDF de proposta ou tabela de preços e o HOMI lê e responde em cima daquilo.

### 6. Inteligência sobre o histórico do CRM
- **"Por que eu perdi?"** — padrões de descarte, no-show e sumiço do corretor e do time, com o que mudar.
- **Previsão de fechamento** — quais leads têm mais chance de virar venda neste mês e por quê, para priorizar o dia.
- **Simulação de financiamento no chat** — usando o simulador que já existe, com o PDF pronto para mandar.
- **Comparação com a média do time** — sempre no tom de "o que fazer", nunca de exposição.

### 7. Voz — falar com o HOMI e ouvir a resposta
- **Ditado:** microfone no composer; a fala do corretor vira texto e entra na conversa. Serve para quem está no carro, entre visitas.
- **Ouvir a resposta:** botão de play em cada mensagem, com áudio em streaming (começa a falar antes de terminar de gerar).
- **Modo mãos-livres:** conversa contínua — fala, o HOMI responde em voz e volta a ouvir, com botão de parar sempre visível, e dá para interromper falando por cima.
- **Briefing em áudio de ~60s** — para ouvir a caminho do primeiro compromisso.
- Voz em português, natural, tom de colega de time. O áudio não é armazenado.

### 8. Segurança e verdade
- Corretor vê só o dele; gestor, a equipe; CEO, tudo — reaproveitando as regras de acesso já existentes.
- Toda métrica sai das fontes canônicas (nada de número inventado). Sem dado, o HOMI diz que vai confirmar.
- **Fonte visível** — toda resposta com número mostra de onde veio e o período, e leva para a tela real com um clique.
- **Botão "não é isso"** — registra a falha e alimenta o painel de qualidade, para o HOMI melhorar com uso.
- Preço, estoque e condição sempre do sistema, nunca de memória.

### 9. O dia real do corretor (mobile, rua, WhatsApp aberto)
- **Mobile-first:** `/homi` em uma coluna, painel vivo como aba, microfone grande no alcance do polegar.
- **Internet ruim:** a mensagem digitada fica em fila e sobe quando a rede volta; nada se perde.
- **Enviar no WhatsApp:** toda resposta útil (script, mensagem, ficha de imóvel) tem botão "enviar no WhatsApp" já com o lead escolhido.
- **Antes da ligação:** cartão de 20 segundos — quem é, o que quer, o que já foi falado, primeira frase pronta.
- **Depois da ligação/visita:** o corretor dita o que aconteceu; o HOMI escreve a observação, atualiza a etapa e cria a próxima tarefa (com aprovação).
- **Fim do dia:** fechamento de 1 minuto — o que fechou, o que ficou, o que já está agendado para amanhã.
- **Segunda de manhã:** plano da semana com meta e o que precisa acontecer para bater.
- **Fricção zero:** atalho global ⌘K / Ctrl+K, "continuar de onde parou", respostas rápidas sugeridas, fixar e renomear conversa.
- **Gestor e CEO:** "prepara meu 1:1 com o Fulano" (pauta com números e travas) e alerta silencioso de queda de performance, sempre em tom de conversa, nunca de punição.
- **Custo sob controle:** limite de uso por dia/usuário e leitura de consumo, para não estourar crédito sem ninguém ver.
- **Onboarding de 30s:** na primeira visita, 3 exemplos clicáveis do que pedir.

### 10. O HOMI como agente operacional (o que ele consegue fazer, não só dizer)
Tudo abaixo passa por aprovação em um clique, com desfazer, e respeita o escopo do papel.

**Lead e funil**
- Criar lead manual, atualizar telefone/e-mail/origem, corrigir empreendimento de interesse.
- Mover etapa e preencher o substatus certo (qualificação, aquecimento, negociação, contrato).
- Descartar com motivo, reativar lead parado, marcar "sem contato" e devolver para reciclagem.
- Registrar observação e atividade na timeline a partir do que foi ditado.

**Tarefas e agenda**
- Criar tarefa com data/hora e tipo, reagendar em lote ("empurra tudo de hoje para amanhã 9h").
- Concluir tarefa com observação e já criar a próxima (respeitando o fluxo de visita: confirmar → registrar resultado).
- Agendar, confirmar, remarcar e cancelar visita; registrar resultado da visita e rotear o lead conforme a regra atual.

**Comunicação**
- Escrever e enviar mensagem de WhatsApp pelo canal já existente (ou copiar, se preferir mandar do celular).
- Montar follow-up em lote personalizado por lead, com fila de aprovação item a item.
- Gerar e-mail/proposta em texto, script de ligação, quebra de objeção e roteiro de visita.

**Imóvel e proposta**
- Buscar imóvel por demanda (bairro, dormitórios, faixa, vaga, mobiliado) e montar seleção para enviar.
- Gerar link de vitrine personalizada para o cliente.
- Rodar simulação de financiamento e devolver o PDF pronto para mandar.
- Puxar material/apresentação/ficha do empreendimento no Hub e mandar o link certo.

**Rotina e análise**
- Briefing do dia, plano da semana, fechamento do dia.
- Diagnóstico de funil, leads parados, previsão de fechamento, "por que perdi".
- Relatórios de VGV, visitas e conversão com fonte clicável.
- Para gestor/CEO: pauta de 1:1, leitura do PDN, comparativo de equipes.

**Nunca sem pedir:** disparo em massa, exclusão de dados, mudança de responsável do lead, alteração de valor de venda/VGV — o HOMI prepara, quem decide é a pessoa.

### 11. Arquivos, imagens e voz — o que o modelo aceita
- **Recebe arquivo e imagem:** print de conversa, foto de tabela de preço, PDF de proposta ou ficha — o HOMI lê e responde em cima daquilo (entrada multimodal nativa do Gemini).
- **Recebe áudio:** o corretor manda ou grava um áudio e o HOMI transcreve e age.
- **Cria imagem quando faz sentido:** peça simples de divulgação a partir do imóvel (não substitui o designer) — usando o modelo de imagem do próprio gateway, sob demanda e nunca automático.
- **Fala e ouve:** conforme a seção 7.
- **Modelo:** `google/gemini-3.6-flash` como padrão (rápido, barato, aceita texto+imagem+PDF+áudio), `google/gemini-3.1-pro-preview` no "Aprofundar" para análise pesada, e modelos OpenAI dedicados só para voz (transcrição e leitura). É a melhor combinação disponível para este uso — a troca de modelo fica num único ponto do código, então dá para reavaliar depois com uso real.

### 12. Manual de uso (entregue depois da implantação)
Três manuais curtos e visuais, um por papel, com exemplos reais do CRM:
- **Corretor** — rotina do dia (briefing, antes da ligação, pós-visita, fim do dia), como pedir imóvel, como gerar follow-up, como usar voz no carro.
- **Gerente** — leitura do time, PDN, pauta de 1:1, onde o time trava, como cobrar com dado.
- **CEO** — resumo executivo, VGV e funil, comparativo de equipes, riscos da semana.
Formato: página dentro da Academia + PDF para baixar, com prints da tela e frases prontas para copiar.

## Fases (uma por vez, com validação no preview)


| Fase | Entrega |
| --- | --- |
| 1 | Tela `/homi` com threads, conversa, streaming, cartões e painel vivo. Pop-up desligado. |
| 2 | Botão contextual do HOMI nas páginas principais (tabela acima). |
| 3 | Ferramentas novas: leads parados com diagnóstico, follow-up em lote, relatórios com gráfico e fonte clicável. |
| 4 | Ações com aprovação e desfazer + Modo condução + anexos. |
| 5 | Coach de script/objeção + análise de conversa + "Aprofundar" com modelo de raciocínio. |
| 6 | Memória do corretor e perfil vivo do cliente, com a tela "O que o HOMI sabe de mim". |
| 7 | Inteligência de histórico: por que perdi, previsão de fechamento, simulação de financiamento, comparação com o time. |
| 8 | Voz: ditado, leitura em voz alta, mãos-livres e briefing em áudio. |
| 9 | Proatividade (briefing automático, alertas no botão) e painel de qualidade (👍/👎, "não é isso", perguntas sem resposta). |
| 10 | Ampliação do agente operacional (seção 10): agenda, comunicação, imóvel/proposta, rotina — tudo com aprovação. |
| 11 | Anexos e imagens (ler print/PDF/áudio; gerar peça simples) + rotina do dia real e ⌘K (seção 9). |
| 12 | Remoção do HOMI Ana (marketing). |
| 13 | Manuais de uso: Corretor, Gerente e CEO (Academia + PDF). |

## Detalhes técnicos

- Nova página `src/pages/HomiWorkspace.tsx` + rotas `/homi` e `/homi/:threadId` no `pageRegistry`; `HomiAssistant`, `HomiGerencial` e `HomiCeo` passam a redirecionar para ela (mesma IA, papel resolvido por `useUserRole`).
- `HomiContext` deixa de controlar o painel lateral e passa a expor thread ativa, envio, streaming e ações; `HomiPanel` é removido e `HomiHeaderButton` navega para `/homi`.
- Threads persistidas em `homi_conversations` (já existe) + tabela de mensagens por thread, com RLS por usuário; o `threadId` da URL é a fonte da conversa ativa.
- Backend continua em `homi-chat` (cérebro único `_shared/homi-brain.ts`): novas ferramentas em `homi-tools.ts` (`leads_parados_diagnostico`, `followup_em_lote`, `relatorio_metricas`, `analisar_conversa`), sempre com escopo por papel.
- Modelo padrão `google/gemini-3.6-flash`; "Aprofundar" usa `google/gemini-3.1-pro-preview` (constante já existente).
- Botão contextual: um componente único (`HomiPageAction`) alimentado por um mapa rota → prompt, encaixado nos cabeçalhos já padronizados (`PageHeader`).
- Voz: transcrição com `openai/gpt-4o-mini-transcribe` e leitura com `openai/gpt-4o-mini-tts` (SSE), ambos via Lovable AI numa edge function — a chave nunca vai para o navegador; o áudio não é gravado em banco nem storage.
- Memória: tabelas `homi_memoria_usuario` e `homi_memoria_lead` (RLS por dono), gravadas por ferramenta explícita do modelo e injetadas no prompt — nunca métrica, sempre preferência/contexto. Números continuam vindo das fontes canônicas.
- Ações com aprovação: toda ferramenta que escreve (`criar_tarefa`, `agendar_visita`, `mover_etapa`, `enviar_whatsapp`) exige confirmação na UI e registra em log com janela de desfazer; nada dispara sozinho.
- Anexos: imagem/PDF entram no chat como entrada multimodal do modelo; arquivos ficam em bucket privado com RLS por usuário.
- Fonte clicável: cada cartão de métrica carrega a RPC/período usados e uma rota de destino no CRM.
- Qualidade: `homi_feedback` (👍/👎, "não é isso", pergunta e resposta) alimentando um painel só para admin.
- Remoção do HOMI Ana: página `HomiAna.tsx`, rota e entrada no `pageRegistry`, item do `Sidebar`, atalho no `BackofficeDashboard`, `HomiIdeiasChat` do Marketing e a edge function `homi-ana`.
- Sem mudança nas telas de negócio (pipeline, PDN, performance) além do botão.

## Fora de escopo
- **LIA** — atendimento automático de leads (falar com o cliente, não com o corretor). É outro produto; plano próprio, depois que o HOMI estiver de pé.
- Qualquer alteração em regra de negócio, cálculo de VGV ou disparo de WhatsApp em massa.
