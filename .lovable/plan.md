# Bug: corretor recebe push do lead mas /aceite não mostra nada

## Diagnóstico (caso Anderson + Glenda Pires, 17/05 13:01 BRT)

O lead `d835c9fc-4931-4044-85ab-fdf603593cee` (Glenda Pires) hoje à tarde:

- Disparou notificação "Novo lead recebido" para Anderson (13:01 BRT)
- Disparou alertas "⚡ Faltam 2 min" e "🚨 Último aviso"
- Disparou push e WhatsApp
- Disparou "⏰ Lead perdido por expiração" (13:12 BRT)

Mas no banco o lead permaneceu:
- `corretor_id = NULL`
- `aceite_status = 'pendente_distribuicao'`
- `distribuido_em = NULL`
- `aceite_expira_em = NULL`

A tela `/aceite` filtra por `corretor_id IN (...)` e `aceite_status IN ('pendente','aguardando_aceite','pendente_aceite')`. Como os 4 campos estão nulos, o lead nunca apareceu — apesar de o corretor ter sido notificado.

## Causa raiz

`supabase/functions/distribute-lead/index.ts` linhas 191-201:

```ts
.from("pipeline_leads")
.update({ corretor_id, aceite_status: "aguardando_aceite", distribuido_em, aceite_expira_em })
.eq("id", leadId)
.in("aceite_status", ["pendente", "aguardando_aceite", "pendente_aceite"])
```

A RPC `distribuir_lead_atomico` retorna `success` com o `corretor_id` escolhido, mas no banco o lead permanece em `aceite_status = 'pendente_distribuicao'` (estado pré-distribuição). O filtro `.in()` foi pensado como guarda contra corrida, porém **não inclui** `pendente_distribuicao` — então o UPDATE vira **no-op silencioso** (não retorna erro, só não afeta linhas).

O fluxo seguinte (notification insert + push + WhatsApp) executa normalmente, gerando a percepção de "lead distribuído" no lado do corretor enquanto o backend continua com o lead órfão.

Há **7 leads** atualmente nesse limbo desde 15/05.

## Correção

### 1. Edge `distribute-lead/index.ts`
- Incluir `'pendente_distribuicao'` no filtro `.in()` do UPDATE (linha 201) para cobrir o estado real pós-RPC.
- Capturar `count` do UPDATE (`.select('id')` + checagem) e, se zero linhas afetadas, **logar erro em `ops_events`** e **não enviar push/WhatsApp/notification** — assim nunca mais o corretor recebe notificação de um lead que não foi efetivamente atribuído.
- Mesmo cuidado para o UPDATE de `roleta_distribuicoes` (linhas 209-217).

### 2. Recuperar os 7 leads travados
Migration única que para cada lead com:
- `corretor_id IS NULL`
- `aceite_status = 'pendente_distribuicao'`
- existe `roleta_distribuicoes` com `status = 'aguardando'` apontando para um corretor

devolve o lead para a fila CEO limpa (status `pendente_distribuicao`, sem distribuição pendente), permitindo o próximo dispatch manual normalmente. Não vamos reatribuir automaticamente para evitar surpresa — gestor/CEO redispatcha pelo botão habitual.

### 3. Validação
- Rodar nova distribuição manual de um lead de teste, confirmar que `pipeline_leads.corretor_id`, `aceite_status='aguardando_aceite'`, `distribuido_em` e `aceite_expira_em` ficam preenchidos.
- Confirmar que aparece em `/aceite` do corretor escolhido.
- Verificar logs `ops_events` para a nova categoria de erro (caso volte a acontecer).

## Arquivos alterados

- `supabase/functions/distribute-lead/index.ts` (correção do filtro + fail-fast)
- 1 migration SQL para limpar os 7 leads órfãos

## Não muda

- Lógica da RPC `distribuir_lead_atomico` (segue intacta)
- Lógica do timer de 10 min (segue a partir do envio da notificação)
- UI de `/aceite` (segue igual)
- Fluxo de push, WhatsApp e sininho
