# Reestruturação dos Segmentos da Roleta

## Objetivo

Consolidar os 4 segmentos atuais em uma nova nomenclatura (S1–S4 + Geral), reorganizar empreendimentos, tratar leads "avulsos" (ImovelWeb / Site) por origem, e dar ao CEO uma tela onde ele consiga fazer essas mudanças sozinho daqui para frente.

## Nova estrutura

| Segmento | Empreendimentos |
|---|---|
| **S1 — MCMV / Médio Padrão** | Open Bosque, Isla, Las Casas, Orygem, Alto Lindóia, *(Melnick Day, Me Day, Melnick Day Médio Padrão — manter aqui, ajustável na UI)* |
| **S2 — Alto Padrão** | Lake Eyre, Boa Vista Country Club, Seen Menino Deus, Seen Três Figueiras, Melnick Day Alto Padrão, High Garden Iguatemi |
| **S3 — Avulso** | *(sem empreendimentos — entra por origem do lead: `imovelweb` e `site_uhome`)* |
| **S4 — Investimento** | Casa Bastian, Shift, Connect JW, Skyline Menino Deus, Alfa, Go Carlos Gomes, Melnick Day Compactos |
| **Geral** | Casa Tua *(flag `ignorar_segmento=true` — recebido por todos)* |

## Mudanças no banco (migração SQL)

1. **`roleta_segmentos`**
   - Renomear `MCMV / Até 500k` → `S1 - MCMV / Médio Padrão`
   - Renomear `Altíssimo Padrão` → `S2 - Alto Padrão`
   - Renomear `Investimento` → `S4 - Investimento`
   - Inserir `S3 - Avulso`
   - Mover todas as campanhas de `Médio-Alto Padrão` para S1; depois `ativo=false` no segmento Médio-Alto (mantém histórico).

2. **`roleta_campanhas`** — UPDATE em massa para reposicionar cada empreendimento conforme a tabela acima. `Casa Tua` permanece com `ignorar_segmento=true`.

3. **`roleta_credenciamentos`** (migração automática conforme escolhido):
   - Quem está em `MCMV` ou `Médio-Alto` → vira S1
   - Quem está em `Altíssimo` → vira S2
   - Quem está em `Investimento` → vira S4
   - Se após o remap `segmento_1_id == segmento_2_id`, zera o `segmento_2_id`.

## Mudanças no código

1. **`supabase/functions/distribute-lead/index.ts`**
   - Adicionar resolução de segmento por **origem** (fallback): se o lead não casa com nenhuma `roleta_campanhas` por empreendimento E `origem ∈ {imovelweb, site_uhome}`, usa S3 - Avulso.
   - Mantém a regra atual: campanha vence; depois origem; depois fila CEO.

2. **`receive-imovelweb-lead` e `receive-landing-lead` (site)**
   - Garantir que a `origem` gravada no `pipeline_leads` está nos valores esperados (`imovelweb`, `site_uhome`) para o matching acima.

3. **UI de credenciamento (`RoletagensTab` / tela de credenciar)**
   - Os 5 segmentos (S1, S2, S3, S4, Geral) ficam visíveis e selecionáveis pelo corretor.
   - Mantém o limite de **2 segmentos** por turno (já existe `segmento_1_id` / `segmento_2_id`); adicionar validação client-side com mensagem clara: *"Selecione no máximo 2 segmentos"*.
   - Geral (Casa Tua) NÃO conta como segmento — todos recebem por padrão.

4. **Tela de auto-gestão (CEO/Admin) — `RoletaConfigTab` + `RoletaCampanhasPanel`**
   - Adicionar capacidade de **criar / renomear / ativar-desativar segmentos** direto na UI (hoje só é possível mexer em campanhas).
   - Manter drag/select para mover empreendimento entre segmentos (já existe).
   - Toggle "Geral (todos recebem)" por empreendimento (já existe via `ignorar_segmento`).
   - Resultado: o CEO consegue fazer rearranjos futuros sem pedir alteração no chat.

## Arquivos afetados

- `supabase/functions/distribute-lead/index.ts` — fallback por origem para S3
- `src/components/roleta/RoletaConfigTab.tsx` — CRUD de segmentos
- `src/components/settings/RoletaCampanhasPanel.tsx` — refletir 5 segmentos (incl. S3)
- `src/components/roleta/RoletagensTab.tsx` — limite de 2 + S3 selecionável
- `src/hooks/useRoletaSegmentos.ts` — visual (ícone/cor) para S3 e atualizar mapas para os novos nomes
- Migração SQL via tool de migração (schema rename) + tool de insert (UPDATE de dados)

## Pontos de atenção

- Memória `[Roleta Segment Source of Truth]` continua válida: segmento sempre resolvido via `roleta_campanhas`/origem, nunca via `pipeline_leads.segmento_id`.
- Após a migração, atualizar memória `[Roleta Segments]` com a nova nomenclatura S1–S4.
- Leads históricos em `pipeline_leads.segmento_id` permanecem com o UUID antigo (que continua válido, só foi renomeado) — sem necessidade de backfill.

Posso aplicar?
