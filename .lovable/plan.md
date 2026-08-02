# HOMI: de chatbot a IA de projeto (cérebro Uhome)

## Diagnóstico — verificado agora no banco e no código

**1. A base existe, mas é rasa e estática.** Hoje o cérebro tem 695 trechos indexados:

| Fonte | Documentos | Trechos | Última indexação |
|---|---|---|---|
| Método/documentos | 6 | 383 | 31/07 20:40 |
| Imóveis | 178 | 177 | 31/07 |
| Empreendimentos | 69 | 69 | 31/07 |
| Materiais do Hub | 42 | 42 | 31/07 |
| Academia | 20 | 22 | 31/07 |
| Scripts do time | 1 | 2 | 31/07 |

Problemas concretos: só **1 script** indexado; as 20 aulas entraram apenas com título e descrição (sem o conteúdo do vídeo); os 42 materiais entraram só com título/descrição/link (o PDF nunca foi lido); nada é reindexado desde 31/07 — não existe atualização automática quando alguém cria material, aula ou ficha; e **não existe nenhum aprendizado de resultado real** (o que converte, o que não converte, objeções que funcionam).

**2. O prompt está literalmente proibindo o HOMI de pensar.** Em `homi-chat` a regra ativa é "2 a 5 linhas, máximo ~80 palavras, sem seções, sem títulos, sem listas longas". Foi o que pedimos numa rodada anterior — é a causa direta da sensação de chatbot.

**3. A busca é rasa.** Uma única consulta semântica, feita só com a última frase do usuário, 10 trechos. Se a pergunta é "e o que costuma dar certo no Casa Tua?", a busca não considera o histórico da conversa e volta genérica.

**4. Bug dos atalhos (confirmado).** Em `MessageList.tsx` o botão "Achar imóvel" tem o texto fixo `"Me busca 3 dorms até 1,5M no Menino Deus"` e o clique **envia** esse texto. Por isso ele busca no Menino Deus sozinho.

## O que vou fazer

### Fase 1 — Consertar os atalhos (rápido)
Clique no atalho passa a **preencher o campo de digitação** com um começo aberto ("Me busca imóvel: ") e posicionar o cursor, em vez de enviar. Nenhum atalho envia busca pronta.

### Fase 2 — Inteligência de resposta (o que mais muda a percepção)
- Trocar o teto rígido por **resposta adaptativa**: tarefa simples (mensagem, dado, busca) continua curta; pergunta estratégica ("por que meu Casa Tua não converte?") ganha resposta estruturada, com raciocínio e recomendação. O modelo decide pelo tipo de pergunta, não por uma regra de palavras.
- **Busca em duas etapas**: o HOMI reescreve a pergunta usando o histórico da conversa antes de buscar, faz duas buscas complementares (método/prática + produto/dados) e recebe até ~16 trechos priorizados por fonte.
- Prompt reescrito no estilo "IA de projeto": ele se apresenta como especialista do CRM Uhome, sabe o que existe em cada tela, e quando falta dado ele **pergunta** em vez de chutar (hoje ele chuta).

### Fase 3 — Enriquecer a base com o que já existe no CRM
- **Scripts**: indexar todos (`team_scripts` + `saved_scripts` + templates de comunicação), não só o único ativo.
- **Materiais do Hub em profundidade**: ler o conteúdo dos PDFs/apresentações, não só o título.
- **Academia**: indexar o conteúdo textual completo das aulas e quizzes.
- **Reindexação viva**: agendamento diário + reindexação automática quando material, aula, ficha ou imóvel é criado/editado — a base para de envelhecer.

### Fase 4 — Inteligência de resultado ("o que dá certo e o que dá errado")
Gerar automaticamente, toda madrugada, um documento de aprendizado indexado no cérebro, com números reais do CRM: conversão por origem/campanha/empreendimento, tempo de resposta x conversão, motivos de descarte mais frequentes, taxa de no-show por empreendimento, e o perfil dos leads que viraram venda. É isso que faz o HOMI responder "no The Arch o que converte é X, e o que mais mata é Y" em vez de teoria.

### Fase 5 — Seu conteúdo manual
Você vai me mandar material aqui no chat. Cada envio entra como documento oficial no cérebro, com prioridade acima dos materiais comuns, e eu valido com perguntas de teste depois de indexar.

## Detalhes técnicos

- `MessageList.tsx`: `onPrompt` dos atalhos passa a chamar um novo `onPrefill` (preenche o composer via `HomiContext`), sem `sendMessage`.
- `_shared/homi-brain.ts`: nova `searchKnowledgeMulti()` (reescrita de query + 2 buscas + dedupe + ordenação por `priority` e similaridade); `HOMI_IDENTITY` ganha o bloco de comportamento adaptativo e a regra "pergunte antes de assumir".
- `homi-chat/index.ts`: remove o bloco de teto rígido de tamanho, usa `searchKnowledgeMulti`, mantém o funcionamento das ferramentas.
- `homi-reindex/index.ts`: `collectScripts` ampliado; novos coletores de materiais (leitura de PDF) e de conteúdo de aulas; cron diário.
- Nova função `homi-aprendizado` (cron 04h BRT) que monta o documento de resultado a partir de `v_fato_venda`, `pipeline_leads` e `visitas` e o grava em `homi_documents` com `source_type='documento'`, `priority: 8`.
- Sem mudança de schema além do registro de documentos já existente. Sem mudança de RLS.

## Ordem de execução

Uma fase por vez, com validação sua no preview entre elas. Fases 1 e 2 juntas primeiro — é onde está o salto de qualidade percebida.
