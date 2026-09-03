# HOMI e os materiais: diagnóstico e correção

## O que eu verifiquei (produção, só leitura)

O HOMI **não está quebrado** — ele está respondendo, autenticando e buscando normalmente:

- O chat do corretor (`/homi`, botão do HOMI no topo das telas) sempre cai na função `homi-chat`, modelo Gemini 3.6 Flash, sem trava de cargo: corretor tem acesso pleno.
- Não há erro no gateway de IA: todas as chamadas de hoje (03/09) voltaram 200. Sem 429, sem 402, sem estouro de crédito (200,3 créditos restantes).
- Não há limite de mensagens/tokens implementado no CRM.

**O problema é de CONTEÚDO, não de tecnologia.** São três buracos:

1. **A base de conhecimento do HOMI está congelada em 31/07/2026.**
   O índice que o chat consulta (695 trechos: método, academia, scripts, empreendimentos, imóveis e materiais) foi gerado uma única vez em 31 de julho e **nunca mais foi atualizado**. Não existe nenhuma rotina automática de reindexação. Tudo que entrou no Hub de Materiais de agosto para cá o HOMI simplesmente não conhece.

2. **19 dos 45 materiais do Hub não têm nenhum conteúdo lido.**
   São os links externos: Drive da construtora, links do site Uhome, "Fotos Decorados", "Vídeo Terrace Pronto", "Dispo e Tabela" do The Arch, "Drive Casa Tua Canoas", etc. Eles aparecem no Hub para o corretor baixar, mas para o HOMI são uma caixa preta — sem resumo e sem texto indexado. Se o corretor pergunta "qual a tabela do The Arch?", o HOMI não tem o que responder.

3. **Os 26 materiais que têm conteúdo têm muito pouco.**
   A maioria tem 1 ou 2 trechos indexados (basicamente só um resumo curto). Só o book do Casa Tua Canoas (8 trechos) e a tabela do Flow (4) têm profundidade real. Como a regra do HOMI é "só fale de material que está na lista, nunca invente preço/condição", ele prefere dizer que não sabe.

## O que fazer (em fases, uma por vez)

### Fase 1 — Reindexar agora e manter atualizado
- Rodar a reindexação completa da base do HOMI, para trazer tudo que entrou desde 31/07.
- Criar uma rotina automática (diária, de madrugada) que reindexa o que mudou. Assim o HOMI nunca mais fica meses atrasado.
- Colocar um selo de "última atualização da base" visível para você, para nunca mais isso passar despercebido.

### Fase 2 — Fechar o buraco dos 19 materiais sem conteúdo
Para cada material que é só um link externo, garantir uma descrição mínima que o HOMI possa usar (o que é, de qual empreendimento, o que contém, quando serve). Duas opções, a decidir com você:
- campo obrigatório de descrição na hora de cadastrar o material; ou
- descrição gerada pela IA a partir do título/categoria/empreendimento, com você revisando.

### Fase 3 — Dar profundidade aos materiais que já existem
Extrair o texto real dos PDFs/apresentações (books, tabelas, apresentações) em vez de guardar só um resumo de uma linha. É o que faz o HOMI responder "no 3 dormitórios de 87 m² a planta tem tal coisa" em vez de "consulte o material".

### Fase 4 — Não deixar o corretor no vácuo
Quando o HOMI não achar conteúdo indexado sobre o material perguntado, em vez de responder um "não tenho essa informação" seco, entregar o link do material no Hub e dizer o que ele contém.

## Detalhes técnicos

- Chat do corretor: `HomiContext.tsx` → `homi-chat` (Gemini 3.6 Flash). Auth via `requireRealUser`, sem gate de cargo.
- Índice do chat: tabelas `homi_documents` / `homi_chunks` (RPC `buscar_conhecimento`, threshold 0.35, embeddings `openai/text-embedding-3-small` 1536d). Última atualização: 31/07/2026. 695 chunks.
- Índice paralelo de materiais: `materiais_chunks` (RPC `match_materiais`, embeddings `google/gemini-embedding-001` 3072d) — este sim recebeu conteúdo hoje, mas cobre só 26 de 45 materiais e é usado como reforço, não como fonte principal.
- Nenhum cron de reindexação existe hoje (`cron.job` só tem limpeza e alertas). A função `homi-reindex` existe mas roda apenas sob demanda.
- Fase 1 provavelmente não exige migration; Fases 2 e 3 exigem (coluna de descrição / pipeline de extração), respeitando o limite de 2 migrations/dia em horário comercial.

## Ordem sugerida

Fase 1 primeiro (resolve o atraso de mais de um mês e já melhora hoje), validar ao vivo no preview com perguntas reais de corretor, e só então decidir a Fase 2.
