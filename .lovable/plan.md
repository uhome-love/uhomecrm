# Venda com empreendimento avulso ou fora do cadastro ativo

## Problema confirmado
No pop-up "Registrar venda", o campo Empreendimento só lista empreendimentos oficiais **ativos**. Hoje o sistema também recusa a venda quando:
- o empreendimento escolhido não está ativo ("Selecione um empreendimento oficial"), ou
- o nome do empreendimento na intermediação não bate com um empreendimento oficial ("O empreendimento deve corresponder à intermediação").

Por isso, venda de imóvel de terceiros, revenda ou empreendimento antigo/desligado não consegue virar Ganho.

## O que muda (para o usuário)
1. **Lista completa:** o campo Empreendimento passa a ter busca e mostra também os empreendimentos oficiais desligados, com a etiqueta "fora de linha".
2. **Botão "+ Adicionar imóvel ou empreendimento"** no próprio campo. Abre um formulário curto com:
   - Tipo: Empreendimento novo / Imóvel avulso (terceiros, revenda)
   - Nome (ex.: "Apto Rua Ramiro Barcelos 1200")
   - Construtora (para avulso já vem "Imóvel de terceiros", pode trocar)
   Ao salvar, ele já fica escolhido na venda.
3. **Sem efeito colateral:** o que for criado por aqui entra no cadastro oficial **desligado** e marcado como "criado na venda". Não entra na Roleta, no Foco dos corretores, nos anúncios nem nas listas de produto. CEO/diretora podem revisar depois em Configurações.
4. **Intermediação:** a venda passa se a intermediação for do mesmo cliente. Quando o nome do empreendimento da intermediação for diferente do escolhido, aparece um aviso (não bloqueia) e a divergência fica registrada no histórico da venda.
5. Continuam obrigatórios: unidade, VGV, data de assinatura, intermediação do cliente e comprovante do ato.

## Ordem de trabalho (padrão do Lucas)
1. Mockup do campo e do formulário "Adicionar" para aprovação.
2. Banco: permitir criar empreendimento pela venda (desligado + marca de origem), aceitar empreendimento oficial desligado e trocar a trava de nome da intermediação por registro de divergência.
3. Tela: busca + botão "Adicionar" no pop-up de venda.
4. Teste com cliente de teste: venda com imóvel avulso novo, com empreendimento desligado e com empreendimento ativo (que tem que continuar igual). Apagar o cliente de teste depois e conferir que o total de vendas/VGV ficou igual.

## Detalhes técnicos
- `empreendimentos_canonicos`: nova coluna `origem text default 'cadastro'` ('venda' quando criado pela venda); criados por venda sempre `ativo=false`.
- Nova RPC `criar_empreendimento_venda(p_nome, p_construtora, p_tipo)` SECURITY DEFINER: exige quem pode confirmar venda (admin/diretor/gestor/corretor com acesso), deduplica por nome normalizado (reaproveita se já existe), grava `audit_log`.
- `confirmar_venda`: remover `AND ativo` na busca do empreendimento; substituir o RAISE de correspondência com a intermediação por registro em `audit_log`/atividade do negócio. Demais travas iguais.
- `pendenciasVenda` / `validar_venda_completa`: sem mudança de regra.
- Front: `ConfirmarVendaForm.tsx` usa lista com busca (todos os canônicos, ativos primeiro) e novo `AdicionarEmpreendimentoVenda.tsx`.
- Garantir que Roleta/Foco/listas filtram por `ativo=true` (conferir antes de aplicar).
- 1 migration, fora do pico se possível.
