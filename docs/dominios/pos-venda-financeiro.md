# Domínio 8 — Pós-venda & Financeiro

## 1. Propósito
Gerenciar o ciclo pós-fechamento: negócios em fase de venda, oportunidades, intermediações, pagadorias (comissões), pós-venda (NPS/indicação).

## 2. Tabelas
- `negocios` (35 col, 5 policies) — venda associada a lead:
  - `pipeline_lead_id, lead_id, corretor_id, gerente_id, auth_user_id, equipe_gerente_auth_id`
  - Comerciais: `empreendimento, unidade, imovel_interesse, proposta_imovel, proposta_valor, proposta_situacao`
  - Financeiro: `vgv_estimado, vgv_final, data_assinatura`
  - Estados: `fase, fase_changed_at, status, requer_aprovacao_ceo, construtora`
  - Negociação: `negociacao_situacao, negociacao_contra_proposta, negociacao_pendencia, documentacao_situacao`
  - Matching: `lead_id_proposto, lead_id_match_metodo, lead_id_match_score`
- `negocios_atividades`, `negocios_tarefas`
- `oportunidades` (14 col) — pipeline separado para pós-vendas/indicações
- `pos_vendas` (12 col) — NPS + indicações pós-fechamento
- `pagadorias` (21 col) — pagamento por corretor
- `pagadoria_solicitacoes` (22 col, 3 policies) — cliente sobe docs (RG, CPF, comprovante, ficha) → status → PDF contrato
- `pagadoria_credores`, `pagadoria_config`
- `intermediacoes` (13 col) — permuta/intermediação
- `venda_comissoes`, `pipeline_comissoes`, `comissao_faixas`

### RLS
- `negocios`: diretor lê tudo, admin/gestor deleta, users insert/update, `negocios_select_scoped` (por hierarquia)
- `pagadoria_solicitacoes`: solicitante vê o próprio; admin/backoffice atualiza

## 3. Fluxo
```
Visita realizada → trg_lead_to_negocio_on_visita_realizada → INSERT negocios
                                                                 │
                                                                 ▼
UI /negocios (drawer/kanban) atualiza fase manualmente:
   nova → proposta → aprovacao_bancaria → doc → assinado → vendido
   ↓
trg_negocio_fase_changed (BEFORE UPDATE): stamp fase_changed_at, histórico
trg_sync_lead_stage_on_venda (AFTER): quando fase='vendido' e data_assinatura setada
       → move pipeline_leads para stage "Ganho"
       → trigger cleanup em pipeline (trg_cleanup_desatualizado_on_venda)
trg_stamp_negocio_equipe_gerente: preenche equipe_gerente_auth_id via team_members
trg_set_negocios_auth_user_id: normaliza corretor_id → auth_user_id

VGV assinado = fase='vendido' + data_assinatura no mês  (mem)

Pagadoria:
UI /pagadorias → cliente/corretor sobe docs em pagadoria_solicitacoes
      → gerar-intermediacao (edge fn) monta contrato PDF
      → backoffice aprova (status)
      → pagadorias registra pagamento

Comissões:
venda → pipeline_comissoes / venda_comissoes calculadas por comissao_faixas
```

## 4. Componentes/hooks
- `src/pages/PosVendas.tsx`, `ComissoesPage.tsx`, `PagadoriaSolicitacoes.tsx`, `CadastrosPage.tsx`
- `src/components/pagadorias/PagadoriaConfigModal.tsx`, `CompradorDocUpload.tsx`
- `src/components/pdn/*` (relacionado a PDN do Gestor — mem)
- Hooks: `useNegocios`, `useNegocioActions`, `useNegociosCount`, `usePagadoriaConfig`, `useBackofficeData`

## 5. Edge Functions
| Fn | Faz |
|---|---|
| `gerar-intermediacao` | Monta PDF de intermediação |
| `stalled-deals-notify` | Cron alerta negocios parados |
| `generate-monthly-report` | Fecha mês (VGV, comissão) |

## 6. Regras não óbvias
- **VGV assinado só conta `fase='vendido' + data_assinatura no mês`** (mem://features/negocios/vgv-assinado-fase-vendido). Nunca só data_assinatura.
- **`corretor_id = profiles.id` em negocios** (pitfall: mem://arquitetura/database/negocios-id-mapping-pitfall). Use `auth_user_id` para joins com auth.
- **Fallback: `vgv_final → vgv_estimado`** se final não preenchido.
- **`requer_aprovacao_ceo`** boolean para negocios acima de X (não achei threshold hard-coded).
- **`lead_id_match_metodo` / `lead_id_match_score`**: quando trigger tenta ligar negócio a lead automaticamente e há incerteza.

## 7. Decisões
- Contra-uso de tabela separada `negocios` em vez de manter tudo em `pipeline_leads`: mem://features/pipeline/negocio-como-etapas-pipeline diz que "Ganho não é coluna" — mas `negocios` é a tabela por trás.
- PDN (Plano de Negócios do Gestor) em `pdn_entries` liga a visitas realizadas + fases de negocios (mem://features/gerente/pdn-plano-de-negocios).

## 8. Dependências
Consome: `pipeline-funil`, `visitas`. Produz para: `gestao-lideranca` (dashboards CEO/gerente), `admin-seguranca` (audit).

## 9. Perguntas
1. `oportunidades` (14 col) vs `negocios` (35 col) vs `pos_vendas` — 3 tabelas para o que parece o mesmo domínio comercial. Diferença clara?
2. `intermediacoes` — quantas na base? Usada ativamente?
3. `requer_aprovacao_ceo` — como o CEO aprova? Não achei tela.
4. `pagadorias` (21 col) vs `pagadoria_solicitacoes` (22 col) — separação clara?
5. `pipeline_comissoes` vs `venda_comissoes` — coexistem. Qual manda?
6. `pos_vendas` — NPS/indicações capturados? Volume?
