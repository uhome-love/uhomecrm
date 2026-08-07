# Auditoria do PDN — está 100%?

Resposta curta: **estrutura e dados estão sólidos (95%)**. Não há mais planilha paralela nem dono duplicado da verdade. Sobraram **1 bug real de dado, 2 problemas de UX/visual e 1 rótulo ambíguo de KPI**.

## O que foi verificado (com evidência)

**Banco**
- `pdn_entries`: 117 linhas, **0 sem `pipeline_lead_id`**, **0 apontando para lead inexistente**, 4 políticas de acesso, RLS ligada.
- Triggers de espelhamento: **nenhum**. Só resta `update_updated_at_column` (correto).
- `v_pdn_linhas`: ativa, `security_invoker=true` (respeita as regras de acesso do usuário). 189 linhas: pos_visita 84, ganho 83, em_negociacao 20, contrato 2.

**Frontend**
- `/pdn` carrega em desktop (1280) e mobile (440) sem erro de página nem erro de rede do PDN. As 5 abas aparecem (Planilha, Kanban, Meta, Conferência de Visitas, Arquivados).
- Arquivos dentro do padrão: `PdnGestor.tsx` 526 linhas, maior componente `PdnGrupoBloco.tsx` 319, hook `usePdn.ts` 784.

## Problemas encontrados

### 1. Falso alarme na Reconciliação: venda ganha em lead arquivado (bug real)
O bloco lista 10 "Negócio ativo em lead arquivado" — mas 5 deles são `fase = ganho`. Arquivar o lead depois da venda é o fluxo **normal**, e o negócio ganho já aparece no PDN pela data de assinatura. Ou seja: o gestor é convidado a "Desarquivar lead" em vendas concluídas, o que sujaria o pipeline.
Correção: excluir `fase='ganho'` desse grupo (só `em_negociacao`/`contrato` são divergência de verdade).

### 2. "Negócio sem lead vinculado (10)" não tem ação
O grupo mostra o problema mas nenhum botão — beco sem saída. Ou ganha uma ação de vincular a um lead (busca por nome/telefone), ou sai do bloco principal e vira um aviso discreto.

### 3. O bloco de reconciliação empurra a planilha para fora da tela
Com 26 itens aberto por padrão, tudo que interessa (a planilha) fica abaixo da dobra. Deve vir **fechado por padrão**, mostrando só a faixa "Reconciliação — 26 itens" com o contador; abre por clique.

### 4. "VGV Total" e o contador do rodapé não batem
Cards mostram VGV Total R$ 18,3M; a barra de filtros mostra "110 negócios · R$ 20,2M". O card soma só Negociação+Contrato+Ganho (exclui Pós-Visita) e o contador soma tudo. Nenhum está errado, o rótulo é que engana: renomear o card para "VGV em negociação+" (ou incluir Pós-Visita e manter um só número).

### 5. Higiene de código (sem impacto no usuário)
- `as any` ainda em `pdnSyncEngine.ts` (20 ocorrências) e `usePdn.ts` (11) — restos do modelo antigo de tabela; agora que a view é fixa, dá para tipar.
- Aviso global do React (`Function components cannot be given refs`) aparece em todo o app, não é do PDN.
- 403 em `profiles?select=telefone` também é global (banner de telefone faltando), fora do escopo do PDN.

## Correções propostas (1 build, só frontend)

1. `src/hooks/pdn/usePdnDivergencias.ts`: no grupo `lead_arquivado`, ignorar negócios com `fase='ganho'`.
2. `src/components/pdn/PdnDivergencias.tsx`: iniciar recolhido; adicionar ação "Vincular a um lead" no grupo `negocio_sem_lead` (ou rebaixá-lo a informativo, conforme sua escolha).
3. `src/components/pdn/PdnKpiCards.tsx`: renomear o card "VGV Total" para refletir o que ele soma.

Sem migration, sem mudança em `negocios`/`pipeline_leads`, sem alteração de regra de VGV.

## Decisões que preciso de você
- Item 2: criar o vínculo manual negócio→lead, ou só rebaixar o aviso?
- Item 4: renomear o card, ou passar a incluir Pós-Visita no VGV Total?
