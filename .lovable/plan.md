# Cadência Sem Contato na Agenda — registrar concluindo a tentativa

## O que o fluxo faz hoje (verificado no código e no banco)

1. Cada lead em **Sem Contato** tem uma cadência de 7 tentativas (`lead_cadencia_sem_contato` + `cadencia_sem_contato_passos`: T1 Ligar agora → T2 WhatsApp (6h) → T3 Insistir (24h) → T4 Novidade (24h) → T5 Convite pra visita (48h) → T6 Última ligação (48h) → T7 Despedida (72h)).
2. Cada tentativa vira um lembrete em `pipeline_tarefas` com `origem = 'cadencia_sem_contato'`.
3. Na Agenda, esses lembretes **não** entram na aba Lembretes: viram o bloco "X leads da cadência Sem Contato" no fim de Prioridades.
4. O botão ⚡ Registrar do bloco abre o mesmo modal de atividade, **sem** informar qual tentativa está sendo concluída.
5. O banco já faz o avanço sozinho: ao inserir a atividade, o gatilho `fn_cadencia_sc_avancar_acao` conclui o lembrete pendente da cadência, sobe `tentativa_atual`, agenda o próximo lembrete e avisa o corretor.

## Os 3 buracos reais

**1. "Presencial" não conta como tentativa.** O gatilho só avança com `ligacao, whatsapp, contato, mensagem, email, retorno, nao_atendeu, reuniao, visita`. O modal oferece **Presencial**, que fica de fora: o corretor registra, o lembrete continua pendente e a cadência não anda. (`nota` ficar de fora é correto — não é tentativa.)

**2. O lead não sai do bloco.** A fila considera "tentativa devida" tudo com `vence_em <= hoje`, ignorando a hora. Como T2 vence 6h depois (mesmo dia), o lead volta pro bloco na hora seguinte ao registro — parece que nada aconteceu.

**3. Falta o passo "falei com o lead → tira de Sem Contato".** O modal tem o seletor de etapa à frente, mas ele é genérico e discreto; no contexto da cadência a ação natural (atendeu → Qualificação) não está evidente, então o lead segue na cadência mesmo depois de responder.

## O que muda

### Bloco da cadência (Agenda › Prioridades)
- Cada linha passa a mostrar **qual tentativa está devida** e a ação do passo: "T3 de 7 · Insistir no contato", além do "última atividade · X dias" que já existe.
- O ⚡ Registrar passa a abrir o modal **em modo conclusão da tentativa**, com o id do lembrete da cadência. Assim o lembrete é fechado mesmo quando o tipo escolhido não avança a cadência, e existe o botão "Só concluir" (não consegui falar, não carimba toque).
- Subtítulo do modal no contexto: "Tentativa 3 de 7 — Insistir no contato".

### Registrar atendeu → sai de Sem Contato
- No modo cadência, o modal ganha uma linha destacada acima do seletor de etapa: **"Falou com o lead?" → botão "Mover pra Qualificação"** (etapa seguinte real do pipeline). Marcado, o Concluir registra a atividade, conclui o lembrete e move o lead. A cadência para de gerar tentativas porque o lead deixa a etapa Sem Contato.
- Nada é obrigatório: quem só tentou e não falou, registra e segue.

### Sair do bloco após registrar
- O lead registrado sai do bloco na hora (mesma auto-dispensa por 24h já usada nos cards de prioridade) e o contador do bloco cai.
- A fila passa a respeitar a **hora** do lembrete: tentativa de hoje só entra no bloco depois da hora marcada. Fim do "T2 reaparece no mesmo minuto".

### Presencial conta como tentativa
- Incluir `presencial` na lista de tipos que avançam a cadência, no gatilho `fn_cadencia_sc_avancar_acao`.

## Detalhes técnicos

- `src/hooks/useFilaDoDia.ts`: `cadenciaDueLeadIds` vira um mapa `lead_id → { tarefa_id, titulo, vence_em, hora }`; filtro de devido passa a ser `vence_em < hoje OR (vence_em = hoje AND hora_vencimento <= agoraBRT)`. `LeadFila` ganha `cadencia?: { tarefa_id, tentativa, total, acao }` (tentativa/ação lidas do título/descrição do lembrete, sem query nova).
- `src/pages/AgendaCorretor.tsx`: `CadenciaBloco` renderiza o rótulo da tentativa; `onRegistrar` passa `concluirTarefaId` e `subtitulo`; `onSaved` chama `dispensarLead(id)` + `invalidar()`, igual aos cards de prioridade.
- `src/components/pipeline/RegistrarAtividadeModal.tsx`: nova prop opcional `sugerirEtapa?: { id, nome, label }` que renderiza o atalho "Falou com o lead? → Mover pra {etapa}" ligado ao `etapaAlvo` já existente. Sem mudança no fluxo de salvamento.
- Migration (1, aditiva, só função): `CREATE OR REPLACE FUNCTION public.fn_cadencia_sc_avancar_acao()` com `presencial` nas duas listas de tipos. Sem DDL de tabela, sem mudança de RLS.

## Fora de escopo
- Mudar os 7 passos, esperas ou canais da cadência.
- Mexer na Central de Leads Estagnados ou no descarte T7.
- Trazer os lembretes de cadência pra aba Lembretes.
