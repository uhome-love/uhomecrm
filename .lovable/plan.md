## Objetivo

Reenviar o template **`lakebaical_novidade`** (Lake Baikal, mesma imagem de header) para os **314 leads** cuja **última tentativa desse template falhou** — ou seja, as falhas da campanha Lake Baikal direcionada ao público Lake Eyre. Disparo único, agora, sem criar recurso novo.

## Como será feito (sem alterar código)

Reaproveito o motor de disparo já existente (`reengajamento-descartados-enqueue`) no modo "retomar fila pré-montada" (`run_id`), que já processa em lote, respeita o ritmo configurado e tem trava de qualidade automática.

Passos:

1. **Montar o público (314 telefones)** — selecionar, no histórico de disparos (`reengajamento_meta_disparos`), os telefones cuja **última** entrada de `lakebaical_novidade` está com status `failed` (314 telefones distintos). Nome e telefone vêm da fila do disparo anterior (todos os 314 têm correspondência).

2. **Criar a execução** — inserir 1 registro em `reengajamento_dispatch_runs` com:
   - `template_name`: `lakebaical_novidade`
   - canal `meta`, idioma `pt_BR`
   - mesma imagem de header já usada (`.../reengajamento/lakebaical-novidade.png`)
   - marcação de origem "reenvio de falhas Lake Baikal/Lake Eyre"

3. **Pré-carregar a fila** — inserir os 314 registros em `reengajamento_dispatch_queue` (status `pending`) vinculados a essa execução, com nome/telefone normalizado.

4. **Iniciar o disparo** — chamar a função com `force` (a nutrição está com `enabled=false`, então o `force` é necessário para rodar fora do fluxo automático). Ela envia em lotes, com o ritmo configurado (intervalo de ~4–8 min entre mensagens), e se autocontinua até esvaziar a fila.

## Pontos importantes que você deve saber

- **Chance real de nova falha:** dos 314, **120** falharam por *"Message undeliverable"* (número tende a falhar de novo) e **19** por *"experiment"*. Os **~175** de *"healthy ecosystem engagement"* (throttle de qualidade da Meta) têm a melhor chance de entregar agora.
- **Trava de qualidade automática:** se a taxa de falha recente subir de novo, o próprio motor **pausa sozinho** para proteger a qualidade do número — é o comportamento esperado e seguro.
- **Ritmo:** com o intervalo atual (~4–8 min/msg), 314 envios levam várias horas. Se quiser acelerar para este reenvio, posso reduzir o intervalo temporariamente — me avise.
- **Acompanhamento:** dá pra acompanhar enviados/entregues/falhas em tempo real na Central de Reengajamento; posso te reportar o resultado ao final.

## Confirmação

Ao aprovar, eu monto a fila e **inicio o disparo** dos 314 imediatamente com o ritmo atual. Se preferir ritmo acelerado, me diga antes de aprovar.