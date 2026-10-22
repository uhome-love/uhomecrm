# Financeiro completo + Vendas Realizadas nova + padrão obrigatório da venda

## O que já existe (conferido)
- **Vendas:** há 115 vendas ativas. Só **15** têm construtora preenchida, **58** têm unidade e **29** estão ligadas ao cadastro oficial do empreendimento. Por isso hoje não dá para filtrar com confiança por construtora ou empreendimento.
- **Intermediação (= pagadoria):** são 54 intermediações. Cada uma já traz quase tudo de que o financeiro precisa:
  - comissão total e parcelas com vencimento;
  - corretores com o percentual de cada um;
  - percentual do gerente, da Diretoria e da Gabrielle.
  - Exemplo da Juliana Battisti: comissão de R$ 11.920 com vencimento em 23/10. Matheus fica com 40%, Bruno 15%, Diretoria 5% e Gabrielle 10%. **A Uhome fica com 30%.**
- **Problemas nas intermediações:**
  - elas não estão ligadas à venda;
  - existem **duplicadas** (a da Juliana foi gerada 2 vezes);
  - o mesmo corretor aparece com e-mail diferente de uma intermediação para outra.
- **Custo de anúncios do Meta:** o gasto diário por campanha e por anúncio já é sincronizado.
- **Pagadoria antiga:** está vazia e não será usada.
- **Vendas Realizadas:** é uma página única e grande, com filtro só por mês ou ano.

## Decisões suas
- **Financeiro:** só CEO e diretora veem.
- **Fonte da comissão:** a intermediação é a fonte única da comissão e da divisão (Uhome, corretor, gerente e diretora).
- **Vendas Realizadas** vira a página de **resultado**: ranking, vendas, incorporadora e empreendimento.
- **Financeiro** vira a página de **controle**: a receber, recebido, ganhos de cada pessoa, custos de mídia, custos fixos, lucro e ROI.

## Como fica

```text
Marcar Ganho (padrão obrigatório)
  -> venda ligada à intermediação
  -> parcelas a receber nascem da intermediação (valor + vencimento)
  -> divisão automática: Uhome / corretor(es) / gerente / diretora
Financeiro (CEO/diretora)
  -> marca parcela recebida (PIX, boleto Zemo, NF + comprovante)
  -> ganhos por pessoa: a receber / recebido
  -> custos (Meta Ads automático + custos fixos lançados) -> lucro e ROI
```

## Fases (cada uma com mockup e validação antes da próxima)

### Fase 0 — Mockups para aprovação
Mockup das telas: Vendas Realizadas, Financeiro (Visão geral, A receber, Ganhos, Custos, Resultado) e Confirmar venda. Nada é construído antes do seu ok.

### Fase 1 — Padrão obrigatório ao marcar Ganho
- **Campos exigidos:** empreendimento (da lista oficial), construtora (preenchida pelo empreendimento), unidade, VGV, data da assinatura, **intermediação** e **comprovante** (contrato ou sinal).
- **Escolha da intermediação:** o sistema sugere a do mesmo cliente e unidade. Se ela não existe, aparece o botão "Gerar intermediação", que abre a página Intermediação.
- **Avisos:** se o VGV da venda for diferente do VGV da intermediação, ou se a intermediação já estiver ligada a outra venda.
- **Bloqueio:** sem tudo preenchido, não confirma. Vale para todo mundo, no computador e no celular, com trava também no servidor.

### Fase 2 — Ligar e completar o histórico
- **Ligação automática:** o sistema liga intermediações a vendas quando cliente e unidade batem, e marca as duplicadas para não contar 2 vezes.
- **Nomes por pessoa:** cada corretor e gerente da intermediação é ligado ao cadastro da pessoa, mesmo com e-mail diferente.
- **Lista "Pendências":** mostra vendas sem intermediação ou comprovante e intermediações sem venda, para o CEO ou a diretora resolverem com um clique.
- **VGV:** as vendas antigas continuam contando no VGV como hoje.

### Fase 3 — Financeiro: recebimentos
- **Visão geral:**
  - comissão do período, recebido, a receber e atrasado;
  - previsão para 30, 60 e 90 dias;
  - parte da Uhome.
- **A receber:** parcelas por vencimento, com as atrasadas em vermelho. O botão "Marcar recebida" pede forma (PIX, boleto Zemo ou NF), número da NF, data e comprovante.
- **Recebidos:** histórico com os comprovantes.
- **Parcelas:** ajuste manual quando a construtora mudar o parcelamento. A soma das parcelas sempre fecha com a comissão.
- **Distrato:** as parcelas abertas são canceladas sozinhas.

### Fase 4 — Financeiro: ganhos por pessoa
- **Abas por papel:** Corretores, Gerentes, Diretoria e Uhome.
- **Valores por pessoa:** total ganho no período, quanto já foi recebido da construtora e quanto falta, além das vendas que geraram o valor.
- **Fonte dos valores:** tudo sai dos percentuais da intermediação. As parcerias já vêm divididas nela.
- **Exportação:** relatório por pessoa em PDF e Excel, para conferência e pagamento.
- **Visibilidade:** corretor e gerente não veem esta página.

### Fase 5 — Financeiro: custos, lucro e ROI
- **Mídia:** o gasto do Meta Ads entra automático por mês, campanha e empreendimento. Também dá para lançar manualmente outros canais (Google, portais).
- **Custos fixos:** cadastro de categoria (aluguel, salários, sistemas, etc.), valor e se é mensal ou avulso.
- **Resultado do mês:**
  - receita da Uhome;
  - menos custos de mídia;
  - menos custos fixos;
  - igual a lucro.
- **Indicadores:** margem, ROI da mídia, custo por venda e ROI por empreendimento.
- **Gráficos:** evolução mês a mês, com escolha entre ver a receita reconhecida ou o que foi recebido de fato.

### Fase 6 — Vendas Realizadas nova (resultado)
- **Filtros fixos:** período (mês, trimestre, ano ou personalizado), incorporadora, empreendimento, corretor, equipe e status, além de busca por cliente ou unidade.
- **Resumo:** VGV, vendas, ticket médio e evolução em relação ao período anterior.
- **Abas:**
  - **Vendas:** tabela agrupável por incorporadora, empreendimento, corretor ou mês, com subtotais e selos de pendência.
  - **Ranking:** corretores, equipes e gerentes por VGV e vendas, com pódio.
  - **Incorporadoras:** VGV, vendas e participação por construtora e por empreendimento.
  - **Origens:** a aba que já existe.
- **Detalhe da venda:** dados, anexos e linha do tempo. A comissão aparece só para o CEO e a diretora.
- **Regra do VGV:** a régua oficial continua, com parceria 50/50 e sem dobrar.

### Fase 7 — Validação ponta a ponta
- **Venda de teste:** marcar Ganho com o padrão, ver as parcelas no Financeiro, marcar uma como recebida, ver os ganhos de cada pessoa, fazer um distrato e apagar tudo no final.
- **Conferências:**
  - Vendas Realizadas igual ao VGV oficial de jan a out;
  - soma dos ganhos igual à comissão;
  - Meta Ads igual ao painel de mídia.
- **Acesso:** testar com contas de corretor e gerente para confirmar que não veem valores.

## Detalhes técnicos
- **Banco** (uma migração por fase, fora do pico): todos os campos novos são opcionais.
  - `negocios`: novos campos `intermediacao_id`, `comprovante_url`, `comissao_valor`.
  - `intermediacoes`: novos campos `negocio_id`, `duplicada_de` e `status` (ativa/duplicada/cancelada).
  - `intermediacao_beneficiarios`: novo, uma linha por pessoa, com intermediação, papel (corretor/gerente/diretoria/uhome), `profile_id`, nome, `pct` e valor. É montado a partir do `payload` (`corretores[].percentual`, `pctDiretoria`, `pctGabrielle`). A Uhome fica com o restante.
  - `negocio_recebimentos`: novo, com as parcelas: valor, vencimento, status (previsto/recebido/cancelado), forma (pix/boleto_zemo/nf), `nf_numero`, `recebido_em`, `comprovante_url`. Nasce de `payload.comissao.parcelas`.
  - `custos_fixos`: novo, com categoria, descrição, valor, competência, recorrente e ativo.
  - `custos_midia_manual`: novo, com canal, competência, valor e empreendimento.
  - Mídia Meta: lida de `midia_snapshot_diario.spend`.
  - Views `v_financeiro_recebimentos`, `v_ganhos_pessoa` e `v_resultado_mensal`, todas com `security_invoker`.
  - Tabelas novas com GRANT para `authenticated` e `service_role`, e RLS só para admin e diretor via `has_role`.
  - Gatilho de distrato e trava de Ganho (só para vendas novas, a partir da data de corte).
- **Arquivos:** bucket privado `vendas-docs`, com links assinados.
- **Código:**
  - `src/pages/Financeiro.tsx`, com componentes em `src/components/financeiro/` (abas, cards, gráficos com recharts, dialogs).
  - `VendasRealizadas.tsx`, de 1.028 linhas, dividida em `src/components/vendas/` (filtros, resumo, tabela agrupada, ranking, incorporadoras, drawer), cada parte com menos de 500 linhas.
  - Rota Financeiro restrita a admin e diretor no `pageRegistry` e no menu.
  - A página Intermediação passa a gravar `negocio_id` quando aberta a partir da venda.
- **Testes:** soma das parcelas igual à comissão, divisão por pessoa (Uhome com o restante), status das parcelas (atrasado/recebido), cálculo de lucro e ROI, e bloqueio do Ganho sem os campos obrigatórios.
- **Pagadoria antiga:** não é usada nem apagada.
