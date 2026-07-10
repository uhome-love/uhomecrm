# Disparo flow_novidade2 + padronização dos segmentos (S4 = MCMV)

## Contexto (o que já existe e o que falta)
- **Template `flow_novidade2`** já está aprovado na Meta (Ativo · pt_BR). Falta apenas registrar a **imagem de cabeçalho** e a **regra de reativação** no sistema.
- **`roleta_campanhas` já mapeia `Flow → S4 - MCMV`** (é a fonte de verdade que a Fila do CEO usa para agrupar por empreendimento). Ou seja, ao reativar um lead com empreendimento "Flow", ele já cai no grupo **S4 - MCMV** na distribuição.
- **Problema de nomenclatura:** a tabela de segmentos do pipeline (`pipeline_segmentos`) está **desalinhada** da roleta:
  - Pipeline hoje: `S1 - Moradia`, `S2 - Investimento`, `S3 - Foco`, `S4 - Alto Padrão`
  - Roleta (correto): `S1 - Moradia`, `S2 - Investimento`, `S3 - Alto Padrão`, `S4 - MCMV`
  - As funções de entrada de leads casam segmento **por nome** entre as duas tabelas — como não existe "S4 - MCMV" no pipeline, todo lead Flow fica **sem segmento** hoje.

## Objetivo
1. Padronizar os 4 segmentos do pipeline para bater exatamente com a roleta: **S1 Moradia, S2 Investimento, S3 Alto Padrão, S4 MCMV**.
2. Deixar o `flow_novidade2` 100% pronto para disparo: imagem de header + ao clicar **SIM** → lead reativado com carimbo "Flow (MCMV)", empreendimento **Flow** e segmento **S4 - MCMV**.

## Ações

### 1. Padronizar `pipeline_segmentos` (alinhar com a roleta)
Sem perder dados, apenas renomeando linhas existentes:
- Linha atual `S4 - Alto Padrão` (450 leads) → renomear para **`S3 - Alto Padrão`** (ordem 3). Os leads continuam corretamente "Alto Padrão".
- Linha atual `S3 - Foco` (2 leads, ambos Casa Tua) → renomear para **`S4 - MCMV`** (ordem 4) e **mover esses 2 leads Casa Tua para `S1 - Moradia`** (Casa Tua é S1 na roleta), deixando a linha MCMV limpa.
- `S1 - Moradia` e `S2 - Investimento` permanecem iguais.

Resultado: os nomes do pipeline passam a ser idênticos aos da roleta, e o mapeamento automático de segmento por nome (entrada de leads Meta/site) volta a funcionar para Flow e demais empreendimentos.

### 2. Regra de reativação do `flow_novidade2` (clicar SIM)
Atualizar as duas funções de reativação para reconhecer o template Flow:
- `reativar_lead_para_fila_ceo`
- `reativar_oferta_ativa_para_fila_ceo`

Comportamento ao responder **SIM** num disparo de `flow_novidade2` (origem descartados / oferta ativa / combo):
- `empreendimento = "Flow"`
- `segmento = S4 - MCMV`
- Observação/timeline: "🔄 Lead reengajado pelo template flow_novidade2 … Interesse atual: **Flow (MCMV)**" e envio para a **Fila do CEO** (distribuição manual — comportamento padrão já existente).

Ajuste correlato necessário nessas funções: hoje elas apontam Casa Tua/Vivid para a linha que passará a ser "S4 - MCMV". Vou remapear **Casa Tua/Vivid → S1 - Moradia** (coerente com a roleta) e **Lake Baikal → S3 - Alto Padrão**, para nada ficar com segmento trocado após a renomeação.

### 3. Imagem de cabeçalho do disparo
- Subir a arte do Flow (imagem enviada) para o bucket público `campaign-images`, em `reengajamento/flow-novidade2.jpg`.
- Registrar no mapa `TEMPLATE_HEADER_IMAGES` (em `DisparoCustomizadoCard.tsx`): `flow_novidade2 → <URL pública>`. Assim, ao escolher o template na Central de Disparos, a imagem já vem preenchida.

### 4. Ajuste visual da Fila do CEO
- Em `FilaCeoDispatchModal.tsx`, atualizar as cores dos segmentos para os nomes novos: `S3 - Alto Padrão` (âmbar) e `S4 - MCMV` (verde), removendo as chaves antigas `S3 - Foco` / `S4 - Alto Padrão`.

## Validação
- Confirmar via `meta-templates-list` que `flow_novidade2` aparece aprovado.
- Conferir `pipeline_segmentos` = S1 Moradia / S2 Investimento / S3 Alto Padrão / S4 MCMV, e que os 2 leads Casa Tua saíram do segmento antigo.
- Simular reativação (chamar a RPC com `p_template_name='flow_novidade2'`) e verificar: empreendimento "Flow", segmento S4 - MCMV, status `pendente_distribuicao` (Fila do CEO), observação com "Flow (MCMV)".
- Abrir a Central de Disparos e confirmar que ao selecionar `flow_novidade2` a imagem de header aparece automaticamente.

## Observações técnicas
- Renomeações/movimentação de leads são alterações de **dados** (via ferramenta de dados). As duas funções `reativar_*` são alteradas via **migração** (uma só). Ficamos dentro do limite de migrações do dia.
- Nenhuma alteração de schema estrutural (colunas/tabelas) — apenas rótulos de segmento, dados de 2 leads e corpo de 2 funções.
