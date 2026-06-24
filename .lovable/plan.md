## Contexto

Disparos Meta começam bem e depois "falham tudo" (ex.: 265 enviados → 36 entregues → 2 cliques). A causa raiz tem **dois componentes**:

1. **Throttle da Meta (cód. 131049 — "healthy ecosystem engagement"):** 14.904 falhas. É *pacing dinâmico* por qualidade/frequência. Em base descartada (fria), o índice de não-lidos/bloqueios sobe, a qualidade do número cai e a Meta passa a **derrubar uma fração crescente** das mensagens — daí o efeito "cascata" de começar bem e degradar.
2. **Bug nosso — "Media upload error":** 1.478 falhas. Enviamos a imagem do header como `link` a cada mensagem; quando o proxy `api.uhomesales.com` fica lento/retorna não-200, a Meta falha o envio.

Como a base é descartada (fria) por natureza, não dá para "esquentar" a audiência — então a estratégia é **proteger a qualidade do número e parar de gastar disparo com números que já recusam**, além de eliminar o bug da imagem.

## O que será feito (pacote completo, priorizando entrega)

### 1. Eliminar "Media upload error" — usar media handle da Meta
- Em vez de `image: { link: url }` a cada envio, subir a imagem **uma vez** via Resumable Upload API da Meta e reutilizar o `header_handle` em todos os envios do lote.
- Implementação: helper que, no início do lote, verifica se já existe handle válido para a imagem; se não, faz upload e cacheia (na config do batch). Fallback para `link` só se o upload falhar.
- Impacto esperado: zera os ~1.478 "Media upload error".

### 2. Lista de supressão automática por código de falha
- Toda falha com código **131049, 131026 (undeliverable), opt-out e 131050 (experiment)** alimenta uma tabela `meta_supressao` (telefone normalizado + código + data).
- Antes de cada lote, o dispatcher **exclui** números presentes na supressão (com janela: opt-out/undeliverable = permanente; 131049/experiment = cooldown de X dias).
- Impacto: para de re-disparar para quem recusa, o que hoje afunda a qualidade a cada nova campanha.

### 3. Proteção de qualidade — auto-pausa por taxa de entrega
- O dispatcher passa a calcular a **taxa de entrega móvel** (entregues / enviados) dos últimos N envios via webhook de status.
- Se a taxa cair abaixo de um limiar (ex.: <40% nas últimas 50 confirmações), **auto-pausa** o batch e registra o motivo, para a qualidade do número recuperar em vez de continuar queimando.
- Banner/aviso no painel de Disparos quando pausado por qualidade.

### 4. Cadência mais lenta + volume diário menor + ramp-up
- Reduzir cap diário e aumentar o intervalo entre envios; iniciar cada campanha com volume menor e subir gradualmente (warm-up) para não dar pico que derruba qualidade.
- Parâmetros configuráveis (sem hardcode espalhado).

### 5. Monitoramento de qualidade do número (WABA)
- Edge function que consulta o **quality rating / messaging tier** do número via Graph API e expõe no painel; alerta quando sai de verde.

## Detalhes técnicos

```text
whatsapp-campaign-dispatch (refatorado)
  ├─ início do lote: garante header_handle (upload resumável 1x) ──► cache no batch
  ├─ monta audiência ──► filtra contra public.meta_supressao
  ├─ envia com cadência maior + cap diário menor + ramp-up
  ├─ a cada envio: grava status; webhook atualiza delivered/failed
  └─ guarda de qualidade: taxa entrega móvel < limiar → pausa batch

whatsapp-webhook (status handler)
  └─ em failed: classifica código → insere/atualiza meta_supressao

nova tabela: public.meta_supressao
  - telefone (normalizado), codigo, motivo, suprimir_ate (null = permanente)

nova edge function: meta-number-quality
  - lê quality rating / messaging limit tier do número
```

### Tabela `meta_supressao` (migração)
- `telefone` (text, normalizado), `codigo` (text), `motivo` (text), `template_name` (text), `suprimir_ate` (timestamptz null), timestamps.
- RLS: leitura admin/gestor; escrita via service_role (edge functions).

## O que NÃO será feito
- Priorização de base engajada (a base é descartada por definição).
- Mudança de conteúdo/aprovação de template (fora do escopo técnico de entrega).

## Validação
- Disparo de teste pequeno após a correção da imagem para confirmar 0 "Media upload error".
- Conferir que números suprimidos são pulados no lote seguinte.
- Acompanhar taxa de entrega móvel e a auto-pausa em ação.