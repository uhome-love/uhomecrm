# Reativar disparo de reengajamento

## Diagnóstico do que aconteceu

Rodada de hoje (`flow_novidade2`, fonte descartados:reengajavel, 145 alvos):

| Métrica | Valor | % |
|---|---|---|
| Enviados (accepted pela Meta) | 144 | 100% |
| Entregues | 107 | 74% |
| Lidos | 49 | 34% |
| Responderam | 5 | 3,5% |
| SIM / NÃO | 2 / 3 | — |
| Falhas | 41 | 28% |

**Composição das 41 falhas nas últimas 24h:**
- **25× erro 131049** ("not delivered to maintain healthy ecosystem engagement") — bloqueio preventivo da Meta por qualidade
- 12× "User's number is part of an experiment" (experimento Meta, não é problema nosso)
- 3× "Message undeliverable"
- 1× opt-out ("stop receiving marketing")

**Por que pausou às 15:51:** existe uma auto-pausa preventiva que dispara quando um template acumula ≥ 20 bloqueios `131049` em 24h. Bateu 21, pausou automaticamente e gravou `paused_reason` recomendando esperar 24h (recomendação da própria Meta pra 131049).

## Avaliação (honesta)

O usuário tem razão parcialmente: **74% de entrega é aceitável** e teve engajamento real (49 leituras, 5 respostas, 2 SIM). Mas **17% de 131049 é o teto do que vale tolerar** — acima disso a Meta começa a rebaixar a *quality rating* do número (foi exatamente o que derrubou a WABA em maio). O gatilho existe pra proteger o número, não pra travar o negócio.

Meu voto técnico: **reativar hoje é aceitável porque a base já foi 90% queimada** (os 131049 restantes seriam poucos), mas com **teto de segurança mais rígido** pra não repetir o padrão de maio.

## Plano de reativação

1. **Reativar o disparo:** setar `reengajamento_config.paused = false`, limpar `paused_reason`, `paused_at_brt` e `paused_until_release`.
2. **Confirmar que o gate global (`system_flags.campaign_dispatch_enabled`) segue `true`** — já está.
3. **NÃO alterar o limiar de auto-pausa** (fica em 20/24h). Se voltar a acumular 131049 rápido, pausa de novo — é isso que queremos.
4. **NÃO reativar a onda anterior** — os 41 leads que falharam hoje ficam de fora automaticamente (marcados como `failed` na `reengajamento_meta_disparos`). Próximo disparo pega a fila normal.
5. Deixar `retry_131049_dias = 5` como está (só re-tenta o mesmo número após 5 dias).

## O que NÃO faço nesse plano

- Não reduzo o cooldown 131049.
- Não subo `daily_limit` (fica em 500).
- Não altero template — `flow_novidade2` continua sendo o que rodou.
- Não crio nova fila / nova função — só flip da flag na `reengajamento_config`.

## Detalhe técnico

Um único `UPDATE` em `reengajamento_config` (linha única, `canal=meta`):
```sql
UPDATE reengajamento_config
SET paused = false,
    paused_reason = NULL,
    paused_at_brt = NULL,
    paused_until_release = false,
    updated_at = now()
WHERE canal = 'meta';
```

O sequencer/cron de disparo lê essa flag a cada ciclo, então a retomada é automática (não precisa reiniciar nada).

## Risco assumido

Se o próximo lote voltar a acumular 131049 rápido, a auto-pausa dispara de novo — e aí a recomendação passa a ser esperar 24h de verdade, porque seria o segundo sinal em sequência (padrão que precede queda de quality rating). Combinado?