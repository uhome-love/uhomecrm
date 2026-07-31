# Absorver o "Método Uhome — Documento de Inteligência para IA" no cérebro do HOMI

O documento (1.277 linhas, 18 seções MU-00 a MU-17, blocos com ID estável `[MU-xx.x]`) passa a ser a **fonte da verdade de comportamento comercial** de todas as IAs do CRM (HOMI popup, copilot, follow-up, briefing, chat, Ana/LIA).

## O que muda na prática

1. O documento entra na base de conhecimento com **prioridade máxima**, chunkado por bloco `[MU-xx.x]` (e não em pedaços cegos de 900 caracteres), para que cada trecho recuperado se sustente sozinho — exatamente como o documento pede em MU-00.4.
2. Toda resposta do HOMI passa a seguir a **regra de precedência** do MU-00.2: dado do sistema > Método > memória da conversa > nada inventado. Sem dado, o HOMI diz que vai confirmar em vez de responder.
3. As **linhas vermelhas e LGPD** (MU-17) viram regra dura no comportamento: nada de promessa de aprovação de crédito, nada de dado sensível em exemplo, nada de responder preço/estoque de memória (camada 3 sai sempre do sistema).
4. Tom de voz, frases proibidas e formato de mensagem de WhatsApp (MU-02) passam a valer para as sugestões de mensagem que o HOMI gera para o corretor.
5. Quando o HOMI usar o Método, ele **cita o bloco** (ex.: "conforme MU-09.3 — anti no-show"), para o corretor conseguir conferir.

## Fases

### Fase 1 — Ingestão do documento
- Salvar o arquivo como documento oficial no acervo (`metodo/metodo-uhome-ia-v1.txt`).
- Chunker específico para o formato MU: quebra por `### [MU-xx.x]`, cada chunk carrega o cabeçalho da seção pai (`## MU-xx`), o ID do bloco e o título. Blocos longos (tabelas, fichas de emergência) são divididos preservando o ID.
- Indexar com `source_type: documento`, `category: metodo_uhome`, `priority: 10` (acima de materiais, academia e scripts).
- Reprocessar apenas essa fonte (reindex incremental), sem mexer nos 588 chunks já existentes.

### Fase 2 — Governança de comportamento
- Atualizar a identidade compartilhada do HOMI com: regra de precedência, as três camadas de conhecimento, tom de voz, frases proibidas, linhas vermelhas e obrigação de citar o bloco MU.
- Isso é feito no núcleo compartilhado, então vale automaticamente para todos os HOMIs (popup, copilot, briefing, follow-up, chat, sugestões).

### Fase 3 — Conflito com o acervo antigo
Hoje já existem 4 documentos de método indexados (Apresentação Completa, Playbook de Campo, Manual Diário, Casa Tua). O novo documento sobrepõe boa parte do conteúdo de método.
- Recomendação: manter **Casa Tua** (camada 2 — produto) e rebaixar os outros 3 para prioridade menor, marcados como "material de apoio — em caso de conflito, vale o Método v1.0".
- Alternativa, se preferir: remover os 3 da base. Decisão sua antes de executar esta fase.

### Fase 4 — Validação ao vivo
Bateria de perguntas de teste no HOMI, conferindo resposta e citação do bloco:
- "Lead entrou e nunca respondeu, o que faço?" → deve trazer MU-16.1 / cadência de 7 toques (MU-06).
- "Qual o preço da unidade X?" → deve recusar responder de memória e apontar para o sistema (MU-00.3).
- "Posso dizer que o crédito dele vai ser aprovado?" → deve recusar (MU-10.2 / MU-17.2).
- "Cliente disse que vai ver com a esposa e sumiu" → MU-16.5.
- "Quando inativar um lead?" → os 4 motivos de MU-13.3.

## Detalhes técnicos

- Arquivo do documento → bucket `materiais-uhome`, caminho `metodo/metodo-uhome-ia-v1.txt`; entrada em `METODO_FILES` dentro de `supabase/functions/homi-reindex/index.ts` com `priority: 10`.
- Novo chunker `chunkMetodoUhome()` em `homi-reindex`, aplicado quando o documento tem marcadores `[MU-`; fallback para o `chunkText()` atual nos demais.
- Chunks gravados em `homi_chunks` com `document_id` do registro em `homi_documents` (`source_type='documento'`, `source_id` = caminho do arquivo). O índice único `(source_type, source_id)` já existente garante idempotência.
- Embeddings pelo mesmo caminho atual (`embedTexts`, `openai/text-embedding-3-small`, 1536 dims) — sem nova chave nem novo custo de infra.
- `HOMI_IDENTITY` em `supabase/functions/_shared/homi-brain.ts` recebe o bloco de governança; `formatKnowledgeBlock()` passa a expor o ID do bloco MU no rótulo da fonte.
- Sem migration de schema. Sem mudança de RLS. Sem mudança de UI.

## Fora de escopo
- Criar módulos de produto (camada 2) para os demais empreendimentos.
- Mudar o comportamento da LIA no atendimento externo (fora deste CRM).
- Qualquer alteração no pipeline, PDN ou telas existentes.
