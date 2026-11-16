# Corretor que saiu: selo no lead + VGV preservado como histórico

## O que já conferi
- **Billy John** está inativado e ainda tem **258 leads** em nome dele (cerca de 21 em etapas ativas). Ou seja, os leads ainda não foram passados para o Bruno.
- **Eliezer** não apareceu na busca por nome. Preciso que você confirme o nome exato dele no cadastro.

## Parte 1 — Passar os leads para o Bruno com o selo "Era de ..."
1. Passar para o Bruno os leads em andamento do Billy e do Eliezer (Novo Lead até Contrato). Leads em Ganho, descartados e arquivados ficam como estão, como histórico.
2. Cada lead passado guarda **de qual corretor veio** e **a data da saída**.
3. **Selo no cartão** (computador e celular): "Era de Billy · decidir". Fica até o Bruno decidir.
4. **Decisão do Bruno** dentro da ficha do lead, com 3 opções:
   - **Manter comigo**: o selo some e o lead segue normal.
   - **Passar para um corretor**: usa o repasse que já existe.
   - **Descartar**: usa o descarte que já existe (pede motivo).
5. **Filtro no topo do Pipeline**: "Herdados para decidir (N)", para o Bruno ver todos de uma vez.
6. A passagem segue a regra atual de reentrada: tarefas antigas do Billy são canceladas e o relógio de atividade zera, então o Bruno não começa com tudo atrasado.
7. Esses leads **não contam como "desatualizados"** contra o Bruno até ele decidir ou por 7 dias, o que vier primeiro.

## Parte 2 — Corretor inativo: preserva o passado, sai do futuro
- **Fica no histórico, sem mudança:** vendas, VGV, visitas, fechamentos semanais, relatórios de períodos passados, 1:1 e equipe da época (a regra de equipe da época do fato já existe).
- **Sai daqui para frente:** listas de corretores ativos, Roleta, ranking atual, metas do mês, Performance da Roleta, contagem de equipe atual, seletores de "passar lead para".
- **Ao filtrar um período passado**, ele aparece nos números daquele período com o selo "inativo". Ao filtrar o período atual, só aparece se tiver venda ou visita dentro dele.
- Venda em parceria com ele continua 50/50 no histórico. Comissões e repasses que já existem não mudam.

## Antes de construir (regra do projeto)
1. Desenho (mockup) do selo no cartão, do filtro e da caixa de decisão na ficha, no computador e no celular, para sua aprovação.
2. Construção em 2 fases: primeiro a Parte 1 (selo e passagem), depois a Parte 2 (conferência tela por tela dos números).
3. Teste com lead de teste; conferência no computador e no celular.

## Detalhes técnicos
- Novas colunas em `pipeline_leads`: `herdado_de_corretor_id` (uuid, nulo), `herdado_em` (timestamptz), `herdado_decidido_em` (timestamptz). Uma migration, só estrutura.
- RPC `transferir_carteira_corretor_inativo(p_de, p_para)` com SECURITY DEFINER, só admin/diretor/gestor da equipe, idempotente. Só move as etapas em andamento e registra anotação "Lead herdado de X" na timeline. A trigger `reset_ciclo_reentrada` já cuida de tarefas e parcerias.
- RPC `decidir_lead_herdado(p_lead, p_acao)`: manter, repassar (via `repassar_lead_gestor`) ou descartar (fluxo atual).
- Saúde e "desatualizado" ignoram lead herdado ainda não decidido com menos de 7 dias (`crm_saude_corretor` e o cartão).
- Parte 2: auditar os seletores e RPCs que listam corretores (Roleta, `rpc_performance_roleta`, ranking, metas, seletores de repasse) para filtrar `profiles.ativo=true` no período atual. Métricas históricas (VGV, `fn_equipe_na_data`, fechamentos) continuam sem esse filtro.
- Cartão: selo em `CardMinimal.tsx`; filtro em `PipelineHeaderV2`.

## Preciso confirmar com você
- O nome do Eliezer no cadastro.
- Os leads do Billy em **Ganho** ficam com ele, para preservar a venda. Isso está certo?
