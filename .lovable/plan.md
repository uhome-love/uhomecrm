## Problema confirmado

Os 4 receivers de lead (`receive-meta-lead`, `receive-landing-lead`, `receive-imovelweb-lead`, `receive-rdstation-lead`) têm o mesmo bloco: quando o telefone/e-mail bate com um lead existente **que está em Descarte ou arquivado**, eles apenas movem o lead para **Sem Contato**, mantendo o corretor antigo (`corretor_id` inalterado, `aceite_status='aceito'`) e notificando esse corretor.

Confirmado no banco: os 8 leads citados (Lisandra, Valeria, Jhennifer, Matheus, Cheyenne, Marilene, Patrícia em Sem Contato; Lucia já movida para Qualificação) estão com `aceite_status='aceito'`, corretor preenchido e `stage_changed_at` de 29/07.

## Regra correta

- **Lead ATIVO no pipeline** (qualquer etapa fora de Descarte, não arquivado): comportamento atual mantido — nada muda de etapa/dono, só gera notificação + push + atividade "🔄 Novo interesse" para o corretor. Já funciona.
- **Lead em DESCARTE ou ARQUIVADO**: passa a voltar como **Novo Lead** e entra na **roleta**:
  - `stage_id` = Novo Lead, `stage_changed_at` = agora
  - `corretor_id` = null, `gerente_id` = null, `aceite_status = 'pendente_distribuicao'`
  - `arquivado=false`, `motivo_descarte`/`tipo_descarte`/`reengajamento_status` zerados
  - Observação/atividade registram o novo interesse e a origem
  - Chama a distribuição da roleta **excluindo o corretor que descartou**
  - Notificação do "lead reativado" NÃO vai mais para o corretor antigo (ele perdeu o lead); quem receber pela roleta recebe o aviso normal de novo lead
  - Se a roleta não encontrar corretor (fora de janela, sem credenciado), o lead fica em `pendente_distribuicao` e aparece na **Fila do CEO** (comportamento padrão de lead novo)

## Detalhes técnicos

1. **`supabase/functions/_shared/roleta-distribution.ts`** — `distributeLeadDirect` ganha parâmetro opcional `excludeAuthUserId`, repassado a `distribuir_lead_atomico(p_exclude_auth_user_id)` (a RPC já suporta).
2. **Novo helper `supabase/functions/_shared/reactivateDiscardedToRoleta.ts`** — concentra o update do lead + atividade + chamada da distribuição, para os 4 receivers usarem o mesmo caminho (hoje o bloco está duplicado 5x, contando o match por e-mail do meta).
3. **Atualizar os blocos `isDiscarded`** em:
   - `receive-meta-lead/index.ts` (match por telefone ~linha 604 e match por e-mail ~linha 900)
   - `receive-landing-lead/index.ts` (~linha 204)
   - `receive-imovelweb-lead/index.ts` (~linha 304)
   - `receive-rdstation-lead/index.ts` (~linha 292)
   Cada um: se `isDiscarded` → helper novo (roleta) e retorna `action: "reactivated_to_roleta"`; senão → fluxo atual de notificação.
4. **Log/observabilidade** — `ops_events` passa a registrar `lead_descartado_reenviado_para_roleta` com `lead_id`, `corretor_anterior`, resultado da distribuição.
5. **Exclusividade com Oferta Ativa** — ao voltar para o pipeline, remove o registro correspondente em `oferta_ativa_leads` (por telefone normalizado), conforme a regra de exclusividade já vigente.
6. **Correção retroativa dos 8 leads** — script pontual (data change, não migration) que, para esses IDs: limpa corretor/gerente, marca `pendente_distribuicao`, move para Novo Lead e dispara a distribuição excluindo o corretor anterior. Notifico o resultado lead a lead (quem pegou cada um / quem ficou na Fila do CEO).

## Validação

- Teste com lead sintético: criar lead em Descarte com corretor X → simular novo touch do receiver → conferir no banco `stage=Novo Lead`, `corretor_id` novo ≠ X, `aceite_status` coerente, atividade registrada.
- Teste do caminho ativo: lead em Qualificação recebe novo touch → confirmar que continua na mesma etapa e com o mesmo corretor, só com notificação.
- Conferência visual no Pipeline/Roleta no preview antes de declarar pronto.

## Fora de escopo

Nenhuma mudança de UI, de etapas do pipeline ou de regras de descarte manual.
