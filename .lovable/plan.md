## Contexto do diagnóstico

**1. O lead "sumido" (Rômulo / network, parceria Leo Dorneles + Jessica)**
Localizei o lead:
- `id`: `53fd5397-b2e5-4ef0-a741-c295c7278b3a`
- Nome: **Rômulo (network)** · tel `510000000001` · etapa **Em Negociação** · negócio R$ 450k (fase proposta)
- Corretor: **Leo Dorneles** · parceria com Jessica

Ele **não some por bug** — foi **inativado hoje** (13/07, 19:01 BRT):
- `arquivado = true`
- `tipo_descarte = definitivo`
- `motivo_descarte = "Inativado: Teste"`

Ou seja, alguém rodou uma inativação com motivo "Teste". Lead inativado sai do board e de todas as listas — por isso "sumiu".

**2. Nome do lead ilegível em parceria**
No card do pipeline (`CardMinimal.tsx`), quando é parceria o nome do lead divide a MESMA linha com o badge roxo "🤝 Parceria" **e** o badge de substatus (ex.: "Aprov. proprietário"). Em cards estreitos os dois badges ocupam quase toda a largura e o nome (`flex-1 truncate`) é espremido até desaparecer. Confirmado com o lead de nome longo "Dra. Eloisa Soldera | Harmonização Facial | Porto Alegre".

---

## Plano

### Parte 1 — Restaurar o lead Rômulo (network)
Reverter a inativação via atualização de dados no lead `53fd5397-b2e5-4ef0-a741-c295c7278b3a`:
- `arquivado` → `false`
- `tipo_descarte` → `null`
- `motivo_descarte` → `null`

Ele permanece na etapa **Em Negociação** (nada mais mudou), então volta a aparecer no board do Leo imediatamente. Sem alteração de schema.

### Parte 2 — Corrigir o visual do nome em parceria
Reestruturar o cabeçalho do `CardMinimal.tsx` para que o **nome do lead fique sempre em uma linha própria, largura total e legível**:
- Linha 1: badges (Novo / 🤝 Parceria / substatus / cadência) — podem quebrar/encolher à vontade.
- Linha 2: nome do lead em `text-foreground`, `font-semibold`, largura total (sem competir com badges).

Isso resolve a ilegibilidade tanto no tema claro quanto no escuro e vale para todos os cards (não só parceria). O rodapé com o nome do parceiro continua como está.

### Verificação
- Conferir no preview que o card de parceria mostra o nome completo do lead.
- Confirmar que o lead Rômulo reaparece na coluna "Em Negociação".
- `tsgo` para validar tipos.

### Detalhes técnicos
- Arquivo de código: `src/components/pipeline/CardMinimal.tsx` (bloco do header, ~linhas 309-354).
- Dados: update em `pipeline_leads` (1 linha), sem migração de schema.
