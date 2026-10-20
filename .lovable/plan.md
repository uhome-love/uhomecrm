# Repassar lead para a Gabrielle (diretora) pelo botão "Repassar"

## Por que não aparece hoje
O botão "Repassar" do card no Pipeline só lista quem está no cadastro de equipes (corretores ativos). A Gabrielle não está nesse cadastro (o perfil dela é de gestão), então ela não aparece na lista. A Fila CEO já resolve isso; o botão do Pipeline não.

## O que vai mudar
1. A lista do "Repassar" passa a mostrar uma seção **Gestão** no topo: Lucas (CEO), Gabrielle (Diretora) e os gerentes ativos, com o cargo ao lado. Embaixo, os corretores como hoje.
2. Ninguém aparece duas vezes.
3. A ação de repassar continua igual (troca o dono, aceite automático, registro no histórico).

## Lead Maguinóres Pereira
Depois da mudança publicada, você mesmo repassa pelo botão. Se preferir, eu repasso agora direto para a Gabrielle, no mesmo padrão do botão (dono = Gabrielle, aceito, anotação "Lead repassado para Gabrielle Rodrigues").

## Detalhes técnicos
- Arquivo: `src/components/pipeline/PipelineTransferDialog.tsx`.
- Segunda consulta em `profiles` (`ativo = true`, `cargo in ('admin','gerente','diretor','diretora')`), unida à de `team_members` com dedup por `user_id` (gestão tem prioridade), excluindo o dono atual. Rótulos CEO/Diretora/Gerente, mesmo padrão do `FilaCeoRepassarDialog`.
- Sem migration, sem mudança de Roleta/distribuição.

## Validação
Abrir o menu do card de um lead de teste → Repassar → conferir Gabrielle na seção Gestão → Cancelar.
