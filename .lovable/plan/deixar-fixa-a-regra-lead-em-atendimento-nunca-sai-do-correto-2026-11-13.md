# Deixar fixa a regra: lead em atendimento nunca sai do corretor por disparo

Os 12 leads antigos ficam como estão. A correção do sistema já está no ar. Este plano deixa a regra registrada e protegida para que ninguém a desfaça no futuro.

## O que será feito
1. **Registrar a regra na memória do projeto:** se um lead em atendimento com um corretor responder SIM a qualquer disparo (qualquer lista ou modelo), ele fica com o mesmo corretor, na mesma etapa e com as tarefas mantidas. O corretor recebe aviso no sino, notificação no celular e a tela de bloqueio. A Fila do CEO recebe só descartados, arquivados e leads sem corretor.
2. **Registrar a regra nas instruções técnicas do projeto**, para que qualquer mudança futura no reengajamento siga a mesma regra.
3. **Criar uma verificação automática** que simula o SIM com um lead de teste em atendimento (precisa continuar com o dono) e com um lead de teste em Descarte (precisa ir para a Fila do CEO). Depois de rodar, os dados de teste são apagados.

## Detalhes técnicos
- Memória: `mem://features/whatsapp/reengajamento-resposta-routing`. A regra existente ("SIM vai para a Fila do CEO") será atualizada com a exceção do lead ativo, e a linha do índice também.
- AGENTS.md: a regra fica na função `reativar_lead_para_fila_ceo`, que retorna `already_active` para lead ativo com corretor. Os webhooks precisam respeitar esse retorno em todos os caminhos (Base Única, Oferta Ativa e lead do pipeline).
- Teste SQL/Deno executado contra a função, com limpeza no final.
