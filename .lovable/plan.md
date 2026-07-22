# Plano: Hub de Materiais Completo + HOMI Inteligente

## Entendimento atual

O Hub de Materiais já tem base sólida:
- Cards por empreendimento com upload nativo (foto, vídeo, PDF, link externo).
- Ingestão IA automática: gera resumo, tags e embeddings semânticos.
- Busca semântica na página `/materiais`.
- `homi-assistant` (no drawer do lead) já consulta `materiais_links` e sugere materiais.
- Analytics de shares gerados por corretores.
- Signed URLs para leitura segura de arquivos.

O dono do produto decidiu **não prosseguir com link comercial agora** — focar no hub interno, acesso fácil do corretor e no HOMI cada vez mais inteligente sobre os materiais.

## Objetivo

Transformar o Hub de Materiais em uma ferramenta completa para o corretor:
1. Acessar e consumir materiais rapidamente (baixar, copiar, enviar).
2. Visualizar previews (imagem, vídeo, PDF) sem sair do CRM.
3. Ter o HOMI usando esses materiais em todos os pontos de contato (lead, chat, follow-up).
4. Permitir que corretor salve favoritos e veja histórico recente.

## Fases

### Fase 1 — Ações rápidas por material (corretor)
Adicionar no `MaterialCard` ações diretas para cada link:
- **Abrir** (já existe).
- **Baixar** arquivo para enviar no WhatsApp manualmente.
- **Copiar link** do material (URL assinada temporária).
- **Compartilhar no WhatsApp** (um único material, não landing page).

Tecnica: estender `materiais-signed-read` para aceitar `download=true` (Content-Disposition) e usar o mime_type do arquivo para nome do download.

### Fase 2 — Preview visual de materiais
Criar um visualizador leve `MaterialPreviewDialog`:
- Imagem: exibe com zoom.
- Vídeo: player nativo.
- PDF: iframe com signed URL.
- Link externo: abre em nova aba.

No card, mostrar thumbnail gerada automaticamente quando disponível (pós ingestão) ou ícone por categoria.

### Fase 3 — HOMI em todos os assistants
Hoje só `homi-assistant` usa `_shared/materiais-context.ts`. Estender para:
- `homi-chat` (chat livre do corretor): injetar bloco de materiais relevantes no system prompt e permitir sugerir material.
- `homi-copilot` (modo copiloto com ferramentas): adicionar ferramenta `sugerir_material` que busca materiais por contexto e retorna cartão na UI.
- `homi-follow-up-message` (mensagens de follow-up): quando `lead_id` for informado, buscar materiais semânticos do empreendimento e mencionar o material certo na mensagem (sem depender de seleção manual).

### Fase 4 — Favoritos e Recentes do corretor
Criar tabela `materiais_favoritos` (corretor_id, material_id, created_at) e `materiais_recentes` (view log leve).

No Hub:
- Aba "Favoritos" com materiais salvos.
- Aba "Recentes" com últimos materiais abertos.
- Ícone de estrela no card para salvar/remover favorito.

### Fase 5 — Integração no contexto do lead
No drawer do lead e no painel de WhatsApp, adicionar atalho "Materiais do empreendimento" que abre mini buscador semântico. Quando o corretor clicar, lista os 5 materiais mais relevantes do empreendimento do lead com ações de envio rápido.

## O que não está no plano (adiado)
- Landing page pública no site uhome.com.br.
- Link comercial compartilhável com cliente.
- Analytics de shares (já existe, mantido como está).

## Critério de pronto
- Corretor consegue abrir, baixar e enviar qualquer material em ≤ 2 cliques.
- HOMI cita/sugere materiais reais em pelo menos 3 assistants.
- Preview funciona para imagem, vídeo e PDF sem erro de MIME.
- Favoritos persistem por corretor e aparecem em aba separada.

## Riscos / Decisões pendentes
- `homi-chat` usa RAG da base antiga (`buscar_conhecimento` + OpenAI). Pode ser mantido como fallback ou substituído gradualmente pela busca semântica de materiais.
- Thumbnails: devemos gerar thumb no upload ou apenas depender de ícone por categoria? Sugestão: começar com ícone + preview, thumb como melhoria futura.

## Próxima fase a executar
Fase 1 — Ações rápidas por material (corretor).