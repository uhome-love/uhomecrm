
# Plano: auditoria completa de reengajamento da Campanha Átrio

## Contexto

Quando um lead em **Descarte/arquivado** responde "Sim" (ou texto livre) ao disparo Átrio, a função `campanha-atrio-processar-resposta` reativa o lead e o envia à roleta. Hoje ela faz isso de forma "silenciosa":

- `liberarVinculoSeDescarte()` limpa `corretor_id`, `arquivado`, `aceite_status` — **mas não limpa `motivo_descarte` nem `tipo_descarte`**.
- A distribuição via roleta move o `stage_id` de Descarte → Novo Lead — **sem inserir linha em `pipeline_historico`**.
- A `pipeline_atividades` é inserida (existe), mas não há rastro visível na timeline de histórico de estágio do lead.

Resultado: o lead reaparece no pipeline do corretor sem nenhuma explicação no histórico (caso Andréa).

## Mudanças no edge function `campanha-atrio-processar-resposta`

### 1. Expandir `liberarVinculoSeDescarte()`
Quando o lead estiver em Descarte ou arquivado, antes da distribuição:

- Capturar `stage_id` e `corretor_id` atuais (para o histórico).
- Atualizar `pipeline_leads` com:
  - `corretor_id = null`
  - `aceite_status = 'pendente'`
  - `arquivado = false`
  - `motivo_descarte = null`
  - `tipo_descarte = null`
  - `data_descarte = null` (se existir a coluna — verificar)
- Inserir entrada em `pipeline_historico`:
  - `pipeline_lead_id`, `stage_anterior_id` = stage atual (Descarte), `stage_novo_id` = Descarte (mesmo — apenas marca a saída), `corretor_id_anterior`, `tipo = 'reativacao_campanha'`, `observacao = 'Lead reativado por resposta na Campanha Átrio (onda X): "<conteudo>"'`.
- Retornar booleano `foiReativado` para o caller saber se precisa gravar histórico extra de mudança de stage.

### 2. Gravar histórico da mudança de stage pós-roleta
Após `distributeLeadDirect` retornar sucesso:

- Buscar `stage_id` novo do lead (a roleta já moveu).
- Se `foiReativado === true` e `stage_id` mudou em relação ao capturado em (1), inserir nova linha em `pipeline_historico`:
  - `stage_anterior_id` = Descarte, `stage_novo_id` = stage novo (Novo Lead / Sem Contato), `corretor_id_novo` = `dist.corretor_id`, `tipo = 'distribuicao_roleta'`, `observacao = 'Distribuído via roleta após resposta SIM na Campanha Átrio'`.

### 3. Garantir `pipeline_atividades` mesmo em falha de roleta
Hoje a atividade é gravada com a descrição apropriada para sucesso/falha — manter. Adicionar campo `metadata` (jsonb) com:
```json
{ "wamid": "...", "resposta": "Sim, pode enviar", "onda": 3, "corretor_id": "..." }
```
para auditoria futura.

### 4. Aplicar a mesma lógica ao branch "texto_livre"
O bloco de texto livre (linhas 297–347) tem o mesmo problema. Replicar exatamente o tratamento de histórico + limpeza de campos.

### 5. Branch "nao" — também precisa de histórico?
Não move stage nem distribui. Só atualiza `reengajamento_status` e grava atividade. **Sem mudança aqui** (não há transição a registrar).

## Verificações antes de implementar

- Confirmar colunas em `pipeline_historico` (nomes exatos: `stage_anterior_id`/`stage_novo_id` vs `stage_anterior`/`stage_novo`, existe `corretor_id_anterior`/`corretor_id_novo`?).
- Confirmar se `pipeline_leads` tem `data_descarte`.
- Confirmar se `pipeline_atividades` tem coluna `metadata` jsonb (se não, omitir).
- Reler `distributeLeadDirect` para entender se ela já grava `pipeline_historico` (se sim, evitar duplicação).

## Backfill manual

Após deploy, gravar manualmente em `pipeline_historico` + `pipeline_atividades` o evento da **Andréa (`cf4e6822-fa0b-4e8b-a990-dc4d31f4aff7`)**:
- Histórico: Descarte → Novo Lead em 21/05 22:55, tipo `reativacao_campanha`, observação citando a resposta "Sim, pode enviar" + pergunta sobre metragem.
- Atividade: "Resposta SIM — Disparo Átrio (Onda 3)" com timestamp correto e corretor William Brizola.

## Fora de escopo

- Não tocar em `distributeLeadDirect` nem em outras campanhas (cron de nutrição, etc.). Foco exclusivo em `campanha-atrio-processar-resposta`.
- Não mudar a regra de idempotência de 4h (`suppressRedistribuicao`).
