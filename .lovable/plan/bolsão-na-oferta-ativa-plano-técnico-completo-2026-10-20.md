# Bolsão na Oferta Ativa: plano técnico completo

Formato definido: **um cliente por vez**, igual à Oferta Ativa de hoje. Não haverá pacote de leads.

## Como fica para cada pessoa
**Corretor**
1. Abre a Oferta Ativa e escolhe uma das portas: **Estagnados recentes**, **Descartados recentes** ou **Listas de leads**.
2. Escolhe um ou mais empreendimentos, ou **Aleatório**.
3. Recebe 1 cliente por vez, reservado só para ele por 5 minutos. Não vê o corretor anterior nem o histórico do lead.
4. Registra o resultado:
   - **Aproveitar**: o lead vai para o pipeline dele em "Novo Lead".
   - **Não atendeu**: o lead volta para a lista e fica 24h sem ser oferecido de novo.
   - **Sem interesse**: o lead vira descarte definitivo e sai da lista para sempre.

**Gerente**
- A página Leads Estagnados mostra só os leads dentro dos 7 dias de posse, com o contador "vai para o Bolsão em X dias".
- Depois desse prazo o lead some da página do gerente.

## Quem entra
- **Estagnados**: marcados como estagnados há mais de 7 dias.
- **Descartados**: reengajáveis ou sem classificação, descartados há entre 7 dias e 6 meses.
- Nas duas portas, **nunca entram**:
  - leads com visita registrada ou negócio criado;
  - descartes definitivos;
  - produtos da Fila CEO obrigatória (Lake Baikal);
  - leads que estão em um disparo de reengajamento pendente;
  - leads que têm o mesmo telefone de outro lead ativo.

## Ciclo do lead
- Se o lead aproveitado estagnar de novo, volta para o gerente por 7 dias e depois para o Bolsão.
- Se for descartado de novo, volta para Descartados depois de 7 dias.
- Não haverá placar próprio do Bolsão. Uma visita marcada com esses leads conta no placar normal da TV.
- Não haverá limite de aproveitamentos por corretor.

## Sintonia com as outras telas
- **Pipeline**: o lead aproveitado entra pelo mesmo fluxo de reativação da Oferta Ativa, já com o aceite feito e com bloqueio se o telefone estiver ativo com outra pessoa. A partir daí seguem as regras normais de tarefas e de cadência Sem Contato.
- **Oferta Ativa (listas)**: nada muda. A limpeza da base fria continua igual.
- **Central de Reengajamento**: um lead reservado ou aproveitado no Bolsão sai dos disparos. Um lead em disparo pendente não aparece no Bolsão.
- **Base Única**: o lead aproveitado aparece como em atendimento no CRM, como já acontece hoje.
- **Roleta, Fila CEO, VGV e Mutirão**: nada muda.

## Fases (cada uma validada antes da próxima)
1. **Prazo do gerente**: a página Leads Estagnados passa a mostrar só os 7 dias de posse, com o contador.
2. **Bolsão no servidor**: listas vivas de estagnados e descartados, o puxar 1 por vez com reserva, e os três resultados (aproveitar, não atendeu, sem interesse).
3. **Tela**: as 3 portas na entrada da Oferta Ativa, a escolha de empreendimento ou Aleatório e o cartão do cliente sem histórico.
4. **Histórico oculto**: depois de aproveitar, o novo dono vê só o que aconteceu a partir dali. Gestão e diretoria continuam vendo tudo.
5. **Validação ponta a ponta** com lead de teste, conferindo Pipeline, Reengajamento e Base Única, e depois apagando o teste.

## Detalhes técnicos
- Uma função de servidor calcula quem é elegível (sem tabela nova de leads): estagnados com `estagnado_em` há mais de 7 dias, ou descarte com `tipo_descarte` em (`reengajavel`, NULL) e `stage_changed_at` entre 7 dias e 6 meses; mais `negocio_id` vazio, sem linha em `visitas`, canônico fora de `roleta_config.fila_ceo_obrigatoria_canonicos`, sem item pendente em `reengajamento_dispatch_queue` e sem telefone duplicado ativo.
- Nova tabela `bolsao_reservas` (lead, corretor, reservado_ate, cooldown_ate, resultado) com GRANT e RLS. Funções com SECURITY DEFINER:
  - `bolsao_contagens(p_porta)`: contagem por empreendimento;
  - `bolsao_puxar(p_porta, p_empreendimentos text[])`: aleatório, com `FOR UPDATE SKIP LOCKED`, devolve só os dados sem histórico;
  - `bolsao_registrar(p_lead, p_resultado)`.
- "Aproveitar" chama uma edge function que reutiliza `_shared/reactivateLead.ts`, como faz `oferta-ativa-historico-reaproveitar`, e grava `reaproveitado_em` (nova coluna nula em `pipeline_leads`). Também limpa `estagnado`, `estagnado_em` e `arquivado`.
- `get_pipeline_estagnacao`: o braço `aguardando_decisao` passa a filtrar `estagnado_em >= now() - 7 dias` e devolve `bolsao_em`.
- Disparo de reengajamento (`reengajamento-descartados-enqueue` e a prévia de público): excluir leads com reserva ativa no Bolsão.
- Histórico oculto: filtrar atividades, anotações e histórico anteriores a `reaproveitado_em` quando o usuário é o corretor dono (servidor e drawer do lead).
- Regras do projeto: no máximo 2 migrations por dia em horário comercial (agendar fora do expediente se passar disso), sem sobrecarga de funções e sem `as any`.
