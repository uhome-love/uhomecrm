# HOMI mais inteligente — cérebro único + base de conhecimento real

## Diagnóstico (verificado agora no projeto)

O HOMI não é "burro" por causa do modelo — ele está **sem conhecimento** e **fragmentado**:

1. **A base de conhecimento está praticamente vazia.** Existem 3 documentos em `homi_documents`: só 1 processado (Método Uhome v1.1, 31 trechos), 1 com erro ("Manual Uhome") e 1 travado em "processando" desde 25/07. Ou seja, o HOMI do pop-up responde quase sempre sem fonte.
2. **São 4 HOMIs diferentes, cada um com prompt próprio**: `homi-chat` (pop-up do corretor), `homi-ceo`, `homi-gerencial` e `homi-assistant`. Regras e personalidade divergem entre eles e só o `homi-chat` faz busca em base.
3. **Dois "idiomas" de embedding.** O pop-up indexa/busca com OpenAI (`text-embedding-3-small`, chave externa `OPENAI_API_KEY`); os materiais usam o gateway da Lovable (`gemini-embedding-001`). Bases incompatíveis e dependência de chave externa que pode falhar em silêncio.
4. **Conteúdo rico fora da base:** 42 materiais/links, 20 aulas da Academia, scripts do time e fichas de empreendimento não alimentam o cérebro do HOMI (só materiais entram, e parcialmente).
5. **Modelo antigo:** quase tudo em `gemini-2.5-flash`. Há geração melhor disponível sem custo extra de integração.

## O que proponho

Um **cérebro único do HOMI** (mesma identidade, mesmas fontes, mesmas regras) alimentado por tudo que a Uhome já produz, com cada HOMI mudando só o "chapéu" (corretor, gestor, CEO).

### Fase 1 — Unificar o motor de conhecimento (base)
- Criar um núcleo compartilhado `_shared/homi-brain.ts`: identidade HOMI, método Uhome, regras de resposta (citar fonte, admitir quando não sabe, nunca inventar preço/condição) e a busca semântica.
- Padronizar **um único motor de embeddings** via Lovable AI (`gemini-embedding-001`), eliminando a dependência de chave OpenAI. Nova coluna/índice de vetor compatível e reindexação de tudo.
- Corrigir os 2 documentos quebrados e reprocessar o Método Uhome.

### Fase 2 — Alimentar o cérebro com TODO o acervo Uhome
Indexar num só lugar, com rótulo de origem para citar na resposta:
- Método Uhome, manuais e processos (`homi_documents`)
- Materiais, apresentações e drives do Hub (`materiais_links`, `materiais_empreendimentos`)
- Aulas da Academia (título, descrição e, quando houver, transcrição do vídeo)
- Scripts do time e templates de comunicação
- Empreendimentos canônicos + fichas + overrides (preço, tipologia, entrega, diferenciais, aliases)
- Imóveis do CRM (`properties`): bairro, tipologia, faixa de preço, status — para o HOMI recomendar imóvel de verdade

Reindexação automática quando material, aula, ficha, imóvel ou documento é criado/editado.

### Fase 2.5 — Conhecimento vivo do CRM (dados, não só texto)
Texto indexado responde "como fazer"; para responder "quanto/quem/quando" o HOMI precisa consultar o banco na hora. Dou a ele um conjunto de ferramentas de leitura, sempre respeitando o papel de quem pergunta:
- Buscar imóveis/empreendimentos por bairro, preço, tipologia e disponibilidade
- Consultar o próprio funil do corretor (leads, etapa, tarefas atrasadas, visitas, SLA)
- Consultar métricas oficiais (VGV, visitas, conversão) já pela fonte única `rpc_metricas` / `v_fato_venda`
- Consultar o lead aberto na tela (histórico, respostas do formulário, empreendimento de interesse)
- Sugerir o material/aula certa para a situação

Regra de segurança: corretor só enxerga o que é dele; gestor, a equipe; diretor/CEO, tudo — reaproveitando as regras de acesso já existentes.


### Fase 3 — Elevar a inteligência das respostas
- Modelo padrão dos HOMIs conversacionais para a geração atual (`google/gemini-3.6-flash`); análises pesadas do CEO/Gestor em modelo de raciocínio mais forte.
- Resposta sempre com **fontes citadas** ("Método Uhome, etapa Qualificação" / "Academia — aula X" / link do material), e botão para abrir o material.
- Memória: o HOMI passa a considerar o histórico do corretor (`homi_conversations`) e o contexto da tela/lead aberto.
- Comportamento anti-alucinação: quando não houver fonte, responde o que sabe e sugere o material/pessoa certa em vez de inventar.

### Fase 4 — Painel de Conhecimento (gestão)
Na página Base de Conhecimento: o que está indexado, status de processamento, o que falhou, botão de reindexar, e as perguntas que o HOMI não soube responder (para virar conteúdo novo).

## Detalhes técnicos

- Novo `supabase/functions/_shared/homi-brain.ts` (prompt-base + `searchKnowledge` unificado); `homi-chat`, `homi-ceo`, `homi-gerencial` e `homi-assistant` passam a importar dele, mantendo apenas o bloco de papel/ferramentas específico.
- Migration: coluna de vetor 3072 dims em `homi_chunks` (+ índice HNSW em `halfvec`), tabela/colunas de origem (`source_type`, `source_id`, `source_url`) e RPC `buscar_conhecimento` reescrita para o novo espaço vetorial, mantendo a assinatura atual enquanto durar a transição.
- Nova função `homi-reindex` (admin/gestor) para ingestão em lote das 5 fontes; ingestão incremental por trigger/edge nos pontos de criação de material e aula.
- Remoção do caminho OpenAI em `homi-chat` e `processar-documento` após a reindexação (a chave só sai depois de validado).
- Sem mudança de layout do pop-up nesta etapa, além do bloco de fontes citadas.

## Ordem de execução

Uma fase por vez, com validação sua no preview entre elas. Começo pela Fase 1 + correção dos documentos quebrados, que é onde está o maior ganho imediato de qualidade.
