# Plano: Redesign do Hub de Materiais (Marketplace Uhome)

## Objetivo
Transformar a página `/materiais` em um marketplace funcional e visualmente organizado para corretores, onde o principal é baixar/visualizar materiais rapidamente, com categorias padronizadas e preview em popup.

## Etapa 1 — Mockup de aprovação (antes de código)
Entregar 2 mockups em HTML estático para o Lucas aprovar:

- **Mockup A — Desktop (1280px):** layout em lista, sidebar de empreendimentos, painel principal com categorias colapsáveis e ações primárias de download/preview.
- **Mockup B — Mobile (440px):** mesma lista compacta, botões principais adaptados para touch e menu de ações secundárias.

Criar em `/tmp/materiais-mockup.html` e apresentar visualmente (screenshot).

## Etapa 2 — Padronização das categorias

### 2.1 Novo catálogo único (frontend + backend)
Substituir as categorias fragmentadas (há duas listas diferentes em `CategoriaIcon.tsx` e `UploadMaterialDialog.tsx`) por um catálogo único:

| value | label |
|-------|-------|
| `apresentacao_book` | Apresentação - Book |
| `drive_construtora` | Drive Construtora |
| `tabela` | Tabela |
| `disponibilidade` | Disponibilidade |
| `imagens` | Imagens |
| `videos` | Vídeos |
| `script_atendimento` | Script de Atendimento |
| `anuncio_no_ar` | Anúncio no Ar |
| `whatsapp_responsavel` | Whatsapp do responsável |
| `outros` | Outros |

### 2.2 Backfill dos dados existentes
Migration SQL para consolidar categorias antigas no novo catálogo:
- `book` → `apresentacao_book`
- `apresentacao` → `apresentacao_book`
- `tabela_vendas` → `tabela`
- `material_atendimento` → `script_atendimento`
- `fotos` → `imagens` (quando houver)
- `videos` → `videos` (quando houver)
- `plantas` → `outros` ou manter (a definir com Lucas)

## Etapa 3 — Reorganização dos botões de ação

### 3.1 Em cada linha de material (`MaterialItem.tsx`)
- **Botão principal (default):**
  - Se `storage_path` existir e for previewable (PDF, imagem, vídeo, áudio): **Abrir/Preview** (ícone de olho ou play). Clica e abre `MaterialPreviewDialog`.
  - Se `storage_path` existir e NÃO for previewable: **Download**.
  - Se for link externo (sem `storage_path`): **Abrir link**.
- **Botão secundário (outline):** Copiar (link assinado ou URL externa).
- **Remover** o botão de Follow-up IA individual por material.

### 3.2 No header do empreendimento (`MateriaisEmpreendimentoPanel.tsx`)
- Manter **Copiar todos** (todos os links do empreendimento).
- Manter **Follow-up IA** ao lado de "Copiar todos", mas agora ele abre o diálogo com **todos os materiais do empreendimento pré-selecionados** (já implementado assim hoje).
- Remover o botão de Follow-up IA de cada linha.

### 3.3 Ações de gestão (editar/excluir)
- Manter no menu "3 pontos" (só visível para quem pode editar) ou expandir no hover.
- Manter no menu mobile.

## Etapa 4 — Preview em popup para downloads

### 4.1 Integrar `MaterialPreviewDialog`
Ao clicar no botão principal de um material com `storage_path` previewable:
- Abrir `MaterialPreviewDialog` (já existente, renderiza imagem, vídeo, PDF e áudio).
- Contabilizar ação como `preview` no analytics.

### 4.2 Ajuste no `MaterialPreviewDialog`
- Botão principal do header: **Download** (quando houver `storage_path`).
- Botão secundário: **Abrir em nova aba**.
- Manter fallback para link externo e arquivos não previewable.

## Etapa 5 — Ajustes nos formulários de cadastro

### 5.1 `UploadMaterialDialog.tsx`
- Substituir a lista de categorias atual pela lista padronizada.
- Auto-detectar categoria pelo tipo de arquivo:
  - Imagem → `imagens`
  - Vídeo → `videos`
  - PDF → `apresentacao_book` (default, usuário pode trocar)

### 5.2 `LinkFormDialog.tsx`
- Usar o mesmo catálogo padronizado de `CategoriaIcon.tsx`.

## Etapa 6 — Validação ao vivo
- Testar no preview logado (CEO/gestor e corretor).
- Verificar:
  - Categorias aparecem padronizadas.
  - Botão principal abre preview/download conforme tipo.
  - Botão Copiar funciona.
  - Follow-up IA funciona pelo header do empreendimento.
  - Mobile não corta botões.
  - Formulários de upload/link têm categorias corretas.

## Arquivos que serão alterados
- `src/components/materiais/CategoriaIcon.tsx` (catálogo único)
- `src/components/materiais/MaterialItem.tsx` (botões)
- `src/components/materiais/MateriaisEmpreendimentoPanel.tsx` (header, remove IA por linha)
- `src/components/materiais/MaterialPreviewDialog.tsx` (ajuste de botões)
- `src/components/materiais/UploadMaterialDialog.tsx` (categorias)
- `src/components/materiais/LinkFormDialog.tsx` (categorias)
- `src/components/materiais/FollowUpMaterialDialog.tsx` (sem mudanças, já atende)
- Migration SQL para backfill de categorias antigas

## Dúvidas para aprovação
1. **Mockup:** devo gerar o mockup agora e você aprova antes de codificar?
2. **Planta:** a categoria `plantas` (upload) deve virar `imagens` ou `outros`?
3. **Categoria default de PDF:** PDF sem nome específico entra como `apresentacao_book` ou `outros` por padrão?
