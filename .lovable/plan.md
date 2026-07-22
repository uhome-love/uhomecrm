# Plano: Hub de Materiais Uhome — Marketplace Inteligente

## Visão

Transformar a página `/materiais` de um simples catálogo de links em um **marketplace de materiais de vendas** completo: corretores encontram, salvam, compartilham e enviam conteúdo (vídeo, imagem, PDF, links) para clientes, e todo o conteúdo alimenta a inteligência do HOMI por meio de indexação semântica automática.

## Decisões de escopo (validadas)

| Pergunta | Decisão |
|----------|---------|
| Arquitetura | Unificar os sistemas fragmentados em uma tabela canônica, mantendo a ideia de "hub por empreendimento" e organização por tipo de material. |
| Compartilhamento com clientes | Gerar link de compartilhamento público/assinado por material ou coleção. |
| Favoritos | Favoritos pessoais do corretor. |
| HOMI/IA | Entra na Fase 1 (MVP): indexação automática e busca semântica desde o início. |

## Estado atual e problemas a resolver

Hoje existem **4 sistemas de materiais paralelos**:
1. `materiais_empreendimentos` + `materiais_links` — hub atual, só links, sem upload de arquivo.
2. `pipeline_materiais` — biblioteca de PDFs/arquivos usada em sequências de follow-up.
3. `anuncio_materiais` — criativos de anúncio (vídeo, imagem) com bucket próprio.
4. `homi_documents` + `homi_chunks` — base de conhecimento do HOMI, com indexação/embedding, mas desconectada do hub de materiais.

Problemas:
- Conteúdo disperso: corretor não sabe onde buscar.
- Sem upload de arquivo no hub: tudo é link externo (Drive, Canva etc.).
- Sem favoritos pessoais ou coleções rápidas.
- Sem compartilhamento fácil para cliente.
- HOMI não enxerga o material do hub como fonte de conhecimento.

## Proposta de arquitetura unificada

Criar uma tabela canônica **`materiais_assets`** que seja a "fonte única da verdade" para todo conteúdo do marketplace. As tabelas legadas continuam existindo (não serão apagadas nesta fase), mas o hub passa a ler/escrever apenas na nova tabela. Uma migração posterior pode consolidar dados quando o novo modelo estiver validado.

### Modelo de dados principal

**`materiais_assets`** (tabela canônica)
- `titulo`, `descricao`
- `tipo_conteudo`: `video`, `imagem`, `pdf`, `link_externo`
- `url`: link externo (Drive, YouTube, Canva) ou URL pública do arquivo
- `storage_path`: caminho no bucket `materiais-files` (para arquivos próprios)
- `categoria`: drive, apresentacao, tabela_vendas, disponibilidade, script_vendas, material_atendimento, outros, video, foto, book, proposta, etc.
- `empreendimento_id`: FK opcional para `materiais_empreendimentos` (ou `empreendimentos_canonicos`)
- `segmento_id`: opcional (Moradia, Investimento, Alto Padrão, MCMV)
- `tags`: array de textos
- `status`: `ativo`, `rascunho`, `arquivado`
- `tamanho_bytes`, `mime_type`, `duracao_segundos` (para vídeo)
- `criado_por`, `updated_at`, `created_at`

**`materiais_favoritos`**
- `user_id`, `asset_id`
- Permite cada corretor ter seus materiais salvos.

**`materiais_share_links`**
- `asset_id`, `slug` (hash curto), `expires_at`, `acesso_count`, `ultimo_acesso_at`, `criado_por`
- Gera link público para enviar ao cliente.

**`materiais_embeddings`** (para HOMI)
- `asset_id`, `chunk_index`, `content`, `embedding vector(3072)`, `metadata`
- Indexa texto extraído do PDF, descrição da imagem/vídeo, transcrição etc.

### Buckets de storage

- Reutilizar `materiais` (já existe) ou criar `materiais-files` para armazenar vídeo, imagem, PDF.
- Reutilizar `materiais-logos` para logos de empreendimento.
- Manter `homi-documents` como legado; o novo hub usa `materiais_assets` + `materiais_embeddings`.

## Estrutura de organização

### Tipos de material (categorias)

Manter as categorias atuais e expandir para suportar mídia:
- Drive da construtora
- Apresentação
- Tabela de vendas
- Disponibilidade
- Script de vendas
- Material de atendimento
- Vídeo
- Imagem / Foto
- Book / PDF
- Proposta / Ficha
- Outros

### Tags inteligentes

Além da categoria, cada material pode ter tags livres (ex: `casa-tua`, `investimento`, `2-quartos`, `luxo`, `lancamento`) para permitir múltiplas classificações sem duplicar arquivos.

### Favoritos pessoais

Botão "Salvar" em cada card. Uma aba "Meus salvos" no hub mostra apenas os materiais favoritos do corretor logado.

## Upload e ingestão de conteúdo

### Tipos suportados

| Tipo | Formato | O que acontece no upload |
|------|---------|--------------------------|
| Vídeo | MP4, WebM, MOV | Gera thumbnail, extrai duração, transcreve áudio (se possível) ou descreve frames. |
| Imagem | JPG, PNG, WebP, GIF | Gera thumbnail, descrição visual automática via IA. |
| PDF | PDF | Extrai texto, divide em chunks, gera resumo. |
| Link externo | YouTube, Drive, Canva, Loom | Salva URL, título, descrição manual; não faz download. |

### Pipeline de ingestão automática (edge function)

Nova edge function: `processar-material-asset`

1. Recebe `asset_id`.
2. Faz download do arquivo do storage (se aplicável).
3. Extrai texto/ocr/frames.
4. Gera título sugerido e descrição/resumo via IA (Lovable AI).
5. Gera tags automáticas (ex: `casa-tua`, `video`, `apresentacao`).
6. Divide texto em chunks.
7. Gera embeddings via Lovable AI Gateway (`google/gemini-embedding-001`).
8. Salva em `materiais_embeddings`.
9. Atualiza `materiais_assets.status` para `ativo`.

### Reuso do legado

A função `processar-documento` já existe para `homi_documents`. Avaliar se a nova função pode compartilhar helpers com ela, mas manter o pipeline separado para não quebrar a Base de Conhecimento existente.

## Interface do marketplace

### Página `/materiais` reformulada

Layout moderno, tipo "biblioteca de conteúdo":
- **Header fixo** com título, busca global e botão "Novo material" (gestor/admin).
- **Sidebar de filtros** (esquerda): por empreendimento, categoria, tipo de conteúdo, tags, "Meus salvos".
- **Grid de cards** com preview:
  - Vídeo: thumbnail com play.
  - PDF: ícone/capa + extensão.
  - Imagem: thumbnail.
  - Link: favicon + título.
- Cada card exibe: título, categoria, empreendimento, tags, número de compartilhamentos, botão de salvar, botão de compartilhar.

### Visualização de material

Modal/drawer ao clicar no card:
- Preview do conteúdo (vídeo player, visualizador de PDF, imagem, embed do link).
- Descrição, tags, metadados.
- Botões: "Salvar", "Compartilhar", "Editar" (gestor), "Excluir" (gestor).

### Compartilhamento

"Share sheet" ao clicar em compartilhar:
- Gerar link público com validade opcional (7 dias, 30 dias, sem expiração).
- Copiar link.
- Compartilhar no WhatsApp (abre WhatsApp com o link pré-montado).
- Enviar por email.
- O link leva a uma página pública de visualização do material (`/m/{slug}`).

## Integração com HOMI (Fase 1)

### Indexação automática

Todo material adicionado ao hub é indexado em `materiais_embeddings` e fica disponível para busca semântica.

### Busca semântica no hub

Campo de busca natural: "vídeo da casa tua", "tabela de preços do open bosque", "script para investidor". O frontend chama uma edge function `buscar-materiais` que combina filtro de metadata + similaridade de vetor.

### HOMI Copilot enriquecido

Adicionar uma nova ferramenta no `homi-copilot` (`homi-chat/homi-tools.ts`):
- `buscar_materiais`: recebe a pergunta do corretor e retorna os 5 materiais mais relevantes.
- Permite ao corretor pedir: "Qual material devo enviar para um cliente interessado em investimento no Casa Tua?" → HOMI sugere o PDF/book/vídeo correto.

## Fases de implementação

### Fase 1 — Fundação e modelo unificado (DB + storage)
- Criar `materiais_assets`, `materiais_favoritos`, `materiais_share_links`, `materiais_embeddings`.
- Criar bucket `materiais-files` (ou reutilizar `materiais`) com RLS apropriado.
- Migrar dados existentes de `materiais_links` para `materiais_assets` como tipo `link_externo`.
- Adicionar RLS, GRANTs e índices.
- Criar types no frontend.

### Fase 2 — Upload e processamento automático
- Edge function `processar-material-asset`.
- Upload de vídeo, imagem, PDF no frontend.
- Geração de thumbnail e extração de texto.
- Indexação com embeddings.
- Tela de "Novo material" com drag-and-drop e seleção de categoria/empreendimento.

### Fase 3 — Interface do marketplace
- Redesenho da página `/materiais` com filtros laterais, grid, previews.
- Favoritos pessoais ("Meus salvos").
- Drawer/modal de visualização.
- Busca textual + semântica.

### Fase 4 — Compartilhamento e analytics
- Gerar link de compartilhamento com slug e expiração.
- Página pública de visualização `/m/{slug}`.
- Contador de acessos.
- Integração com WhatsApp (abre link) e email.

### Fase 5 — Integração HOMI e RAG
- Adicionar ferramenta de busca de materiais no `homi-copilot`.
- Sugerir materiais no contexto do lead.
- Registrar no histórico do lead quando um material for compartilhado.

## Requisitos de segurança e governança

- Apenas admin/gestor pode criar/editar/excluir materiais oficiais.
- Corretores podem ver, favoritar e compartilhar.
- Links públicos podem ser revogados e têm expiração opcional.
- Favoritos são pessoais (`auth.uid()`).
- Embeddings são gerados server-side; nunca expõe `LOVABLE_API_KEY` no cliente.

## Validação ponta a ponta (antes de declarar pronto)

1. Uploadar vídeo, imagem, PDF e link.
2. Verificar preview de cada tipo.
3. Buscar por palavra-chave e por frase natural.
4. Favoritar material e abrir aba "Meus salvos".
5. Gerar link de compartilhamento, abrir em aba anônima e confirmar visualização.
6. Perguntar ao HOMI: "me sugere material para investidor no Casa Tua" e verificar se resposta usa o conteúdo indexado.
7. Testar permissões: corretor não edita material, gestor edita.

## Mockup e próximos passos

Seguindo o padrão do projeto, antes de entrar em build mode serão feitos:
1. Mockup visual em HTML/print da nova página `/materiais` (grid, filtros, drawer, share sheet) para aprovação.
2. Validação deste plano com o Lucas.
3. Após aprovação do plano e mockup, executar por fases, validando cada uma ao vivo no preview.

## Notas técnicas importantes

- Respeitar limite de 2 migrações/dia em horário comercial (08–19h BRT).
- Todos os arquivos novos seguem Clean Architecture: componentes >300 linhas devem ser refatorados.
- Usar `@/integrations/supabase/client` para todas as chamadas Supabase.
- Para embeddings, usar Lovable AI Gateway via edge function (modelo `google/gemini-embedding-001`, 3072 dims, pgvector halfvec).
- Não reintroduzir wrappers de fetch ou circuit breakers; seguir runtime direto v5.