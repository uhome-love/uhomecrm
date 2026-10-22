# Fila CEO: aviso "sem corretor" quando a Roleta da noite está cheia

## O que aconteceu (verificado agora, 22:05)
- Há 10 corretores ativos na Roleta da noite, todos na fila e marcados como presentes. Entre eles estão Luiza, Jéssica, Thalia, Wendel e Adriana.
- Matheus Cruz (Open Bosque) e Leonardo Sampaio (Skyglass) foram enviados pela Roleta às 21:30 e 21:23. Ninguém aceitou em 10 minutos, então os dois voltaram para a Fila CEO.
- Às 22:04 esses dois foram disparados de novo pela Fila CEO, mas com a opção **"Roleta da Tarde"** marcada. A tarde já acabou e não tem ninguém nela, por isso o sistema respondeu "sem corretor alocado ativo neste produto".
- Às 22:02 outro lead foi distribuído normalmente pela Roleta da noite, para um grupo de 8 corretores. A Roleta da noite está funcionando.

Agora, para resolver esses dois leads: abra a Fila CEO, escolha "Roleta Noturna" ou "Balancear automaticamente" e dispare de novo.

## O que muda para isso não confundir de novo
1. Na janela "Disparar novos leads para onde?", os turnos que já acabaram aparecem apagados com o aviso "encerrada" e não podem ser escolhidos. Domingo e feriado continuam com "Dia todo".
2. O turno em andamento aparece com o aviso "agora" e quantos corretores estão na fila.
3. Quando a janela abre, ela já vem marcada em "Balancear automaticamente", que usa o turno em andamento.
4. Quando um disparo falha, a mensagem diz qual turno foi usado, por exemplo: "Ninguém deste produto na Roleta da Tarde".

A distribuição, as regras da Roleta e o banco de dados não mudam.

## Validação
- No celular, com a sua conta e depois das 18h, abrir a Fila CEO e conferir que Manhã e Tarde aparecem encerradas e que Noturna aparece como "agora", com a quantidade certa de corretores.
- Não disparar nenhum lead real durante a conferência.

## Detalhes técnicos
- Só `FilaCeoDispatchModal.tsx`: usar o turno atual e o horário de fim de cada turno de `useRoleta` (JANELAS); contar a fila por janela com uma consulta só de leitura em `roleta_fila` + `roleta_credenciamentos`.
- O rótulo de falha passa a incluir a janela de `selectedDestino`.
