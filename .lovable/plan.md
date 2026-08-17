# Fila CEO: leads "Alto Lindoia" e "Isla" — de onde vieram

## O que os dados mostram

Esses dois leads **não vieram de campanha nenhuma**. Eles são leads-sombra de **vendas manuais antigas**, já ganhas:

| Lead | Produto | Criado | Negócio vinculado | Corretor | Assinatura |
|---|---|---|---|---|---|
| Andressa | Isla | 18/03/2026 | "Andressa Santos da Costa - Network" · R$ 298.000 · fase ganho | Ebert Silva | 19/03/2026 |
| Juliano Rosseto | Alto Lindoia | 30/01/2026 | "juliano" · R$ 442.586 · fase ganho | Jéssica França | 30/01/2026 |

Os dois estão com `origem`, `campanha`, `formulário` e `anúncio` **vazios** e `origem` do negócio = `manual` — ou seja, foram cadastrados à mão pelo corretor/gestor ao registrar a venda, não entraram por Meta/site.

Ambos estão na etapa **Ganho** do pipeline, mas com `aceite_status = 'pendente_distribuicao'` e sem corretor no lead. Como a Fila CEO conta simplesmente "pendente de distribuição + sem corretor + não arquivado", **sem olhar a etapa**, eles aparecem lá.

Na madrugada de 17/08 a roleta ainda chegou a oferecê-los: os dois foram devolvidos com motivo **`cliente_repetido`** (Ebert às 23:23 de 16/08 e Jéssica às 07:24 de 17/08, horário BRT), o que os manteve pendentes.

Hoje a fila tem 18 leads: 16 em "Novo Lead" (esses são legítimos) e **2 em "Ganho"** (exatamente estes).

## Causa

Leads criados/religados a partir de negócios manuais ficaram com o campo de aceite em "pendente de distribuição" mesmo estando em Ganho, e nem a Fila CEO nem a roleta filtram por etapa final. Resultado: venda fechada volta a circular como se fosse lead novo.

## O que proponho fazer

### 1. Limpar os dois casos (dados)
Marcar os dois leads como já atribuídos ao corretor do negócio (Ebert e Jéssica) e zerar o estado de "pendente de distribuição". Nada de VGV, negócio ou histórico é alterado.

### 2. Impedir que se repita (regra)
- Fila CEO (contagem e modal de repasse): ignorar leads em etapas finais (Ganho / Contrato assinado / descartados-arquivados).
- Roleta / distribuição: não oferecer lead que esteja em etapa de venda ou tenha negócio ganho vinculado.
- Ao registrar venda manual, garantir que o lead-sombra nasça com aceite resolvido no corretor dono do negócio (sem passar por distribuição).

### 3. Varredura
Rodar uma checagem única atrás de outros leads em etapa final com aceite pendente (hoje são só esses 2) e corrigir junto.

## Detalhes técnicos

- Leads: `1a94f6d3…` (Isla) e `47de21d0…` (Alto Lindoia); negócios `5c05a9a7…` e `f3ca87dc…`.
- Correção de dados: `pipeline_leads.aceite_status = 'aceito'`, `corretor_id` = corretor do negócio (`negocios.corretor_id`), `aceite_em = now()`. Sem DELETE.
- `CeoDashboard.tsx` → `loadFilaCeo`: adicionar filtro por `stage_id` fora dos tipos `venda`/`contrato` (join ou lista de stages carregada); mesmo filtro em `FilaCeoDispatchModal` e `FilaCeoRepassarDialog`.
- `distribuir_lead_atomico` / `distribute-lead`: guarda inicial — se o lead tiver `negocio_id` com `fase='ganho'` ou stage tipo `venda`, retornar sem distribuir.
- Migração: apenas DDL da função de distribuição (1 migração), fora do horário de pico conforme a regra de 2 migrações/dia.

## Fases

1. Correção dos 2 leads + validação ao vivo (fila CEO cai de 18 para 16).
2. Filtro de etapa final na Fila CEO (frontend).
3. Guarda na distribuição (migração) + varredura de recorrência.
