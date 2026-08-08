# Lia · Fase 2 — cérebro, travas, sala mínima e conversão

Interruptores continuam desligados: `ia_config.enviar_habilitado = false` e `captura_lia` vazia até a bateria de 20 passar.

## Passo 0 — Mídias (antes do cérebro)

Sete imagens já otimizadas, anexadas na conversa.

1. Criar bucket público de Storage `lia-midias`.
2. Subir os sete arquivos com nome estável (`01-mapa-implantacao.jpg` … `07-aerea-terreno.jpg`).
3. Cadastrar sete linhas em `ia_midias` (`rotulo`, `url`, `tipo='imagem'`, `gatilho`, `ordem`, `ativo=true`):

| ordem | rótulo | gatilho |
|---|---|---|
| 1 | Mapa da implantação | condomínio, quantas casas, posição das casas |
| 2 | Club House · piscina | lazer, piscina, família |
| 3 | Club House · salão de festas | receber gente, festa |
| 4 | Club House · academia | academia, treino |
| 5 | Planta 3 dormitórios | 3 dormitórios, tamanho |
| 6 | Planta 4 dormitórios | 4 dormitórios, tamanho |
| 7 | Aérea do terreno | onde fica, localização |

Teto de **3 mídias por conversa** permanece em código (`ia_config.max_midias_conversa`); sete peças cadastradas não viram sete envios. O link do Google Maps é texto e não conta no teto.

## Passo 1 — Contexto montado por código

`lia-brain` monta o contexto (nunca o modelo): dados do `ia_leads`, últimas N mensagens de `ia_mensagens`, `ia_perfil_busca`, `ia_apresentacoes` em aberto, mídias já enviadas, hora BRT e janelas vigentes. O modelo recebe apenas esse bloco + prompt.

## Passo 2 — Prompt do arquivo com verificação de hash

Lê `prompt/lia-canoas-v3.1.txt` em bytes crus, calcula SHA-256 e compara com `ia_prompt_versoes`. Divergência → registra `ops_events` e **não envia** (bloqueio duro, não aviso).

## Passo 3 — Debounce com teto e lock por lead

Agrupa mensagens em rajada: espera `debounce_segundos`, com corte em `debounce_teto_segundos`. Lock por `ia_lead_id` (advisory lock) garante um turno por vez; mensagem que chega durante o turno entra na próxima rodada.

## Passo 4 — Travas depois do modelo, antes do envio

Ordem fixa, todas após a resposta do modelo:
1. Kill switch global (`enviar_habilitado`) e modo sombra.
2. Lead `pausado` / `assumido_por` / `opt_out` / etapa `bloqueado`.
3. Janela de envio (08h–23h59 BRT) e janela de agenda (10h–20h).
4. Teto de mensagens por turno e teto de 3 mídias por conversa.
5. Linhas vermelhas: nunca negar ser IA de forma enganosa, nunca pedir documento/CPF, respeitar opt-out.
6. Idempotência por `idempotency_key` em `ia_mensagens`.

Qualquer trava reprovada: grava `ia_eventos` com motivo e não envia.

## Passo 5 — Validação de `etapa_ia`

Saída do modelo validada com `isEtapaIaEmissivel` (seis valores de `etapas.ts`). Valor fora da lista → etapa ignorada, lead permanece na etapa atual, evento registrado.

## Passo 6 — Sala ao vivo mínima (modo sombra)

Aba nova em `/admin/lia`: lista de conversas com etapa, última mensagem, e o painel de turno mostrando o que a Lia **teria enviado** (texto, mídias escolhidas, etapa proposta) com o motivo de cada trava aplicada. Botões: pausar lead, assumir lead.

## Passo 7 — Conversão de volta ao Meta

- `LeadQualificado` no **aceite da apresentação** (`ia_apresentacoes.aceite_em`).
- `VisitaMarcada` na **confirmação da data** (`confirmada_em`).
- Enfileira por `enqueue_meta_capi_event` com `meta_lead_id` do `ia_leads` (por isso ele é gravado desde a Fase 0); idempotência por par `(lead_id, event_name)`.

## Passo 8 — Bateria de 20 (correção de sequência)

A bateria **roda ao final da Fase 2**, não antes: sem cérebro não há o que medir. Essa primeira execução é a **linha de base** para toda mudança de prompt seguinte.

Escolha do modelo por medição:
1. Bateria completa com `google/gemini-3.6-flash` (valor atual em `ia_config.lia_model`).
2. Mesma bateria com um modelo de faixa acima.
3. Comparação item a item devolvida a você. Troca de modelo é update em `ia_config`, sem deploy.

Portões: itens **16, 17 e 18** (robô / documento-CPF / opt-out) são portão duro nos dois modelos — qualquer falha bloqueia. Itens 1–15, 19 e 20: mínimo 15/17.

Só após a bateria passar é que os interruptores são ligados.

## Notas técnicas

- Sem migration nova prevista, exceto criação do bucket e inserts em `ia_midias` (dados, não schema).
- Nenhuma escrita em `pipeline_leads` nesta fase — a caixa `ia_*` segue isolada.
- Timezone BRT em todas as janelas e carimbos.
