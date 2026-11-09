# Tela de ligação mais espaçosa — ranking em aba

## O que muda (só visual, sem mexer em regras ou números)

```text
[ Sair ] [Listas]   0/50  0/3  0/1   [ Ligar | Ranking ]   [ Pular ]
+---------------------------+----------------------------------+
| Cliente                   | Roteiro · Empreendimento  Copiar |
| Nome / telefone           | texto do roteiro                 |
| Empreendimento            |                                  |
| [ Ligar agora ]           | SE O CLIENTE DISSER...           |
| [ WhatsApp ]              | objeções                         |
| Mais detalhes v           |                                  |
| COMO FOI A LIGAÇÃO?       |                                  |
| [Não atendeu][Sem int.]   |                                  |
| [Nº errado][Aproveitar]   |                                  |
| [Visita marcada]          |                                  |
+---------------------------+----------------------------------+
```

1. Duas colunas só: cliente (esquerda) e roteiro + objeções (direita, mais larga).
2. Ranking sai da coluna fixa e vira a aba "Ranking" no topo (botão ao lado de "Ligar"). Ao abrir, mostra o ranking inteiro (Hoje/Semana) em tela cheia; voltar para "Ligar" mantém o mesmo cliente reservado.
3. "Como foi a ligação?" passa para dentro da coluna do cliente, logo abaixo de "Mais detalhes", em grade de botões grandes (atalhos 1–5 e P continuam).
4. Celular: igual a hoje (barra de resultado fixa embaixo, ranking pelo troféu), mas com o mesmo seletor Ligar | Ranking no topo.
5. Ao voltar do discador, o bloco de resultado continua piscando para lembrar de registrar.

## Teste ponta a ponta (antes de entregar)
- Tamanhos: 1346x770 (sua tela), 1280, 1440, 1920, tablet 768 e celular 390.
- Conferir que nada fica cortado, sem rolagem lateral, botões de resultado visíveis sem rolar em 1346x770.
- Usar com clientes fictícios: ligar, cada resultado, visita, pular, trocar para Ranking e voltar sem perder o cliente, atalhos de teclado, sair.
- Conferir no banco que tudo gravou certo e apagar os dados de teste ao final.

## Detalhes técnicos
- `TelaLigacao.tsx`: estado `aba: "ligar" | "ranking"`; grid `lg:grid-cols-[minmax(320px,400px)_1fr]`; remover `aside` do ranking; render `ArenaRanking` quando aba=ranking (sem desmontar `useFilaOA`, lock/heartbeat seguem).
- `ClientePainel.tsx`: aceita `children` renderizado após "Mais detalhes"; `ResultadoBarra` passa como filho no desktop com layout em grade (nova prop `layout="grade"`).
- Nenhuma mudança em banco ou funções do servidor.
