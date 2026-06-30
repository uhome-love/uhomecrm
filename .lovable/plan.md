## Objetivo

Hoje a aba que abre por padrão ("Estagnados") na verdade mostra os leads que **ainda não estagnaram** (apenas passaram do prazo). Isso confunde. Vamos inverter: a aba principal passa a mostrar os leads **realmente confirmados como estagnados**, que é o que gestor/CEO precisam gerir.

## O que muda (apenas rótulos e ordem das abas)

Na página **Leads Estagnados**:

- **Aba principal (abre por padrão) → "Estagnados"**: lista os leads que **já estagnaram de fato** (confirmados) — os que gestor e CEO decidem (devolver, repassar, roleta, descartar). Hoje essa categoria existe como "Confirmados".
- **Aba → "A estagrar"** (texto: `A estagnar`): leads que passaram do prazo mas ainda são recuperáveis pelo corretor. Hoje chama-se "Estagnados".
- **Em aviso (48h)** e **Em parceria**: permanecem iguais.

Nova ordem das abas: **Estagnados** · A estagnar · Em aviso (48h) · Em parceria.

## Detalhes técnicos

Arquivo único: `src/pages/LeadsEstagnados.tsx`.

1. Ajustar o array `TABS` (linhas 54-59):
   - `estagnado` → label **"Estagnados"** e movido para primeira posição.
   - `candidato` → label **"A estagnar"**.
   - `em_aviso` e `em_parceria` mantêm labels, vêm depois.
2. Mudar o estado inicial da aba (linha 89) de `"candidato"` para `"estagnado"`, para abrir já nos confirmados.

Nenhuma mudança de lógica de banco, RPC (`get_pipeline_estagnacao`) ou regras de estagnação — apenas nomenclatura e ordem/seleção padrão das abas. As contagens (badges) continuam funcionando pois usam o mesmo mapa de categorias.
