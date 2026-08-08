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

Lê `prompt/lia-canoas-v3.1.txt` em bytes crus, calcula SHA-256 e compara com `ia_prompt_versoes`. Divergência → **bloqueio duro** (não envia) **+ alerta in-app e push para admins**, com dedup de 6h, no mesmo padrão do `capi-health-alert`. Divergência silenciosa não existe.

## Passo 3 — Debounce com teto e lock por lead

Agrupa mensagens em rajada: espera `debounce_segundos`, com corte em `debounce_teto_segundos`. Pendente = mensagem do cliente posterior ao último turno. Lock por lead via compare-and-swap em `ia_leads.updated_at`: um turno por vez; mensagem que chega durante o turno entra na próxima rodada.

## Passo 4 — Travas depois do modelo, antes do envio

Ordem fixa, todas após a resposta do modelo:
1. Kill switch global (`enviar_habilitado`) e modo sombra.
2. Lead `pausado` / `assumido_por` / `opt_out` / etapa `bloqueado`.
3. Janela de envio (08h–23h59 BRT) e janela de agenda (10h–20h).
4. Teto de mensagens por turno e teto de 3 mídias por conversa (link do Maps é texto, não conta).
5. Linhas vermelhas: nunca negar ser IA de forma enganosa, nunca pedir documento/CPF, respeitar opt-out.
6. Idempotência por `idempotency_key` em `ia_mensagens`.
7. **Travessão bloqueado na saída** (`—` e `–`).
8. **Frases proibidas**: "ainda tem interesse", "tentei contato e não obtive retorno", "você não apareceu".
9. **Arredondamento de metragem**: número maior que a área real é bloqueado; só passa área real exata ou número redondo (múltiplo de 5) abaixo dela. Pode 150, nunca 157.
10. **Mensagem repetida**: texto igual a algum já enviado para o mesmo lead.
11. **Horário escrito pelo modelo**: todo horário no texto tem de constar da lista de slots gerada pelo sistema (`ia_turnos.horarios_ofertados`).

Qualquer trava reprovada: turno gravado como `bloqueado` em `ia_turnos` com código e detalhe, e nada é enviado. As travas 7 a 11 rodam **de novo** no envio manual da sala ao vivo: edição humana não é passe livre.

## Passo 5 — Validação de `etapa_ia`

Saída do modelo validada com `isEtapaIaEmissivel` (seis valores de `etapas.ts`). Valor fora da lista → etapa ignorada, lead permanece na etapa atual, evento registrado.

## Passo 6 — Sala ao vivo (modo sombra) com enviar e editar

`/admin/lia/sala`: abas Aguardando você / Bloqueados / Enviados. Cada turno mostra texto proposto, mídias, etapa proposta, modelo e as travas com motivo.
- **Enviar como está** — o degrau da liberação: é isso que mede "80% enviadas sem edição em trinta conversas".
- **Editar antes de enviar** — o texto editado é gravado em `ia_turnos.texto_editado` **ao lado** do `texto_proposto`, com `editado = true`, e o original continua visível.
- **Descartar** — encerra o turno sem envio.

## Passo 7 — Conversão de volta ao Meta

- `LeadQualificado` no **aceite da apresentação**.
- `VisitaMarcada` na **confirmação da data**.
- Enfileira por `enqueue_meta_capi_event_lia` (irmã da função do pipeline, lendo `ia_leads` porque o lead da Lia ainda não existe no pipeline) com `meta_lead_id` gravado desde a Fase 0; sem `meta_lead_id` o evento é bloqueado e registrado. Idempotência por par `(ia_lead_id, event_name)`.


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
