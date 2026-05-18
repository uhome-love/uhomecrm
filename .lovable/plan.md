## Auditoria das respostas do reengajamento (hoje, 18/05)

### 1. Respostas via botão (template Meta) — 19 respostas

Estas estão classificadas corretamente. Vieram pelo botão `Sim, quero receber` / `Não, agradeço`:

| Hora BRT | Nome | Resposta | Status no lead | Ação tomada |
|---|---|---|---|---|
| 17:45 | Gabriela | ❌ Não | enviado (não atualizado) | — |
| 17:28 | Caroline Bruno Mariano | ❌ Não | respondeu_nao | descarte definitivo |
| 17:07 | Talita Vilani | ❌ Não | respondeu_nao | descarte definitivo |
| 16:36/16:35 | T I • | ❌ Não (2×) | respondeu_nao | descarte definitivo |
| 16:23 | João Antonio Kuhn | ❌ Não | respondeu_nao | descarte definitivo |
| 16:17 | Julia Bazanella | ❌ Não | respondeu_nao | descarte definitivo |
| 16:05/16:03/15:52 | Nina Cortes Jardim | ❌ Não (3×) | respondeu_nao | descarte definitivo |
| 16:02 | Fábio Augusto | ❌ Não | respondeu_nao | descarte definitivo |
| 15:53/15:52/15:46 | Matheus Martins | ❌ Não (3×) | enviado (não atualizado) | — |
| **15:45 / 15:40** | **Wladiston Furtado Pereira** | ✅ **Sim** (2×) | respondeu_sim | **reativado e distribuído** ✅ |
| 15:45/15:42/15:40 | Pâmella Taborda Souza | ❌ Não (4×, inclui "Nao, obrigado.") | enviado (não atualizado) | — |

**Resumo botões:** 1 SIM real (Wladiston, contado 2×) + 17 NÃO = 19 respostas. Lead SIM foi corretamente enviado para roleta.

### 2. Respostas via TEXTO LIVRE (sem usar botões) — bug crítico

A Meta entrega respostas em texto livre via `whatsapp-webhook` (não pelo Evolution). Encontrei 1 caso problemático hoje:

**Flávia Balestera (telefone 51991230409)**
- Texto recebido: *"Oii querida no momento não tenho interesse"*
- **O sistema criou um lead NOVO** (id `b056fc23...`, phone gravado errado: `555191230409` — 12 dígitos) e mandou para roleta às 19:17 BRT.
- O lead original (`971f2e9a...`) está intacto, mas foi gerado um duplicado.
- **Causa raiz nº 1 — regex de intenção positiva**: em `whatsapp-webhook/index.ts` (linha 54-64), `isPositiveIntent` checa `\btenho interesse\b` sem olhar negação antes. "**Não** tenho interesse" → falso positivo.
- **Causa raiz nº 2 — match de telefone**: webhook Meta recebeu `555191230409` (12 dígitos, 55 duplicado pela origem do número); a busca por lead existente não normalizou e tratou como remetente novo.
- **Causa raiz nº 3 — ordem de avaliação no caminho "remetente novo"** (linhas 862-871): só consulta `isPositiveIntent`. Quando a frase tem ambíguo, deveria checar `isNegativeIntent` antes e descartar.

Outros 2 leads "remetente novo" hoje (válidos): Wladiston ("Sim quero receber") e Rosane ML ("Quero saber mais").

### 3. Bug secundário no Evolution webhook

`evolution-webhook/index.ts` (linha 429) exige que a resposta **comece** com "não" e tenha < 60 chars. Frases como "Oii querida no momento não tenho interesse" classificam como `respondeu_outro` em vez de `respondeu_nao` — não cria descarte definitivo.

### 4. Bug terciário: leads com botão "Não" ficaram com `reengajamento_status='enviado'`

Gabriela, Matheus Martins (3×), Pâmella (4×) responderam botão NÃO mas o campo não foi atualizado para `respondeu_nao`. Isso indica que a atualização do status só acontece em algumas rotas. (Investigar `whatsapp-webhook` → tratativa de botões antes de prosseguir.)

---

## Plano de correção

### Passo 1 — Corrigir `isPositiveIntent` (whatsapp-webhook)

Antes de retornar `true`, verificar se há negação ("não", "nao", "sem") nos 3 tokens anteriores ao match. Se houver negação, retornar `false`. Adicionar também short-circuit: se `isNegativeIntent(text)` for true, `isPositiveIntent` sempre retorna `false`.

### Passo 2 — Normalização de telefone no caminho "remetente novo"

Ao buscar lead pelo número recebido da Meta, tentar variações canônicas:
- Remover prefixo `55` duplicado (`555191230409` → `5191230409` ou `51991230409` com o 9).
- Match por últimos 8 dígitos (já existe em outras partes do código — reusar `phone-normalization`).

### Passo 3 — Caminho "remetente novo" só dispara se NÃO houver intenção negativa explícita

Em `whatsapp-webhook/index.ts` linha 862, adicionar guarda: `if (isNegativeIntent(msgText)) { log + return; }` **antes** de criar lead novo.

### Passo 4 — Relaxar `NEGATIVE_STRICT` do Evolution

Substituir a exigência de "começa com" por "contém negação clara dentro dos primeiros 80 chars": `n[aã]o\s*(quero|tenho\s+interesse|me\s+interess|preciso|obrigad)`, removendo o limite de 60 chars e a âncora `^`.

### Passo 5 — Cleanup do caso Flávia + retroativo

- Arquivar/descartar o lead duplicado `b056fc23-3717-484c-bf37-51b23c61be5e`.
- Marcar lead original `971f2e9a...` com `reengajamento_status='respondeu_nao'` e `tipo_descarte='definitivo'`.
- Atualizar `reengajamento_status='respondeu_nao'` nos leads que responderam botão NÃO mas ficaram presos em `enviado` (Gabriela, Matheus Martins, Pâmella).

### Passo 6 — Painel de auditoria

Na aba **Auditoria & Webhook** de `/central-nutricao`, adicionar bloco **"Respostas recebidas hoje"** com:
- Listagem cronológica de cada resposta (botão e texto livre).
- Classificação automática (✅ SIM / ❌ NÃO / ❓ Outro) e ação efetiva (reativado, descartado, ignorado).
- Destaque vermelho em discrepâncias (ex.: lead novo criado em cima de resposta negativa).
- Filtro por origem (Evolution botão / Meta texto livre / remetente novo).

### Arquivos a alterar

- `supabase/functions/whatsapp-webhook/index.ts` — passos 1, 2, 3
- `supabase/functions/evolution-webhook/index.ts` — passo 4
- Migration SQL — passo 5 (cleanup retroativo)
- `src/components/central-nutricao/AuditoriaWebhookTab.tsx` (+ novo componente `RespostasRecebidasHoje.tsx`) — passo 6
