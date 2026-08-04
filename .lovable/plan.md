# Casa Tua Canoas — novo empreendimento + diferenciação do Casa Tua de Porto Alegre

## O que muda

1. O empreendimento atual "Casa Tua" (Alto Petrópolis, Zona Norte, 2.895 leads) passa a se chamar **Casa Tua Porto Alegre** — mesmo registro, nenhum lead é perdido nem realocado.
2. Entra um empreendimento novo e separado: **Casa Tua Canoas**, segmento S1 - Moradia, já ativo para receber leads do Meta.
3. Nenhum corretor é alocado automaticamente no Canoas — você escolhe em /foco-corretores → Alocação.

## Como o lead do Meta vai cair no lugar certo

A resolução de empreendimento no banco é por correspondência **exata** (form_id → nome do formulário → texto do empreendimento → campanha). Não há risco de o formulário "Uhome - Casa Tua Canoas - Pré-lançamento" cair no Casa Tua de POA por semelhança de nome. Para garantir acerto desde o primeiro lead, cadastro apelidos exatos apontando para o Canoas:

- `Uhome - Casa Tua Canoas - Pré-lançamento` (tipo formulário)
- `Lead gerado do formulário de Uhome - Casa Tua Canoas - Pré-lançamento` (tipo formulário, formato que o Meta usa no CRM)
- `Casa Tua Canoas` (texto do empreendimento)
- `Casa Tua Canoas` (campanha)

Os apelidos históricos genéricos (`casa tua`, `casa tua - uhome`, `casa tua - junho 2026`, etc.) continuam apontando para o **Casa Tua Porto Alegre**, então campanhas antigas seguem funcionando.

Quando você me passar o **ID do formulário** do Meta, adiciono também o apelido por ID (a trava mais forte, imune a mudança de nome do formulário).

## Verificação depois de aplicar

- Os dois "Casa Tua" aparecem separados em /foco-corretores → Empreendimentos.
- Casa Tua Canoas aparece na lista de escolha de alocação por corretor.
- Os 2.895 leads históricos continuam sob Casa Tua Porto Alegre (contagem conferida antes/depois).
- Primeiro lead real da campanha: confiro se o `empreendimento_canonico_id` gravou o Canoas.

## Detalhes técnicos

- Data change (tool de dados, sem migration de schema):
  - `UPDATE empreendimentos_canonicos SET nome='Casa Tua Porto Alegre' WHERE id='4c1b897c-3e1a-4d98-a68b-95e62e1f0a45'`.
  - `INSERT` em `empreendimentos_canonicos`: nome `Casa Tua Canoas`, `segmento_id = 9948f523-...` (S1 - Moradia), `ativo = true`.
  - `INSERT` em `empreendimento_aliases` (tipos `formulario`, `empreendimento_texto`, `campanha`) com `alias_norm` via `normalize_alias()`, `ON CONFLICT (alias_norm, tipo) DO NOTHING` — não sobrescreve apelido já existente do POA.
  - Nenhum `corretor_alocacao` é tocado.
- Frontend: acrescentar `Casa Tua Canoas` e renomear `Casa Tua` → `Casa Tua Porto Alegre` na lista estática `src/lib/empreendimentos.ts` (usada pelos seletores da Oferta Ativa). Nada mais no frontend depende de nome fixo para essa tela.
- Fora do escopo desta fase (strings antigas de "Casa Tua" em funções de IA/knowledge base e mapas de webhook continuam se referindo ao empreendimento de Porto Alegre, comportamento inalterado). Se quiser, faço uma fase 2 criando a ficha de conhecimento do HOMI para o Canoas.
