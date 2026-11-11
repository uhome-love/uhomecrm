# Homi · painel do lead mais rápido

Muda só a função do Homi no servidor (`homi-assistant`). Sem migration e sem mudar nada que é gravado no lead. O raciocínio no mínimo da sugestão da ficha continua como está.

## 1. Medir cada etapa
- Uma linha de log por chamada, com o tempo de: autenticação, conhecimento dos empreendimentos, busca de materiais inteira (embedding + consulta + links), montagem do prompt, modelo e total.
- A linha também traz a ação, se a função estava fria (primeira chamada daquela instância) e se a busca de materiais estourou o tempo.
- Rodo 5 "Gerar Mensagem" e 5 "Script de ligação" e mando uma tabela por etapa, com a primeira chamada (função fria) separada das demais.

## 2. Raciocínio
- Mensagem de WhatsApp (todas as ações de mensagem e follow-up) e quebra de objeção: raciocínio no mínimo, igual à ficha.
- Script de ligação (ligação, reativação, ligação sobre proposta): raciocínio baixo, como já está.
- Demais ações (análise completa, proposta): baixo, como já está.

## 3. Materiais sem travar a resposta
- A busca de materiais começa junto com a carga do conhecimento dos empreendimentos (em paralelo), não depois.
- Limite de 1,5 s para a busca. Se passar, o Homi responde sem materiais e registra no log "materiais: tempo esgotado".
- Tudo dentro do `homi-assistant`. O módulo de materiais usado pelo chat fica intocado.
- A sugestão da ficha continua sem buscar materiais.

## 4. Prompt
- Remover o bloco do Melnick Day.
- Os outros cinco produtos ficam até você confirmar: Las Casas / Casa Tua, Connect João Wallig, Shift, Orygem e Open Bosque.

## Teste
- Tempo total medido na tela (do clique até o texto aparecer) para Gerar Mensagem e Script de ligação, mais a tabela por etapa.
- Celular (390 px): a ficha com a sugestão, mais o tempo total da sugestão na tela.
- Celular: o aviso de 10 s, provocado só no navegador do teste (atrasando a resposta), sem mudar a função.
- Script de ligação pelo botão do painel, num lead de teste que tenha esse botão, se existir. Se não existir, faço por chamada direta e aviso.
- Nada é salvo nos leads.
- Meta: Gerar Mensagem e Script abaixo de 5 s no total, medido na tela. Se a tabela mostrar que o tempo que sobra vem do próprio modelo, eu aviso antes de mexer em mais qualquer coisa.

## Detalhes técnicos
- Arquivo: `supabase/functions/homi-assistant/index.ts`.
- Medição com `performance.now()`; uma variável no escopo do módulo marca a primeira chamada da instância (função fria).
- `Promise.all` com a carga do conhecimento e uma `Promise.race` que junta a busca de materiais e um timeout de 1.500 ms (o timeout devolve lista vazia e registra o estouro).
- `reasoning_effort`: "minimal" para a ficha, para as listas de WhatsApp/follow-up e para objeção; "low" para o restante.
