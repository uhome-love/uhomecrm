## Diagnóstico inicial

A auditoria apontou 4 causas prováveis para a instabilidade percebida:

1. **O canal do disparo ignora a escolha da tela**
   - A tela envia `audience.canal`, mas a função usa `reengajamento_config.canal`.
   - Resultado: o usuário escolhe Meta/Evolution, mas o backend pode executar outro canal.

2. **Finalização enganosa quando todos são ignorados**
   - Exemplo recente: run com `0 enviados / 24 ignorados` terminou como `completed` e mensagem “Fila concluída”, mesmo sem enviar nada.
   - Isso parece “não enviou” sem explicação clara.

3. **Falhas pós-envio da Meta não param a campanha do jeito solicitado**
   - Há muitas falhas recentes de qualidade/entrega: `healthy ecosystem engagement`, `Message undeliverable`, `Business eligibility payment issue`, `experiment`.
   - O código já tem guarda de qualidade, mas mistura falhas de webhook com envios “sent/read/delivered” e não aplica exatamente a regra pedida de **50 falhas seguidas** com pausa explicada.

4. **Erros de edge function ainda retornam 500 em alguns caminhos**
   - Em erro inesperado, a função devolve HTTP 500; no frontend isso vira “Edge Function error” genérico.
   - O correto é transformar isso em resposta estruturada, gravar o motivo no run e manter a fila recuperável.

## Plano de execução

### 1. Corrigir o contrato tela → motor
- Fazer `reengajamento-descartados-enqueue` respeitar o canal selecionado no disparo (`audience.canal`).
- Manter fallback para `reengajamento_config.canal` quando não vier canal explícito.
- Persistir no run o payload real usado para permitir retomada/retry fiel.

### 2. Endurecer a fila persistente para não “morrer” no meio
- Garantir que itens presos em `processing` voltem para `pending` com segurança.
- Quando a continuação automática falhar, deixar `motivo_parada` claro e a run retomável, em vez de parecer encerrada.
- Ajustar o status final:
  - `completed` só quando houve envio real ou finalização saudável.
  - `no_send`/`error` quando não houve nenhum envio e houve apenas ignorados/falhas, com motivo detalhado.

### 3. Implementar a regra operacional de 50 falhas seguidas
- Criar contador por run para falhas consecutivas reais.
- Ao atingir **50 falhas seguidas**, pausar a campanha automaticamente.
- Gravar no run:
  - template/canal usado;
  - quantidade de falhas seguidas;
  - motivo predominante;
  - recomendação objetiva: template pausado, problema de pagamento/elegibilidade, qualidade Meta, número/opt-out, instância Evolution desconectada etc.
- Liberar itens ainda pendentes para retomada posterior, sem perder fila.

### 4. Classificar falhas da Meta e Evolution
- Normalizar motivos em categorias:
  - `meta_quality_pacing` para `healthy ecosystem engagement` / 131049;
  - `meta_payment_eligibility` para cobrança/elegibilidade;
  - `meta_user_experiment`;
  - `meta_undeliverable`;
  - `meta_optout`;
  - `evolution_disconnected` / `evolution_unavailable`;
  - `transient_external_api`.
- Usar essa classificação no `motivo_parada`, histórico e fila de reenvio.

### 5. Melhorar respostas da edge function para o frontend
- Trocar retornos 500 genéricos por JSON estruturado sempre que possível:
  - `ok: false`, `reason`, `message`, `run_id`, `recoverable`.
- No frontend, trocar toast genérico “Edge Function error” por mensagem do backend e link visual para o histórico/run.

### 6. Corrigir a experiência da página de reengajamento
- Mostrar no banner de disparo em andamento o motivo atual (`motivo_parada`) quando existir.
- No histórico, destacar runs com:
  - “sem envio real”;
  - “pausado por 50 falhas seguidas”;
  - “pausado por qualidade Meta”;
  - “retomável”.
- Ajustar textos para diferenciar:
  - falha de envio;
  - lead ignorado por telefone inválido/supressão/frequência;
  - pausa protetiva.

### 7. Validação pós-correção
- Rodar leitura dos últimos runs e filas para confirmar que não há `processing` travado.
- Testar edge function com payload seguro/limitado para validar resposta estruturada.
- Validar que uma campanha sem elegíveis não aparece como sucesso enganoso.
- Conferir logs da função depois do teste.

## Arquivos prováveis

- `supabase/functions/reengajamento-descartados-enqueue/index.ts`
- `src/components/central-nutricao/DisparoCustomizadoCard.tsx`
- `src/components/central-nutricao/LiveDispatchBanner.tsx`
- Possivelmente componentes de histórico/runs da Central de Reengajamento, se a listagem principal estiver em outro arquivo.

## Observação importante

A base já mostra alto volume de falhas Meta recentes. Então o objetivo não é “forçar envio a qualquer custo”, porque isso piora reputação e entrega; é fazer o motor enviar quando pode, pausar quando deve, explicar exatamente o motivo e permitir retomada/reenvio controlado sem quebrar a ferramenta.