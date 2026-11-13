# Lead Rosa Silva Souza: por que saiu do Roni e foi para a Luiza

## O que aconteceu (conferido no banco)
- 08/11: Rosa entrou e foi aceita pelo **Roni Klusener**.
- 10/11: Roni registrou contato ("Está doente, pediu para retornar em mais dias") e moveu para **Qualificação**.
- 13/11 17:56: ela respondeu **"Sim! Gostaria de ir amanhã"** ao disparo `openarvoredo_convite`.
- O sistema tratou como lead "para reengajar": tirou de Qualificação, voltou para **Novo Lead**, cancelou a tarefa do Roni e mandou para a **Fila do CEO**.
- 18:19: a Fila do CEO distribuiu para a **Luiza Clós**, que aceitou.

**Roni NÃO descartou e o lead NÃO estava estagnado.** O erro foi do sistema.

O mesmo erro aconteceu hoje com mais um lead:
- **Augusto Rafael**: estava em Sem Contato com a **Patricia Villanova** e foi para a **Géssica Santos**.

## Causa
Quando o cliente responde SIM, o sistema decide pelo tipo de lista do disparo. Para listas de descartados/antigas, ele manda direto para a Fila do CEO **sem conferir se o lead já está ativo com um corretor**. A regra combinada é: lead ativo fica com o dono, que recebe aviso e a tela de bloqueio.

## Correção
1. **Regra:** antes de mandar para a Fila do CEO, conferir se o lead está ativo (fora de Descarte, sem arquivo). Se estiver ativo com corretor, ele fica com o dono e na mesma etapa, sem cancelar tarefas, e o dono recebe sino + push + tela de bloqueio. A Fila do CEO continua recebendo só descartados ou leads sem dono.
2. **Devolver os 2 leads:** Rosa → Roni, Augusto → Patricia, na etapa anterior, com registro no histórico explicando a devolução e aviso para o corretor. Luiza e Géssica recebem aviso de que o lead voltou ao dono original.
3. **Conferir** se houve outros casos nos últimos 30 dias e listar para você decidir antes de mexer.

## Detalhes técnicos
- `reativar_lead_para_fila_ceo`: no início, se `arquivado=false`, etapa ≠ Descarte, `motivo_descarte` nulo e `corretor_id` preenchido → retornar `already_active` sem alterar nada.
- `whatsapp-webhook` (ramo `else`, linha ~1041): ler `already_active`/`corretor_id` do retorno, como já faz nos ramos Base Única e Oferta Ativa, para notificar o dono e pular a Fila do CEO.
- Devolução pelos caminhos oficiais de troca de corretor (gatilho `reset_ciclo_reentrada` já trata parcerias), restaurando `stage_id` anterior; uma migração (dentro do limite diário) + ajuste de dados.
- Validação: simular SIM com lead de teste ativo e com lead de teste em Descarte; conferir ficha no computador e no celular.
