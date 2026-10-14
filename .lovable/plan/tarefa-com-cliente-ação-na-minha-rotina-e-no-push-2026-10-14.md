# Tarefa com cliente + ação (na Minha rotina e no push)

## Como está hoje
- **Faixa da Minha rotina:** mostra só o título salvo, que quase sempre é "Próximo contato". Não diz quem é o cliente nem o que fazer.
- **Push no celular:** título "⏰ Tarefa agora: Arthur Lake" e texto "Próximo contato · 09:00". Aparece o nome, mas a ação fica vaga.

## Como fica

### Faixa da Minha rotina
```text
09:00  Arthur Lake · Ligar                 Concluir
```
- Primeiro o nome do cliente, depois a ação.
- Se a tarefa não tiver cliente (anotação pessoal), aparece o texto da anotação.

### Push no celular
```text
⏰ 09:00 · Arthur Lake
Ligar para o cliente — Open Bosque
"retornar sobre a simulação"   (só se o corretor escreveu detalhe)
```
- Título: horário + nome do cliente.
- Texto: a ação clara, o produto do cliente (quando tiver) e o detalhe que o corretor escreveu ao criar a tarefa (quando tiver).
- O aviso do sininho fica com o mesmo texto.

### Ações (pelo tipo da tarefa)
- ligação → "Ligar para o cliente"
- whatsapp → "Mandar WhatsApp"
- follow_up → "Fazer follow-up"
- tarefa comum (a maioria hoje) → usa o que está escrito no título, sem "Próximo contato:" e sem repetir o nome; se sobrar só "Próximo contato", vira "Fazer contato com o cliente"

## Como vou validar
- Com um cliente de teste na conta da Rafaela Campos: foto da faixa e rodar o aviso da tarefa para conferir o texto que chega no sininho (o push usa o mesmo texto). Depois apago tudo.

## Detalhes técnicos
- Novo helper `src/lib/tarefaAcao.ts` (`acaoDaTarefa(tipo, titulo, nomeLead)`) usado em `MinhasTarefasHojeCard.tsx` (e disponível para `TarefaRow`).
- Mesma lógica copiada em `supabase/functions/tarefa-aviso-horario/index.ts` (edge não importa de `src/`); o select passa a trazer `descricao` e `lead.empreendimento`; redeploy. Nada muda no banco.
