## Objetivo

Deixar o **VIVID TERRACE** pronto para entrar em campanha, roleta de leads e disparo Meta, classificado como **S5 - Produto Foco**.

Dados informados:
- Código Jetimob: **58498-UH**
- Campanha Meta: **4076**
- Segmento: **S5 - Produto Foco**

## Situação atual

- Não existe nenhum registro de "Vivid Terrace" (só existe um "Terrace" antigo no segmento S2 - Médio Padrão, que não será tocado).
- A campanha 4076 ainda não está mapeada.
- O segmento "S5 - Produto Foco" já existe na roleta (`id 5311aaaa-...-005`) — mesmo segmento usado hoje pelo Casa Tua.

## O que será feito (inserção de dados, sem mudança de estrutura)

1. **Mapeamento da campanha Meta** (`jetimob_campaign_map`):
   - campaign_id `4076` → empreendimento "Vivid Terrace", segmento "Produto Foco", nota com o código do imóvel `58498-UH`.
   - Isso garante que os leads vindos do disparo/anúncio Meta da campanha 4076 entrem identificados como Vivid Terrace.

2. **Campanha da roleta** (`roleta_campanhas`):
   - empreendimento "Vivid Terrace" → segmento_id `S5 - Produto Foco`, ativo = true.
   - Esta é a fonte de verdade do segmento: garante que os leads sejam distribuídos no rodízio de Produto Foco.

Com esses dois registros, a entrada de leads (roleta) e o disparo/captura Meta ficam apontando para o segmento correto. O empreendimento aparecerá automaticamente nos fluxos que leem essas tabelas.

## Observação técnica

- O nome do empreendimento será gravado idêntico ("Vivid Terrace") nas duas tabelas para que a resolução de segmento (que cruza `jetimob_campaign_map` → `roleta_campanhas` pelo nome) funcione.
- `pipeline_segmentos` não possui um item "Produto Foco" (mesmo caso do Casa Tua hoje); o segmento operacional vem da `roleta_campanhas`, então nada precisa mudar lá. Caso você queira que "Produto Foco" também vire um segmento próprio no pipeline (em vez de cair como sem-segmento), posso incluir — me avise.
