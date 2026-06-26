Diagnóstico encontrado:

- A central está travada por `paused=true` e `paused_until_release=true` depois de 8 falhas Meta 131049 no template `vividterrace2`.
- Existe 1 run preso em `running` há mais de 2h (`e5f52ccb...`) com 0 envios, bloqueando a visualização/retomada.
- Nas últimas 12h o template `vividterrace2` teve 112 eventos: 92 enviados/entregues/lidos/respondidos, 20 falhas e 7 respostas. Ou seja, ele performou, mas bateu o guard de qualidade.
- O bug estrutural é que a continuação automática cria novos runs a cada ~55s e a cada continuação recalcula a audiência inteira. Em lista da Oferta Ativa, como os leads enviados não são marcados no próprio lead, a função fica dependendo só de eventos/dedup e pode gerar muitos micro-runs, até uma continuação cair no preflight de qualidade e ficar presa/travada.

Plano de correção e retomada:

1. Limpar o bloqueio operacional atual
   - Encerrar o run preso como `timeout` com motivo claro.
   - Liberar `reengajamento_config`: `paused=false`, `paused_until_release=false`, limpar `paused_reason` e atualizar `guard_reset_at` para agora.

2. Corrigir a função de disparo para não travar novamente
   - Em `reengajamento-descartados-enqueue`, antes de iniciar um novo run, auto-encerrar qualquer run `running` antigo acima de 4 minutos.
   - Quando o preflight de qualidade bloquear antes de criar/enviarem leads, registrar/encerrar o run corretamente em vez de deixar `running` sem progresso.
   - Na continuação automática, limitar/normalizar o texto de `iniciado_por` para não crescer infinitamente com `_continuacao_continuacao...`.
   - Para público `oferta_ativa_lista`, reforçar dedup por `reengajamento_meta_disparos`/eventos para o mesmo telefone e template, evitando reenviar quem já foi tentado no ciclo recente.

3. Ajustar a UX para refletir o estado real
   - Em `LiveDispatchBanner`, manter o auto-timeout visual coerente com o backend para sumir com runs mortos.
   - Em `DisparoCustomizadoCard`, ao receber resposta de pausa/qualidade da função, mostrar o motivo real e não dar falsa sensação de “disparo iniciado” quando a função recusou.

4. Retomar o disparo das últimas 12h com segurança
   - Reinvocar `reengajamento-descartados-enqueue` usando o mesmo `audience_payload` do run das 12h (`vividterrace2`, mesmas 5 listas da Oferta Ativa, limite 3000), após o reset.
   - Manter os guards ativos: supressão Meta, pipeline ativo, frequência e auto-pausa por qualidade.
   - Validar depois: 0 runs presos, config liberada, novo run criado/andando ou finalizado com motivo explícito.