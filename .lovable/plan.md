# Homi Copiloto — Assistente inteligente do corretor (Fase 1)

## Visão
Um Homi no nível de um Claude/GPT que **conhece o CRM do corretor** e resolve as demandas do dia a dia por conversa natural **e** por **botões de acesso rápido**. Respostas curtas e bonitas (nada de textão), e toda ação real feita por **cartões visuais** com os mesmos campos das telas oficiais, validação completa e **histórico registrado no lead**.

## Princípios de UX (layout bonito e leve)
- Nada de respostas gigantes. O Homi responde curto e, quando a intenção é uma ação, mostra um **cartão** limpo (não um texto).
- **Barra de acesso rápido** fixa no topo do painel com as rotinas: `📋 Nova tarefa`, `🏠 Marcar visita`, `⏰ Meus atrasados`, `🔎 Buscar imóvel`, `💬 Mensagem WhatsApp`. Um toque já abre o cartão certo.
- Balões do assistente sem fundo pesado, tipografia clara, ícones por domínio, espaçamento generoso.
- Estados visuais: "pensando…" (shimmer), cartão de ação, cartão de resultado, sucesso com link.

## Botão flutuante — opções (você escolhe depois)
Hoje o launcher fixo às vezes atrapalha. Proponho, e recomendo combinar A+B:
- **A. Botão arrastável + reposicionável** — o corretor arrasta pra qualquer canto; a posição fica salva.
- **B. Modo recolhido / X** — um "×" recolhe o Homi num mini-ícone discreto (ou some por 1h); atalho `/` sempre reabre.
- **C. Só por atalho/menu** — remove o botão flutuante e deixa só a tecla `/` + um item no menu lateral.
- **D. Auto-ocultar** — o botão some quando um drawer/modal está aberto (já existe `launcherHidden`) e some ao rolar, reaparecendo ao parar.
Recomendação: **A + B + D**. Confirmo a escolha no início da Fase 1.

## O que o Homi entende e faz (Fase 1)

### 1. Ver o que está atrasado/pendente (leitura, direto)
Tarefas atrasadas, tarefas de hoje, visitas do dia, leads sem contato — em lista clicável (abre o lead/tarefa). Escopado ao corretor logado.

### 2. Criar tarefa (cartão com os MESMOS campos da Central de Tarefas)
Campos idênticos ao formulário atual (`LeadTarefasTab`): **lead** (busca por nome), **tipo** (Ligar/WhatsApp/Email/Follow-up/Proposta/Visita/Outro→tipo personalizado), **data** (com atalhos Hoje/Amanhã), **hora**, **observação**, **responsável**.
- Validação completa (client + server): data obrigatória, tipo personalizado obrigatório quando "Outro", limite de data futura (`isTaskDateTooFar`), lead válido.
- Grava em `pipeline_tarefas` com os mesmos campos (`pipeline_lead_id`, `tipo`, `titulo`, `descricao`, `vence_em`, `hora_vencimento`, `responsavel_id`, `created_by`).

### 3. Marcar visita (cartão com os MESMOS campos da agenda)
Campos idênticos ao `VisitaForm`: **cliente/lead**, **telefone**, **empreendimento**, **data**, **hora** (atalhos), **local** (stand/escritório/videochamada/decorado/imóvel/outro), **responsável pela visita**, **observações**.
- Validação completa (mesmo `FormErrors` do form oficial).
- Grava em `visitas` pelo mesmo caminho do agendamento inline (mantém a sincronização de status do pipeline).

### 4. Buscar imóvel (leitura, direto)
Busca no catálogo por critérios em linguagem natural ("2 dorm até 500k no Centro") e retorna cartões com dados principais + link.

### 5. Apoio no WhatsApp (só rascunho)
Homi gera a mensagem ideal usando o contexto do lead (etapa, empreendimento, histórico). Corretor copia. Não envia.

## Histórico no lead (obrigatório em toda criação)
Sempre que uma tarefa ou visita for confirmada, o Homi registra em `pipeline_atividades` (o que aparece na timeline do modal do lead), ex.: "📋 Tarefa criada via Homi: Ligar — amanhã 10h" / "🏠 Visita agendada via Homi: 15h no stand". Assim o modal do lead reflete tudo, igual às ações feitas pelas telas normais.

## Detalhes técnicos

### Backend — `homi-chat` (edge)
- Adicionar **function-calling** ao Lovable AI Gateway (`tools` + `tool_choice:auto`), mantendo system prompt, RAG e conhecimento de empreendimentos atuais.
- Tools: `ver_pendencias`, `buscar_imovel` (leitura — executam no edge com JWT do corretor, respeitam RLS) e `criar_tarefa`, `criar_visita` (retornam **proposta de ação** já normalizada em BRT; **não** gravam no edge).
- **Resolução de lead** por nome dentro do escopo do corretor; se ambíguo, devolve lista pra escolher (não adivinha).
- Reforçar o system prompt: respostas curtas, orientar sempre para a próxima ação, conhecer as capacidades do CRM.
- Datas/horas normalizadas em **BRT**.

### Frontend
- Novo `HomiActionCard.tsx`: renderiza os cartões de **tarefa** e **visita** (reaproveitando os mesmos inputs/validação dos forms oficiais) e as listas de **pendências** e **imóveis**.
- `HomiPanel.tsx`: nova **barra de acesso rápido** no topo, parsing dos blocos de ação no stream, layout compacto/bonito, e o comportamento do launcher (arrastar + recolher + auto-ocultar).
- **Confirmar** executa via os caminhos existentes → grava tarefa/visita → grava `pipeline_atividades` → invalida as queries da Central de Tarefas, agenda e modal do lead → toast com link. **Cancelar** descarta.
- Validação com zod nos cartões (mesmos limites dos forms) + validação server-side na criação.

### Segurança/regras
- Nada é criado sem confirmação (sua decisão).
- JWT validado no edge; leitura/escrita escopadas ao corretor logado; sem migrations novas (reusa `pipeline_tarefas`, `visitas`, `pipeline_atividades`, `imoveis_catalog/properties`, `pipeline_leads`).

## Fase 2 (depois)
- Criar lista personalizada na Oferta Ativa por linguagem natural.
- Enviar WhatsApp com 1 clique (janela 24h/templates).

## Validação final
No preview: pedir atrasados; criar tarefa (confirmar → aparece na Central e na timeline do lead); marcar visita (confirmar → aparece na agenda e na timeline); buscar imóvel; pedir mensagem de WhatsApp. Conferir campos idênticos aos forms oficiais, validações barrando entradas inválidas, histórico gravado, BRT correto e console sem erros.