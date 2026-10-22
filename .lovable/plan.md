# Financeiro da Uhome + Vendas Realizadas organizada + padrão obrigatório da venda

## O que já existe (conferido)
- **Vendas:** 115 vendas ativas. Só **15** têm a construtora preenchida, **58** têm unidade e **29** estão ligadas ao cadastro oficial do empreendimento. Hoje não dá para filtrar com confiança por construtora ou empreendimento.
- **Intermediação:** 54 intermediações geradas pela página Intermediação, com VGV, valor da comissão, unidade e empreendimento. Exemplo: a Juliana Battisti tem R$ 298.000 de VGV e R$ 11.920 de comissão. Elas **não estão ligadas à venda**, só batem pelo nome do cliente e pela unidade.
- **Pagadoria:** a estrutura antiga existe, mas está vazia (0 registros). Não será usada, para não ter dois controles.
- **Vendas Realizadas:** página única, grande (1.028 linhas), com abas Vendas e Origens e filtro por mês e ano. Não tem filtro por construtora nem por empreendimento.

## Decisões suas
- O Financeiro é visto só pelo **CEO e pela diretora**.
- A comissão vem **da intermediação da venda**.
- Primeiro controlamos **a parte da Uhome**, ou seja, o que a construtora paga para a Uhome. O repasse para corretores e gerentes fica para depois.

## Como vai funcionar

```text
Corretor/gerente marca Ganho
   -> preenche o padrão obrigatório (empreendimento, construtora, unidade, VGV,
      data, intermediação anexada, comprovante)
   -> a venda nasce "Comissão a receber", com valor vindo da intermediação
Financeiro (CEO/diretora)
   -> define como vai receber: à vista ou parcelado (nº de parcelas, datas)
   -> marca cada parcela como paga: forma (PIX, boleto Zemo, NF), data, comprovante
   -> status da venda: Não pago / Parcial / Pago / Atrasado
```

## Fases (uma por vez, validadas antes da próxima)

### Fase 0 — Mockup para aprovação
Desenho das 3 telas: Financeiro, Vendas Realizadas nova e confirmação de venda. Nada é construído antes do seu ok.

### Fase 1 — Padrão obrigatório ao marcar Ganho
A janela "Confirmar venda" passa a exigir:
- **Empreendimento**, escolhido da lista oficial. A **construtora** é preenchida automaticamente e pode ser corrigida.
- **Unidade**, **VGV assinado** e **data da assinatura**.
- **Intermediação**: escolher uma das geradas na página Intermediação (o sistema sugere a do mesmo cliente e unidade) ou anexar o PDF. O valor da comissão vem dela.
- **Comprovante**: contrato assinado ou comprovante de sinal (PDF ou foto).
- Aviso se o VGV da venda for diferente do VGV da intermediação.

Sem esses itens, o botão "Confirmar venda" fica bloqueado. Vale para corretor, gerente e CEO, no Pipeline e no celular.

### Fase 2 — Completar as vendas antigas
- O que for possível o sistema preenche sozinho: empreendimento oficial, construtora pelo empreendimento, e intermediação e comissão quando o cliente e a unidade batem.
- Lista "Vendas com pendência" para o CEO e a diretora completarem o resto, com o que falta em cada venda (construtora, intermediação, comprovante ou unidade).
- As vendas antigas continuam contando no VGV normalmente, mesmo com pendência.

### Fase 3 — Página Financeiro (CEO e diretora)
- **Resumo no topo:** comissão total do período, recebido, a receber, atrasado e previsão dos próximos 30, 60 e 90 dias.
- **Abas:**
  - **A receber:** parcelas em aberto por data prevista, com vencidas em vermelho.
  - **Recebidos:** parcelas pagas, com forma, data e comprovante.
  - **Por venda:** cada venda com comissão, quanto já entrou e status (Não pago, Parcial, Pago ou Atrasado).
  - **Previsão:** gráfico mês a mês do que vai entrar.
- **Em cada venda:**
  - "Definir recebimento": à vista ou parcelado, com número de parcelas, valores e datas. A soma tem que fechar com a comissão.
  - "Marcar como paga" em cada parcela: forma (PIX, boleto Zemo ou NF), número da NF, data e comprovante.
- **Filtros:** período, construtora, empreendimento, corretor, equipe e status.
- Exportar para Excel/PDF.
- Venda que cair por distrato tem as parcelas abertas canceladas automaticamente.

### Fase 4 — Vendas Realizadas reorganizada
- **Barra de filtros fixa:** período (mês, trimestre, ano ou personalizado), construtora, empreendimento, corretor, equipe, status financeiro e pendências, além de busca por cliente ou unidade.
- **Resumo:** VGV, número de vendas, ticket médio e comissão (comissão só para CEO e diretora).
- **Agrupar por:** nenhum, construtora, empreendimento, corretor ou mês. Cada grupo mostra subtotal e abre e fecha.
- **Tabela:** cliente, empreendimento, construtora, unidade, VGV, data, corretor e parceiro (com a regra 50/50), equipe da época e selos ("Sem intermediação", "Sem comprovante", "Pago", "Parcial").
- Clicar numa venda abre o detalhe com dados, anexos e linha do tempo. Para CEO e diretora, mostra também o financeiro.
- A aba Origens continua.
- Os números continuam vindo da régua oficial do VGV, sem dobrar parceria.

### Fase 5 — Conferência ponta a ponta
- Teste com cliente de teste: marcar Ganho com o padrão, aparecer no Financeiro, parcelar, marcar como paga, cancelar por distrato e apagar o teste.
- Conferir que o total de Vendas Realizadas é igual ao VGV oficial de janeiro a outubro.
- Conferir que corretor e gerente não veem valores de comissão.

## Detalhes técnicos
- **Banco (fora do horário de pico, uma migração por fase):**
  - `negocios`: novos campos opcionais `intermediacao_id`, `comissao_valor`, `comissao_pct`, `comprovante_url` e `intermediacao_url` (construtora e canônico já existem).
  - `intermediacoes`: novo campo opcional `negocio_id`.
  - Nova tabela `negocio_recebimentos`, uma linha por parcela: `negocio_id`, `parcela_n`, `valor`, `vencimento`, `status` (previsto/pago/cancelado), `forma` (pix/boleto_zemo/nf), `nf_numero`, `pago_em`, `comprovante_url`, `obs`, `created_by`. GRANT para usuários autenticados e RLS só para admin e diretor via `has_role`.
  - View `v_financeiro_vendas` (security_invoker) juntando `v_fato_venda` (venda única) com os recebimentos.
  - Gatilho: quando o negócio sai de ganho/ativo, as parcelas previstas viram canceladas.
- **Armazenamento:** bucket privado `vendas-docs` com links assinados. Quem registra a venda pode enviar arquivos, e só a gestão pode ler.
- **Trava no servidor:** validação por gatilho ao marcar ganho em vendas novas, depois da data de corte (antigas liberadas), além da validação na tela (`VendaForm` em `PipelineStageTransitionPopup.tsx`, `moveLead` em `usePipeline.ts`).
- **Código:** `src/pages/Financeiro.tsx`, com componentes em `src/components/financeiro/`. Vendas Realizadas será dividida em filtros, resumo, tabela agrupada e drawer de detalhe, para ficar abaixo de 500 linhas. Rota restrita a admin e diretor no `pageRegistry` e no menu.
- **Testes:** regra "soma das parcelas = comissão", cálculo do status (Não pago/Parcial/Pago/Atrasado) e bloqueio do Ganho sem campos obrigatórios.
- A estrutura antiga de pagadoria (vazia) não é usada nem apagada.
