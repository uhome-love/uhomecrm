# Ajustes do comunicado, aviso no celular e Tarefas na Minha rotina

## 1. Comunicado mais curto e dizendo que não é obrigatório
- Logo abaixo do título entra a frase: "Não é obrigatório. É uma ferramenta para te ajudar a não esquecer nenhum cliente."
- Os 5 blocos viram 4 quadros pequenos, lado a lado (2x2), cada um com ícone, título e uma linha curta:
  - **Crie em segundos**: cliente, o que fazer e horário, com atalhos.
  - **Tudo organizado**: Vencidas, Hoje, Próximas e Sem próximo passo.
  - **Concluir atualiza o cliente**: a observação vai direto para a história.
  - **Aviso no celular**: na hora da tarefa chega push e aviso no sininho.
- Mantém o "Benefício", os botões "Depois" e "Ver minhas tarefas" e a mesma regra (só corretores, a partir de 14/10 09h, aparece 1 vez).
- No celular, os quadros ficam um embaixo do outro.

## 2. Aviso no celular (push) na hora da tarefa
- Esse aviso já existe: na hora da tarefa o corretor recebe o push no celular e o aviso no sininho, com conferência a cada 15 min, das 7h às 23h.
- O que muda: hoje, se o push falhar, ninguém fica sabendo. Passa a ficar registrado quantos push foram entregues e quantos falharam, para eu conferir amanhã com dados reais.
- Se o corretor não ativou as notificações no celular, o push não chega (só o sininho). No comunicado entra a dica: "Ative as notificações do CRM no celular para receber os avisos."

## 3. Tarefas na Minha rotina do corretor (sugestão)
Um quadro "Minhas tarefas de hoje" na Minha rotina, perto do topo:
- Mostra os números: **Vencidas** (vermelho), **Hoje**, **Sem próximo passo** (laranja).
- Lista as próximas 3 tarefas de hoje, com horário e nome do cliente, e um botão "Concluir" que abre a mesma janela de sempre (contato + observação).
- Botão "Ver todas" leva para a página Tarefas.
- Se não tiver nada para hoje: "Nenhuma tarefa para hoje. Que tal criar o próximo passo de um cliente?" com o botão "+ Nova tarefa".

## Como vou validar
- Foto do comunicado novo (computador e celular) para você aprovar antes de publicar.
- Com o acesso de corretor e um cliente de teste: o quadro na Minha rotina, concluir por ele e conferir se o aviso da tarefa foi registrado como push enviado. No fim apago tudo.

## Detalhes técnicos
- `ComunicadoTarefas.tsx`: grade `grid-cols-1 sm:grid-cols-2` com 4 cards, só com os tokens de cor do projeto.
- `tarefa-aviso-horario`: ler a resposta do `send-push` e gravar o resultado em `ops_events` (ok/falha por tarefa); redeploy. Nada muda no banco.
- Novo `MinhasTarefasHojeCard.tsx` reaproveitando `useMinhasTarefas`/`useSemProximoPasso` e o `RegistrarAtividadeModal` em modo conclusão; montado na página `/corretor`.
