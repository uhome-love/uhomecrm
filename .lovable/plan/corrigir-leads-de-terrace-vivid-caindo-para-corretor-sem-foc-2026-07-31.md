# Corrigir: leads de Terrace/Vivid caindo para corretor sem foco no produto

## O que foi confirmado nos dados (auditoria)

**William Brizola** (`5fa3587d…`) está alocado em **apenas 2 produtos**: Casa Tua e Connect JW. Não tem Terrace nem Vivid.

Mesmo assim ele recebeu:

| Lead | Empreendimento no lead | Produto canônico | Data | Como caiu nele |
|---|---|---|---|---|
| Poliana Santana | `Vivid - v3` | **vazio (não resolvido)** | 31/07 | pool `segmento` |
| Andressa Horstmann | `Vivid - v3` | **vazio (não resolvido)** | 30/07 | pool `segmento` |
| Carolina, Carina, Monique | `Vivid - Qualificado - v2` | Vivid | 15–21/07 | antes de ele ter alocação cadastrada (alocação criada 21/07 21:13) |
| Lucas Eduardo, Thayana | `Terrace v2 - Qualificado` | Terrace | 20–21/07 | idem |

### Causa raiz

A regra de foco **já existe** e funciona: quando o lead tem produto canônico, a roleta só distribui para quem está alocado nele; sem ninguém alocado, vai para a Fila do CEO (`sem_alocado_produto`).

O problema é que ela **só roda quando o lead tem produto canônico preenchido**. Os leads novos entram com o texto `Vivid - v3`, e esse apelido **não está cadastrado** na tabela de apelidos (só existem `Vivid - Qualificado - v3`, `Vivid - 2026`, `Vivid Terrace`…). Sem apelido, o produto fica vazio e o lead cai no caminho antigo — distribuição por **segmento**, que ignora completamente o foco do corretor.

Volume atual do buraco (últimos 30 dias, leads sem produto identificado):
- `Vivid - v3` → **17 leads**
- `Connect JW - v2` → **4 leads**
- ~7 leads avulsos de site/portal (esses são normais, não são de campanha)

Os leads de 15–21/07 são um caso diferente e já resolvido: naquela data o William ainda não tinha nenhuma alocação cadastrada, então a regra não tinha o que comparar.

## O que será feito

### 1. Cadastrar os apelidos que faltam
Registrar `Vivid - v3` → Vivid e `Connect JW - v2` → Connect JW, e corrigir os leads já criados com esses nomes para apontarem ao produto correto (backfill). Isso sozinho já faz os próximos leads de Vivid respeitarem o foco.

### 2. Fechar o buraco de vez: sem produto identificado = Fila do CEO
Alterar a distribuição para que um lead **de campanha** (Meta/Instagram/Facebook/landing) que chegue **sem produto identificado** não caia mais no rateio por segmento. Ele vai para a **Fila do CEO** com o motivo `produto_nao_identificado`, para o CEO decidir o destino e o gestor cadastrar o apelido.

Leads avulsos (site, portais, Jetimob, indicação) continuam no fluxo por segmento como hoje — eles realmente não têm produto.

### 3. Deixar o problema visível
- Mostrar o motivo `produto_nao_identificado` na Fila do CEO, junto com o texto original do empreendimento, para o gestor cadastrar o apelido em 1 clique.
- Card/aviso em Foco Corretores listando os textos de campanha sem apelido cadastrado (com contagem), para não descobrirmos de novo por relato de corretor.

### 4. Reparar os leads já distribuídos errado (opcional, você decide)
Os 2 leads de `Vivid - v3` que estão com o William já foram aceitos por ele. Opções: deixar como estão, ou devolver para a Fila do CEO para redistribuição a quem tem foco em Vivid.

## Detalhes técnicos

- `empreendimento_aliases`: inserir `vivid - v3` → Vivid e `connect jw - v2` → Connect JW; backfill de `pipeline_leads.empreendimento_canonico_id` via `resolver_empreendimento_canonico` para os leads afetados (não altera corretor).
- `distribuir_lead_atomico`: no ramo `v_emp_canonico_id IS NULL`, se `origem` for de campanha (ig/facebook/meta/landing/anúncio) e o texto do empreendimento não estiver vazio, gravar `aceite_status='pendente_distribuicao'`, `motivo_pendencia='produto_nao_identificado'`, registrar em `distribuicao_historico` (`pool='fila_ceo'`) e retornar sem distribuir. Demais origens seguem o ramo por segmento atual.
- Frontend: `FilaCeoDispatchModal` — rótulo e explicação do novo motivo; `/foco-corretores` — painel "Campanhas sem produto cadastrado" lendo os leads com produto nulo e origem de campanha nos últimos 30 dias.
- Validação ao vivo: criar/simular um lead com texto de campanha desconhecido e conferir que ele para na Fila do CEO; conferir que um lead de Vivid passa a ir só para corretores alocados em Vivid.

## Fases

1. Apelidos + backfill (migração de dados) — valida no preview que os leads de Vivid ficam com o produto certo.
2. Regra na distribuição (migração da função) — valida com lead de teste.
3. UI: motivo na Fila do CEO + painel de alerta em Foco Corretores.
4. Decidir o que fazer com os 2 leads do William.
