# Rastreio de campanha específica em Vendas Realizadas

## Objetivo
Na aba **Origens & Campanhas** da página Vendas Realizadas, exibir o formulário/campanha específico que originou cada venda (não só a origem geral como "meta_ads"), com o **nome real** da campanha — inclusive quando o lead vier com um ID numérico de formulário Meta que hoje aparece como "Formulário Meta".

## Situação atual
- A tabela `pipeline_leads` guarda `origem` (ex: `meta_ads`, `TikTok Ads`) e `origem_detalhe` (o formulário/campanha, ex: `Casa Tua`, ou um ID numérico como `1575975843886888`).
- O bloco "Performance por origem" agrupa **só** por `origem` geral.
- A coluna "Detalhe" já usa `resolveFormName()` (mapa estático em `metaFormIdMap.ts`), mas IDs numéricos não cadastrados viram o genérico "Formulário Meta".

## Mudanças

### 1. Cache de nomes de formulário Meta (novo)
Criar tabela `meta_form_names` para guardar de forma persistente o mapeamento ID → nome real do formulário:
- Campos de domínio: `form_id` (chave), `form_name`, `fonte` (ex: graph_api / manual).
- Leitura liberada para usuários autenticados; escrita apenas via backend.

### 2. Edge function `resolve-meta-forms` (nova)
- Recebe uma lista de IDs de formulário.
- Retorna os já conhecidos do cache; para os desconhecidos, consulta a Graph API da Meta (`/{form_id}?fields=id,name`) usando o token já existente `META_GRAPH_API_TOKEN`, grava no cache e retorna.
- IDs que a Meta não resolver ficam registrados como "não encontrado" para evitar novas chamadas repetidas.

### 3. Frontend `src/pages/VendasRealizadas.tsx`
- Após carregar as vendas, coletar os `origem_detalhe` que são IDs numéricos não mapeados e chamar a `resolve-meta-forms` para obter os nomes reais; mesclar esse resultado com o mapa estático.
- **Agrupar "Performance por origem" por campanha específica**: o agrupamento passa a ser por `origem + campanha/formulário` (ex: "Meta Ads · Casa Tua", "Meta Ads · Orygem (Vídeo Gabrielle)"), mostrando contagem de vendas, VGV, % e empreendimentos por campanha. Origens sem detalhe (ex: Oferta Ativa sem campanha) permanecem agrupadas pela origem.
- Manter a tabela "Rastreio completo — Lead → Venda", garantindo que a coluna "Detalhe" mostre sempre o nome real da campanha (nunca número cru nem "Formulário Meta" quando a Meta souber o nome).

## Detalhes técnicos
- A resolução de nomes é incremental e cacheada: só bate na Meta para IDs ainda desconhecidos, então o custo de API é mínimo após o primeiro carregamento.
- `metaFormIdMap.ts` continua como fonte primária (rápida, offline); o cache do banco + Meta é o fallback para IDs numéricos desconhecidos.
- Nenhuma alteração em como os leads são captados — só na exibição/rastreio das vendas.
