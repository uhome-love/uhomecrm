# Andressa Madril: finalizar descarte da carteira e inativar o usuário

## O que já está feito (verificado agora no banco)

A carteira dela já foi descartada em 07/08 — ela tem **0 leads ativos**. Os 300 leads no nome dela estão todos na etapa Descarte, porém **todos ficaram arquivados**.

Detalhe importante: **111 desses leads estão marcados como "reengajável" mas arquivados**. Arquivado significa "não recebe mais nada" — então hoje esses 111 estão fora da nutrição/reengajamento e fora da Oferta Ativa, quando deveriam estar disponíveis.

O login dela **continua ativo** (`ativo = true`), sem papel, sem equipe ativa, sem visitas futuras e sem negócios abertos.

## O que vou fazer

**1. Corrigir os 111 leads reengajáveis**
Tirar o arquivamento deles, mantendo-os na etapa Descarte com o motivo "Corretor desligado". Assim voltam a ser elegíveis para reengajamento e Oferta Ativa.
Os leads marcados como descarte definitivo (cliente pediu para não receber contato, respondeu NÃO no WhatsApp etc.) **continuam arquivados** — nenhum deles é reativado.

**2. Inativar a usuária**
Pela tela Meu Time (ação de inativar), que além de marcar o perfil como inativo encerra credenciamento de roleta e participações de Oferta Ativa (ela ainda aparece em 2 participações). O login não será excluído — só inativado, como pedido.

**3. Conferência ao vivo**
Depois de aplicar: conferir que ela aparece como Inativa em Meu Time, que a carteira segue zerada e que os 111 leads aparecem em Descarte reengajável (elegíveis para reengajamento).

## Detalhes técnicos

- Backup antes de tudo: tabela `_rollback_andressa_2026_08_12` com `id, arquivado, tipo_descarte, stage_id` dos leads afetados (reversível).
- Update de dados (sem migration): `pipeline_leads set arquivado = false` apenas onde `corretor_id = 42a7c59d-… and arquivado and tipo_descarte = 'reengajavel'`.
- Inativação: ação `inactivate_user` da função `create-broker-user` pela tela Meu Time (não é `delete_user` — sem exclusão de login, evitando o erro de FK histórica já mapeado).
- Nenhum lead é excluído; nenhuma alteração de schema.
