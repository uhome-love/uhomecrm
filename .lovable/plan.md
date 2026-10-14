# Comunicado de novidade: módulo Tarefas

## Quando e para quem
- Aparece para **corretores** (gerentes, gestores e CEO não veem) a partir de **14/10/2026 às 09:00 (horário de São Paulo)**, na primeira vez que abrirem o CRM.
- Aparece **uma vez só** por corretor. Fecha no botão "Ver minhas tarefas" (leva para a página Tarefas) ou em "Depois". Se fechar em "Depois", não aparece de novo.
- Antes das 09:00 do dia 14 não aparece para ninguém.

## Desenho

```text
+--------------------------------------------------+
|                 [ícone de check]                  |
|         Novidade: suas Tarefas voltaram           |
|  Agora com página própria no menu, logo abaixo    |
|  de Agenda.                                       |
|                                                   |
|  [+] Crie em segundos                             |
|      Escolha o cliente, o que fazer (Ligar,       |
|      WhatsApp, Follow-up, Visita) e o horário.    |
|      Atalhos: Hoje 18h, Amanhã 10h, Em 3 dias,    |
|      Próxima semana.                              |
|                                                   |
|  [calendário] Tudo organizado num lugar só        |
|      Abas Vencidas, Hoje, Próximas, Novas e       |
|      Concluídas. Tarefa de hoje que passou do     |
|      horário fica em vermelho: "atrasada".        |
|                                                   |
|  [check] Concluir já atualiza o cliente           |
|      Diga como foi o contato (ligação, WhatsApp,  |
|      presencial) e escreva uma observação. Vai    |
|      direto para a história do cliente e você já  |
|      agenda o próximo passo na mesma janela.      |
|                                                   |
|  [sino] Aviso na hora certa                       |
|      O CRM avisa no sininho (e no celular, se     |
|      as notificações estiverem ligadas) quando    |
|      chega a hora da tarefa.                      |
|                                                   |
|  [alerta] Nenhum cliente esquecido                |
|      A página mostra quem está sem próximo passo  |
|      para você criar a tarefa com um clique.      |
|                                                   |
|  Benefício: menos cliente esfriando, história     |
|  sempre atualizada e mais visitas marcadas.       |
|                                                   |
|      [ Depois ]        [ Ver minhas tarefas ]     |
+--------------------------------------------------+
```

- Visual no padrão atual do CRM (fundo claro, destaque azul, cantos arredondados), cabe na tela do celular com rolagem.

## Depois de aprovado
1. Construir o comunicado.
2. Testar no preview com a conta de corretor (forçando a data para depois das 09:00 do dia 14 só no teste) e confirmar: aparece 1 vez, o botão leva para Tarefas, não aparece para gerente/CEO.

## Detalhes técnicos
- Componente novo `src/components/comunicados/ComunicadoTarefas.tsx`, montado no layout autenticado.
- Regra de exibição: papel corretor + `Date.now() >= 2026-10-14T09:00:00-03:00` + chave `comunicado_tarefas_2026_10_visto:<userId>` no localStorage.
- Sem mudança no banco.
