# Trazer o Eliézer Clós de volta com a carteira que ele tinha no desligamento

## O que encontrei
- O desligamento foi em **16/11 às 15h38** (horário de Brasília), feito pelo seu usuário.
- Naquele minuto, **502 leads** saíram do Eliézer e foram para o **Bruno Schuler**:
  - **64 ativos:** 55 em Atendimento, 5 em Aquecimento e 4 em Ganho.
  - **438 já arquivados ou descartados**, que fazem parte do histórico dele.
- Desde então, o Bruno não registrou nenhuma atividade nesses leads.
- Hoje o cadastro do Eliézer está inativo e, na equipe do Bruno, ele aparece como inativo. O papel dele continua sendo de corretor.

## O que vou fazer
1. **Montar a lista exata:** os 502 leads que mudaram no momento do desligamento, mais os que mudaram de novo logo depois. Por exemplo, os 2 que receberam o selo "Era do Eliézer" às 15h47. Antes de devolver, te passo o total final.
2. **Liberar o acesso:** o cadastro e o login dele voltam a funcionar, com a mesma senha.
3. **Voltar para a equipe do Bruno:** ele volta a aparecer como ativo na equipe.
4. **Devolver os leads ao Eliézer:** cada lead fica do jeito que estava naquele dia. Os ativos continuam ativos, na mesma etapa, e os arquivados continuam arquivados. O selo "Era do Eliézer · decidir" sai da carteira do Bruno.
5. **Vendas e VGV:** os 4 leads em Ganho voltam para o nome dele. A venda continua contada uma única vez.
6. **Roleta:** não coloco o Eliézer na Roleta automaticamente. Ele se credencia normalmente, pelas regras de visitas e de CRM.

## Como vou validar
- No computador e no celular, conferir que o login dele funciona e que os 64 leads ativos aparecem na carteira dele.
- Conferir que a carteira do Bruno não mostra mais esses leads nem a lista "Herdados para decidir" do Eliézer.

## Detalhes técnicos
- Lista base: pipeline_leads com updated_at no minuto do audit inactivate_user (2026-11-16 18:38 UTC) e corretor_id = Bruno, mais os leads com herdado_de_corretor_id = Eliézer.
- O update grava corretor_id = cd3bd7ae…, limpa herdado_* e não altera arquivado nem stage_id, para não disparar a reentrada.
- profiles.ativo=true, team_members.status='ativo' e login reativado pela mesma ação de reativar usuário do painel.
- Faço só alteração de dados, sem migration.
