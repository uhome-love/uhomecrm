# Empreendimento livre na Proposta / Documentação / Contrato

## Problema confirmado
No pop-up de Proposta, Documentação e Contrato do Pipeline, o campo Empreendimento só lista empreendimentos oficiais **ativos** e não deixa adicionar outro imóvel. O servidor também recusa salvar se o empreendimento escolhido estiver desligado. O pop-up de Registrar venda já resolve isso, mas a jornada ficou de fora.

## O que muda (para o usuário)
1. O campo Empreendimento da jornada passa a ser **o mesmo do Registrar venda**: com busca, mostrando também os desligados ("fora de linha").
2. Botão **"+ Adicionar imóvel ou empreendimento"** no próprio campo: tipo (empreendimento novo / imóvel avulso), nome e construtora. Ao salvar, já fica escolhido.
3. O que for criado aqui segue a mesma regra da venda: entra desligado e marcado "criado na venda". Não entra na Roleta, no Foco, nos anúncios nem nas listas de produto.
4. Ao confirmar a venda depois, o imóvel escolhido na proposta já vem preenchido.
5. Nada mais muda: etapas, avisos de contrato, Ganho e regras da venda continuam iguais.

## Ordem de trabalho
1. Mockup do campo no pop-up de Contrato para aprovação (é igual ao da venda já aprovado).
2. Banco (1 mudança): a gravação da jornada passa a aceitar empreendimento oficial desligado, como já acontece na venda.
3. Tela: trocar o campo da jornada pelo campo da venda.
4. Teste com cliente de teste: Proposta com imóvel avulso novo → Contrato → reabrir e conferir → Confirmar venda mostra o imóvel (Cancelar sem marcar Ganho). Apagar cliente e imóvel de teste e conferir que vendas/VGV ficaram iguais.

## Detalhes técnicos
- `useJornadaNegocio`: buscar todos os canônicos (`id,nome,construtora,ativo`), ativos primeiro, sem filtro `ativo=true`.
- `PropostaCampos.tsx`: substituir o `Select` por `EmpreendimentoVendaPicker`, com `onCriado` acrescentando o item à lista local em `JornadaNegocioForm`.
- `registrar_jornada_negocio`: remover `AND ativo` na busca de `empreendimentos_canonicos` (CREATE OR REPLACE com o restante idêntico). Nenhuma alteração de permissão.
- `criar_empreendimento_venda` reutilizada como está (deduplica por nome, audita).
