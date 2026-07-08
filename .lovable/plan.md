# Reorganização completa dos Segmentos (roleta + credenciamento) — ponta a ponta

## Estrutura final

| # | Segmento (novo nome) | Cor | Empreendimentos ativos |
|---|----------------------|-----|------------------------|
| 1 | Moradia | Azul | Vivid, Vivid Terrace, Casa Tua, Avulso, Terrace |
| 2 | Investimento | Verde-claro | Connect JW, Shift |
| 3 | Alto Padrão | **Dourado** | Lake Baikal |
| 4 | MCMV | **Verde** | Flow (da MGF) |

Mudanças de nome: **S3 "Foco" → "Alto Padrão"** e **S4 "Alto Padrão" → "MCMV"**. Todos os empreendimentos fora da lista acima são **desativados** (reorganização limpa). "Avulso" agrupa os leads do ImóvelWeb e do site.

## Etapa 1 — Banco de dados (dados, IDs preservados)

`roleta_segmentos` (renomear rótulo, mesmos IDs para não quebrar credenciamentos/fila/distribuições existentes):
- `5311aaaa…` (ordem 3): `S3 - Foco` → **`S3 - Alto Padrão`**
- `93ca556c…` (ordem 4): `S4 - Alto Padrão` → **`S4 - MCMV`**

`roleta_campanhas` (fonte da verdade empreendimento→segmento):
- Desativar (`ativo=false`) tudo que não está na lista final (Open Bosque, Alto Lindóia, isla, Las Casas, Ápice, Orygem, Átrio, Casa Bastian, etc.).
- Moradia `9948f523…`: Vivid, Vivid Terrace, Casa Tua, **Avulso (criar)**, Terrace → ativos e no segmento correto (mover Vivid/Vivid Terrace/Casa Tua de Foco→Moradia).
- Investimento `409aeddf…`: Connect JW, Shift → ativos.
- Alto Padrão `5311aaaa…`: mover **Lake Baikal** para este segmento e ativar.
- MCMV `93ca556c…`: **Flow (criar)** ativo.

Observação "Avulso": a roleta define o segmento pelo empreendimento do lead. Vou criar a campanha "Avulso" em Moradia; leads de ImóvelWeb/site cujo empreendimento chega como "Avulso" (ou vazio) caem aqui. Se hoje chegam com outro rótulo, aponto o ajuste do mapeamento de origem em seguida.

## Etapa 2 — Código (eliminar tudo do modelo antigo, sem código morto)

**`src/hooks/useRoletaSegmentos.ts`**
- `S3` passa a ser dourado (ícone 🏆) e `S4` passa a ser verde (ícone 🏘️).
- `SEGMENTO_VISUALS`: chave `"s3 - foco"` → `"s3 - alto padrão"` (dourado); `"s4 - alto padrão"` → `"s4 - mcmv"` (verde). Manter aliases legados apontando para os novos para dados históricos não quebrarem.
- Atualizar comentários dos IDs (S3 = Alto Padrão, S4 = MCMV).

**`src/hooks/useCorretorDisponibilidade.ts`** (`SEGMENTOS_OFICIAIS`)
- Reescrever os 4 segmentos com nomes, badges, cores e empreendimentos da tabela final.

**`src/components/settings/RoletaCampanhasPanel.tsx`**
- Remover o mapa `segmentColor` hardcoded com nomes mortos ("S1 - MCMV / Médio Padrão", "S3 - Avulso", etc.) e passar a colorir via `getSegmentoVisual` (mesma fonte visual do resto do app), eliminando divergência.

**`src/lib/empreendimentos.ts`**
- Garantir na lista: Vivid, Vivid Terrace, Connect JW, Lake Baikal, Avulso, Flow (adicionar os que faltarem).

## Etapa 3 — Validação ponta a ponta

- **Credenciamento (corretor):** abrir a Roleta como corretor e conferir que os 4 segmentos aparecem com nomes/cores novos e que dá para credenciar em Moradia/Investimento/Alto Padrão/MCMV.
- **Central de Roleta (CEO/admin):** aba "Parâmetros & Segmentos" mostra os 4 segmentos e só os empreendimentos ativos corretos; modal "Incluir" lista os segmentos novos.
- **Distribuição:** conferir que um lead de empreendimento remapeado (ex.: Lake Baikal → Alto Padrão) resolve o segmento certo.
- **Disponibilidade:** painel usa os novos badges/cores.
- Rodar build/typecheck; garantir que nenhuma referência aos nomes antigos ("Foco" como S3, "Alto Padrão" como S4) permanece ativa no código.

## Detalhes técnicos
- Renomeações e remapeamentos são operações de dados (UPDATE/INSERT), sem mudança estrutural de tabela.
- IDs mantidos: `9948f523`(1), `409aeddf`(2), `5311aaaa`(3), `93ca556c`(4) — só muda rótulo + vínculos de empreendimento.
- Validação com Playwright na rota `/roleta` (visão corretor e admin) para confirmar render real.
