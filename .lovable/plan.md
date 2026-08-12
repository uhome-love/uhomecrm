# Agenda › Prioridades — "Pendentes" + filtro de status, e sinal de concluído

## O que você viu
Ao registrar o Rodrigo, ele apareceu em **Feitos hoje** mas continuou aparecendo em **Todos**. Sim: ele deveria sair. "Todos" hoje é a fila do dia inteira, sem noção de pendente/feito, então dá a sensação de que o registro não valeu.

Observação honesta: o código já tem a auto-dispensa (registrar num card da fila tira ele por 24h), então o caso do Rodrigo pode ter vindo por outro caminho (registro feito pelo card de lembrete, pelo drawer do lead ou pelo pipeline — esses não dispensam). **Confirmar isso é o primeiro passo da execução**, antes de mexer no resto.

## Como fica

### 1. "Todos" vira "Pendentes"
O primeiro chip passa a se chamar **Pendentes** e conta só o que ainda falta atacar hoje. Quem foi registrado hoje sai dali na hora — pendente e feito deixam de se misturar.

### 2. Filtro de status ao lado
A linha de chips fica assim, sempre nesta ordem:

```text
[ Pendentes 12 ]  [ Retorno 4 ]  [ Visita 2 ]  [ Negócio 1 ]  ...  [ Feitos hoje 3 ]
```

- Os chips do meio são os motivos que já existem na fila (Negócio, Pós-visita, Novo lead, No-show, Retorno, Esfriando, Sem próximo passo) — só aparecem os que têm lead.
- Eles filtram **dentro dos pendentes**: clicar em "Retorno" mostra os pendentes de retorno, não a fila inteira.
- "Feitos hoje" fica separado à direita, com um traço divisório, porque é outra natureza de lista (comprovante do dia, não fila).

### 3. Sinal de concluído no card
Ao salvar o registro, o card não some seco: fica ~1,2s com **borda verde e "Feito ✓"** no lugar do botão Registrar, depois desliza pra fora da lista. O contador de Pendentes cai e a tela rola até o próximo card (comportamento que já existe).

### 4. Fila zerada
Quando não sobra pendente, aparece o estado "Fila zerada" com o resumo "Você registrou N leads hoje" e um atalho para o chip Feitos hoje.

### 5. Registrar por qualquer caminho conta
Registrar pelo card de lembrete ou pelo drawer do lead, estando o lead na fila de hoje, também tira ele dos Pendentes — não só o botão ⚡ do card de prioridade.

## Detalhes técnicos

Frontend apenas — nada de banco, RPC ou edge function.

- **Passo 1 (diagnóstico, antes de codar):** reproduzir o caso Rodrigo no preview com um lead de teste e confirmar por qual caminho o registro passou sem chamar `dispensarLead`.
- `src/pages/AgendaCorretor.tsx`:
  - `foco` passa a ser `"pendentes" | MotivoFila | "feitos"`; label do chip base muda para "Pendentes"; `focoDisponivel` filtra sobre a lista de pendentes.
  - `prioridades` já exclui dispensados (`useFilaDoDia` + `leadsDispensados`), então "Pendentes" é a própria lista; o que muda é o nome, a contagem por motivo e o divisor antes de "Feitos hoje".
  - `concluirDaFila` ganha um estado local `feitoId` que segura o card em modo "Feito ✓" por 1,2s (`setTimeout`) antes de `invalidar()`; `CardPrioridade` ganha a prop `feito` com a variação visual verde.
  - `onSaved` dos outros caminhos de registro (lembrete, drawer) também chama `concluirDaFila` quando o lead está na fila de hoje.
  - Estado vazio de Pendentes: novo bloco "Fila zerada".
- `src/lib/filaDispensados.ts`: sem mudança (a janela de 24h e o `restaurarLead` já atendem o "Voltar pra fila").

## Fora de escopo
- Mudar os critérios/ordem da fila ou os gatilhos de motivo.
- Mexer na aba Lembretes ou no bloco de cadência Sem Contato.
