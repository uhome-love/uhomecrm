
# Fase 4 — Ingestão IA dos Materiais

Transformar cada material enviado (PDF, imagem, vídeo, link) em conteúdo pesquisável com tags automáticas + busca semântica. Base para o HOMI usar materiais nas respostas depois.

## Objetivo

Quando o gestor sobe um material, a IA lê o arquivo, gera:
- **Resumo curto** (1-2 frases)
- **Tags** (ex: `["fachada", "3 dorm", "piscina"]`)
- **Chunks + embeddings** (vetor 3072) — para busca semântica

O corretor então pesquisa "planta 3 quartos com suíte" e recebe materiais relevantes de qualquer empreendimento.

## Escopo desta fase

Ingestão + busca. **Não** inclui HOMI usar materiais no WhatsApp automaticamente (fase seguinte).

## Backend

### 1. Migração

- Enable `vector` extension.
- Nova tabela `public.materiais_chunks`:
  - `material_id` (FK → `materiais_links.id`, cascade)
  - `chunk_idx` int
  - `content` text
  - `embedding` vector(3072)
  - GRANT + RLS (leitura authenticated; escrita service_role via edge fn)
  - Index HNSW `halfvec_cosine_ops`
- Adicionar em `materiais_links`:
  - `resumo_ia` text
  - `tags` text[] (default '{}')
  - `ingest_status` text (`pending` | `processing` | `done` | `error`)
  - `ingest_error` text
  - `ingested_at` timestamptz
- Função `match_materiais(query_embedding, match_count, only_ativos)` retornando `material_id, similarity, content`.

### 2. Edge function `materiais-ingest`

Input: `{ material_id }`. Passos:
1. Busca material + storage_path.
2. Marca `ingest_status='processing'`.
3. Baixa arquivo (signed URL 5min).
4. Extrai texto conforme MIME:
   - **PDF**: envia inline base64 pro Gemini com prompt "extraia texto integral + descreva imagens".
   - **image/***: Gemini vision → descrição rica (cômodos visíveis, estilo, contexto).
   - **video/***: usa apenas título/descrição (transcript fica pra fase futura).
   - **link externo**: usa título + descrição do link.
5. Gera resumo + tags via `google/gemini-3.6-flash` (tool call estruturado).
6. Chunks (500-1500 chars) → embeddings via `google/gemini-embedding-001` (batch ≤100).
7. Insert em `materiais_chunks`, atualiza `materiais_links` (resumo/tags/status=done).
8. Idempotente: deleta chunks antigos antes.

### 3. Edge function `materiais-search`

Input: `{ query, limit? }` (auth). Retorna materiais rankeados:
- Embeda query, chama `match_materiais`, agrupa por `material_id` (max similarity), traz metadata + empreendimento.
- Cache in-memory por query hash (5min) opcional.

### 4. Trigger de auto-ingest

Após insert em `materiais_links` com `storage_path` OU `url`, chama `materiais-ingest` via `pg_net` (fire-and-forget).

## Frontend

### 1. `MaterialCard.tsx`
- Badge de status ao lado do título: `⏳ Processando`, `✓ IA pronta` (só pra gestor).
- Chips de tags abaixo do título (max 3 visíveis, "+N" hover).
- Botão "Reprocessar IA" no menu (canEdit).

### 2. `MateriaisPage.tsx`
- Barra de busca no topo: "Buscar material por descrição, tag ou conteúdo…"
- Se query preenchida: substitui grid de empreendimentos por lista rankeada de materiais (score visível como % pequeno).
- Sem query: comportamento atual.

### 3. `GerarLinkDialog.tsx`
- Reusa mesma busca semântica dentro do dialog para "Sugerir materiais para este lead" (aparece se lead selecionado tiver observações/perfil).

## Diagrama

```text
Upload arquivo
     │
     ▼
materiais_links (INSERT) ──trigger──► materiais-ingest (edge)
                                          │
                                          ├─► Gemini vision/PDF → texto
                                          ├─► Gemini flash → resumo + tags
                                          └─► Gemini embedding-001 → vectors
                                                    │
                                                    ▼
                                          materiais_chunks (INSERT)
                                          materiais_links UPDATE (resumo, tags, done)

Corretor busca "planta 3 quartos" ──► materiais-search ──► ranking similaridade
```

## Detalhes técnicos

- Provider: **Lovable AI Gateway**, sem secret novo (usa `LOVABLE_API_KEY`).
- Modelos: `google/gemini-3.6-flash` (extração+tags), `google/gemini-embedding-001` (vetores 3072).
- Chunk: 1000 chars, overlap 150.
- PDFs > 50MB: pula extração de texto, usa só título/descrição pra tags (evita timeout).
- Vídeos: só metadata nesta fase.
- Erros ficam em `ingest_error` e visíveis com badge vermelho pro gestor.

## Fora de escopo

- Transcrição de vídeo (Gemini multimodal video seria caro; adiar).
- HOMI enviar materiais no WhatsApp (próxima fase).
- Re-ingest automático quando `titulo` muda (só manual).

## Ordem de implementação

1. Migração (tabela chunks + colunas + função match + trigger).
2. Edge fn `materiais-ingest`.
3. Edge fn `materiais-search`.
4. UI: tags + status no card + barra de busca.
5. Validação ao vivo: subir 1 PDF, 1 foto, verificar tags e busca semântica.

---

Confirma que posso implementar tudo assim? Ou quer ajustar algo (ex: incluir vídeo, mudar modelo, escopo menor)?
