## Objetivo

Reorganizar os segmentos da roleta de leads para junho em **6 segmentos**, redistribuir os empreendimentos e deixar **ativos apenas os que estão no ar**, mantendo o restante mapeado porém inativo.

## Como a roleta resolve segmento (confirmado)

- O segmento de um lead é resolvido pela tabela `roleta_campanhas` (empreendimento → `segmento_id`), via correspondência por nome. Os nomes dos segmentos ficam em `roleta_segmentos`.
- **Avulso** é o fallback automático: qualquer lead sem campanha correspondente e cuja origem não seja "geral" cai em Avulso. Como **ImóvelWeb e Site** chegam como "Avulso - ImovelWeb"/origem própria (não jetimob), eles já caem em Avulso automaticamente — **não precisa cadastrar empreendimento** para o Avulso.

## Estrutura final dos 6 segmentos

```text
S1 - MCMV          → Open Bosque, isla, Alto Lindóia            [NO AR]
S2 - Médio Padrão  → Las Casas [NO AR] + demais médios (inativos)
S3 - Avulso        → ImóvelWeb + Site (fallback automático)     [NO AR]
S4 - Investimento  → Shift, Átrio [NO AR] + demais (inativos)
S5 - Produto Foco  → Casa Tua                                   [NO AR]
S6 - Alto Padrão   → atuais empreendimentos (todos inativos)
```

### Renomear segmentos (`roleta_segmentos`)
- `S1 - MCMV / Médio Padrão` → **`S1 - MCMV`**
- `Médio-Alto Padrão` (hoje inativo) → **`S2 - Médio Padrão`** + ativar
- `S2 - Alto Padrão` → **`S6 - Alto Padrão`**
- `S3 - Avulso`, `S4 - Investimento`, `S5 - Produto Foco` → mantidos

### Reatribuir empreendimentos (`roleta_campanhas`)

**S1 - MCMV** (ativos): Open Bosque, isla, Alto Lindóia

**S2 - Médio Padrão**: Las Casas (ativo); Orygem, Melnick Day, Me Day, Melnick Day Medio Padrao (mapeados, **inativos**)

**S4 - Investimento**: Shift (ativo), **Átrio - ABF movido de Produto Foco** (ativo); Casa Bastian, Melnick Day Compactos, Alfa, Go Carlos Gomes, Connect JW, skyline menino deus (mapeados, **inativos**)

**S5 - Produto Foco**: Casa Tua (ativo) — Átrio sai daqui

**S6 - Alto Padrão**: Lake Eyre, Seen Menino Deus, Melnick Day Alto Padrao, Boa Vista Country Club, Seen Três Figueiras, High Garden Iguatemi → todos **inativos**

## Passos de implementação

1. **Dados — `roleta_segmentos`**: atualizar os 3 nomes e ativar o segmento "S2 - Médio Padrão".
2. **Dados — `roleta_campanhas`**: atualizar `segmento_id` e `ativo` de cada empreendimento conforme o mapa acima (Átrio passa para Investimento; médios e investimento extras viram inativos; alto padrão tudo inativo; MCMV com Alto Lindóia).
3. **Frontend — `src/hooks/useRoletaSegmentos.ts`**: atualizar `SEGMENTO_VISUALS` para os novos nomes (`s1 - mcmv`, `s2 - médio padrão`, `s6 - alto padrão`) mantendo ícones/cores coerentes (MCMV 🏠, Médio Padrão, Alto Padrão 🏆), preservando chaves antigas como compatibilidade.
4. **Verificação**: reconsultar o join `roleta_campanhas × roleta_segmentos` para confirmar o estado final e checar o painel em Configurações → Roleta/Campanhas.

## Notas técnicas

- Alterações de `roleta_segmentos`/`roleta_campanhas` são **dados** (UPDATE), feitas pela ferramenta de dados — não por migração de schema.
- Nenhuma mudança na função `distribuir_lead_atomico` (a lógica de Avulso/fallback já cobre ImóvelWeb e Site).
- A ordenação na UI é alfabética por nome; o prefixo S1..S6 garante a ordem correta.
