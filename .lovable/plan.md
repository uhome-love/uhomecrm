
# Disparo lakebaikal_novidade3 — destravar + rodar cauteloso

## Por que está bloqueado

Três travas ativas hoje na `reengajamento_config`:

- `paused = true`
- `paused_until_release = true` (essa é a que a UI checa antes de deixar disparar — mostra "Central travada")
- `enabled = false`
- `paused_reason` = auto-pausa preventiva do `flow_novidade2` de ontem (21 bloqueios 131049)

O gate global (`system_flags.campaign_dispatch_enabled`) já está **ligado** — não precisa mexer. É só na `reengajamento_config` que falta liberar.

Template `lakebaikal_novidade3` **não está** na `blocked_templates` — ok pra usar.

## Base disponível (pipeline_leads)

| Empreendimento | Leads |
|---|---|
| Lake Eyre | 472 |
| Lake Baikal | 49 |
| Casa Bastian (alto padrão) | 137 |
| High Garden Iguatemi (alto padrão) | 108 |
| Seen Três Figueiras (alto padrão) | 47 |
| Vivid Terrace | 24 |
| High Garden Rio Branco | 11 |
| Salzburg | 1 |

Isso é só pipeline ativo. A base "descartados reengajáveis" desses mesmos empreendimentos entra no cálculo real na hora do preview (a Central mostra o funil).

Interpretei "Golden Lake" como o Lake Baikal (o template `lakebaikal_novidade2` usa a imagem `lakebaical-golden-lake.png` — é a campanha "Golden Lake" do Baikal). Se você quis outra coisa, me corrige antes de rodar.

## Plano

### 1. Destravar a Central (SQL único)

```sql
UPDATE reengajamento_config
SET paused = false,
    paused_until_release = false,
    paused_reason = NULL,
    paused_at_brt = NULL,
    enabled = true,
    updated_at = now()
WHERE canal = 'meta';
```

Não altero limiar de auto-pausa (fica em 20 bloqueios 131049/24h), não altero `daily_limit` (500), não altero delays (4–8 min entre mensagens + pausas longas de 10–15 min a cada 3). Se voltar a acumular 131049 rápido, a auto-pausa dispara de novo — que é o comportamento certo.

### 2. Configuração do disparo (você faz na aba "Disparo manual")

- **Canal:** Meta
- **Fontes:** marcar `Descartados` **+** `Pipeline ativo` (as duas — "toda a base")
- **Tipo de descarte:** reengajável
- **Empreendimentos:** Lake Eyre, Lake Baikal, Casa Bastian, High Garden Iguatemi, High Garden Rio Branco, Seen Três Figueiras, Vivid Terrace, Salzburg
- **Recência:** Todos
- **Dedup:** cooldown 14 dias (default) — evita quem já recebeu qualquer template nas últimas 2 semanas
- **Template:** `lakebaikal_novidade3` (pt_BR) — imagem de header já mapeada automaticamente
- **Limite:** deixa o padrão (1000). O throttle real quem controla é o `daily_limit=500` da config, então mesmo pedindo 1000 na fila, o motor solta ~500/dia.

### 3. Recomendação de cautela

Duas opções — escolhe uma:

**(a) Rodada única em modo cauteloso** — marca o toggle "Modo teste" no card. Envia amostra aleatória de 5% da base (mín 50, máx 300) e **auto-pausa** se falhar mais de 15% em janela de 20 ou 20 falhas totais. Se der bom em 1–2h, você repete sem o toggle e manda pro resto.

**(b) Rodada cheia com o throttle atual** — 500/dia, delay 4–8 min entre mensagens, pausa longa 10–15 min a cada 3 mensagens. Nesse ritmo, ~500 leads/dia → base inteira em 2 dias. Se acumular 131049 rápido, pausa sozinha.

Meu voto: **(a) primeiro**. Perde meia hora, ganha sinal de qualidade do template novo (é a 3ª versão do lakebaikal, não sabemos ainda como a Meta reage). Se a amostra passar limpa (>85% entrega, <5% de 131049), destrava (b) no mesmo dia.

### 4. O que NÃO faço

- Não reabro nem reprocesso as falhas do `flow_novidade2` de ontem — base diferente, template diferente, sem relação.
- Não altero throttle nem `daily_limit`.
- Não altero `retry_131049_dias = 5` (número que deu 131049 fica de fora por 5 dias — protege qualidade).

## Risco assumido

Se o `lakebaikal_novidade3` também acumular 131049 rápido (mesmo padrão do `flow_novidade2`), a auto-pausa preventiva dispara e a Central trava de novo, com recomendação real de aguardar 24h — e aí passa a valer.

## Próximo passo

Aprova o plano que eu:
1. Rodo o UPDATE destravando a Central.
2. Te confirmo aqui e você vai na aba "Disparo manual" pra montar o público (Modo teste ligado, se seguir a opção (a)).
