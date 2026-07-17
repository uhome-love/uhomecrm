# Central de Reengajamento — correção e consolidação ponta a ponta

## Objetivo
Deixar `/central-nutricao` funcional e previsível do início ao fim: selecionar público, criar uma única fila, enviar continuamente no backend, reduzir o ritmo diante de sinais da Meta, pausar/parar com confirmação real e apresentar um único estado confiável na tela.

Não haverá validação intermediária limitada a 100 contatos.

## Estado confirmado
- A página dispara pelo motor `reengajamento-descartados-enqueue`; `whatsapp-campaign-dispatch` pertence a outro fluxo e não será incorporado indevidamente.
- O motor atual já possui fila persistente e continuação server-side, mas a reserva do lote não é atômica.
- A execução `ad355118...` ficou pausada com 632 itens ainda pendentes; a configuração global permanece bloqueada pelo guard antigo de 20 ocorrências do erro Meta 131049.
- A lógica de recuperação de execução antiga aparece tanto em `LiveDispatchBanner.tsx` quanto em `ReengajamentoTab.tsx`.
- O backend também faz recuperação de runs antigas e já respeita `cancel_requested` e pausa entre micro-lotes.

## Implementação

### 1. Tornar a fila concorrente e idempotente
- Criar uma função transacional no banco para reservar o próximo lote com `FOR UPDATE SKIP LOCKED`.
- A reserva mudará os itens de `pending` para `processing` e devolverá somente as linhas efetivamente adquiridas pela execução atual.
- Adicionar identidade do lock e expiração segura para recuperar apenas locks abandonados.
- Reforçar a unicidade por run + telefone normalizado + template, eliminando deduplicação apenas em memória.
- Manter tentativas e resultados persistidos, impedindo envio duplo por duas abas ou duas continuações simultâneas.

### 2. Consolidar o motor único da página
- Manter `reengajamento-descartados-enqueue` como único motor da Central de Reengajamento.
- Organizar internamente o fluxo em etapas claras: validar chamada → montar audiência → criar/retomar run → reservar lote → enviar → persistir resultado → decidir ritmo → continuar/finalizar.
- Remover caminhos legados internos que não são mais alcançados pela página, sem apagar o motor separado de outras ferramentas.
- Garantir que toda continuação carregue o mesmo `run_id`, audiência e parâmetros originais.
- Se o agendamento da continuação falhar, deixar a run recuperável e registrar o motivo, sem marcar conclusão falsa.

### 3. Trocar a auto-pausa precoce por velocidade adaptativa
- Ritmo normal balanceado: intervalo aleatório de 8 a 15 segundos.
- Ao detectar aumento de bloqueios 131049, persistir o nível de throttle e aumentar progressivamente o intervalo entre mensagens.
- Acima de 15% de bloqueios na janela recente, reduzir a velocidade em vez de interromper o disparo.
- Manter pausa de proteção somente para cenário crítico, acima de 40%, falhas consecutivas graves ou erro permanente de configuração/autorização.
- Separar falhas de destinatário, bloqueio de qualidade, erro temporário e erro permanente; cada categoria terá retry/skip/pause adequado.
- Substituir a trava global antiga de 20 ocorrências por esse estado adaptativo, com motivo e previsão visíveis.

### 4. Sincronizar Pausar, Retomar e Parar
- Centralizar os comandos em operações do backend.
- `Pausar`: grava a solicitação, o worker termina com segurança o item corrente, devolve locks restantes e confirma o estado.
- `Retomar`: limpa somente pausa operacional autorizada e reinicia a mesma fila pendente, sem reconstruir audiência.
- `Parar definitivamente`: grava `cancel_requested`, cancela os pendentes sem afetar enviados e exige confirmação no modal do produto.
- A interface só atualizará o status após confirmação do backend; nenhum estado otimista que contradiga o processamento real.

### 5. Eliminar duplicidades de UI e estados conflitantes
- Manter uma única fonte para consulta, recuperação de stale run e comandos de dispatch.
- Remover a recuperação duplicada entre `LiveDispatchBanner` e `ReengajamentoTab`; o banner ficará apenas como apresentação/controle.
- Consolidar polling/subscription e cálculo de progresso em um hook/serviço da feature.
- Exibir estados coerentes: preparando fila, enviando, ritmo reduzido, pausando, pausado, cancelando, concluído e erro recuperável.
- Mostrar contadores derivados da fila real: pendentes, processando, enviados, ignorados, falhas e total.

### 6. Limpeza segura de código morto
- Mapear referências antes de remover cada trecho, componente, handler ou função legada.
- Remover somente código sem chamadas no fluxo da Central e duplicações comprovadas.
- Preservar integrações compartilhadas, roteamento de respostas e outros disparadores que usam contratos próprios.
- Dividir os arquivos excessivamente grandes tocados nesta refatoração em módulos focados, sem alterar regras alheias ao reengajamento.

### 7. Testes e validação ponta a ponta
- Testes unitários para classificação de falhas, janela BRT, kill-switch, throttle adaptativo e decisão de retry/pause.
- Testes de integração para reserva concorrente, deduplicação entre execuções, recuperação de lock, continuação server-side e pausa/cancelamento.
- Validar na interface: criar disparo, acompanhar progresso sem manter a aba ativa, pausar, retomar e parar.
- Confirmar por banco/logs que não houve duplicidade, que a fila continua avançando e que os contadores da tela coincidem com os registros reais.
- Validar responsividade e ausência de erros de console/rede na página.

## Tratamento da fila atualmente presa
Após a correção e os testes técnicos:
- remover a trava global antiga com registro de auditoria;
- preservar os 632 itens pendentes da run existente;
- retomar essa mesma fila com o novo throttle, sem recriar audiência e sem reenviar os 63 já processados;
- acompanhar os primeiros ciclos pelos logs e pela fila real, sem impor limite artificial de 100 contatos.

## Critérios de conclusão
- O envio continua no backend mesmo com a aba fechada ou inativa.
- Duas abas/workers não enviam o mesmo item.
- Bloqueios moderados reduzem a velocidade; não encerram silenciosamente a campanha.
- Pausar, retomar e parar refletem exatamente o estado do backend.
- A tela e o banco apresentam os mesmos totais.
- Não há recuperação duplicada, handlers sem uso ou dois motores competindo dentro da Central de Reengajamento.
- A fila presa é retomada sem duplicar os destinatários já processados.