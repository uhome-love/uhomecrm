
# Fase — Upload nativo de materiais

Hoje o hub só aceita **link** (Drive, YouTube etc). Vamos passar a aceitar
**upload direto** de foto, vídeo, planta e PDF, ficando dentro da nossa infra
— sem depender de Drive público, com thumbnails, tamanho controlado e
compartilhamento estável nos shares comerciais.

## Escopo

Só a página **/materiais** e os componentes do modal de material. Fluxo do
share comercial (`materiais_shares` + landing no site) continua igual — ele
passa a receber URLs do nosso storage no lugar de URLs do Drive, sem mudança
de contrato.

## Mockup do fluxo

```text
Modal "Novo material" (dentro do empreendimento)
┌────────────────────────────────────────────────────────┐
│ Tipo de conteúdo                                       │
│  ( ) Link externo   (•) Upload de arquivo              │
│                                                        │
│  ┌────────────────────────────────────────────────┐    │
│  │  ⬆  Arraste um arquivo ou clique pra escolher   │    │
│  │  Foto, vídeo, PDF ou planta · até 200 MB       │    │
│  └────────────────────────────────────────────────┘    │
│                                                        │
│  ▸ hero-casa-tua.mp4  · vídeo · 42 MB   ▓▓▓▓░ 78%     │
│                                                        │
│ Título:    [ Vídeo aéreo Casa Tua                    ] │
│ Categoria: [ Vídeos ▾ ]  (detectada pelo tipo)         │
│ Descrição: [ opcional                                ] │
│                                                        │
│                       [ Cancelar ]  [ Salvar material ]│
└────────────────────────────────────────────────────────┘
```

Regras do uploader:
- Toggle **Link externo / Upload** no topo (mantém o fluxo antigo intacto).
- Aceita: `image/*`, `video/*`, `application/pdf`.
- Limite **200 MB** por arquivo (soft-cap; barramos no cliente antes de subir).
- Thumb: gerada no cliente pra imagem (canvas) e vídeo (frame em `00:01`).
  PDF fica com ícone padrão da categoria.
- Progresso real usando `xhr.upload.onprogress`.
- Categoria autodetectada por MIME, editável (Fotos / Vídeos / Plantas /
  Apresentações / Outros).

Após salvar, o card do material aparece como hoje — só que o "abrir" usa uma
**signed URL** gerada na hora (10 min de validade), tanto no CRM quanto na
landing pública.

## Plano de execução

**1. Storage (backend)**
- Bucket **privado** `materiais-uhome` via `storage_create_bucket`.
- Policies em `storage.objects`:
  - INSERT/UPDATE/DELETE: qualquer usuário autenticado, restrito a arquivos
    cujo prefixo é `<auth.uid()>/...` (dono do arquivo).
  - SELECT: dono + gestores/CEO (pra moderar). Público **nunca** lê direto.
- Migração aditiva em `materiais_links` (nome mantido pra não quebrar):
  - `storage_path text` (nulo pra links externos legados)
  - `mime_type text`, `size_bytes bigint`, `thumb_url text`
  - `origem text default 'link'` (`'link' | 'upload'`)

**2. Edge functions**
- `materiais-upload-sign` (autenticado): recebe `{empreendimento_ref, filename, mime, size}`,
  valida MIME/size, devolve `{ path, signed_upload_url }` (usa
  `storage.from(bucket).createSignedUploadUrl`).
- `materiais-signed-read` (autenticado): recebe `{ material_id }`, checa
  permissão via RLS, devolve URL assinada de leitura (10 min).
- `materiais-share-get` (já existe, público): passa a resolver `storage_path`
  em URL assinada antes de devolver ao site — nada muda no contrato do
  frontend do site.

**3. Frontend `/materiais`**
- Novo componente `UploadMaterialDialog.tsx` com o mockup acima.
- `useMateriaisMutations.tsx`: nova mutação `criarMaterialUpload` que
  1) pede signed URL, 2) faz PUT com progresso, 3) gera thumb, 4) insere linha em
  `materiais_links` com `origem='upload'` e `storage_path`.
- `MaterialCard.tsx`: pra materiais de upload, abrir via
  `materiais-signed-read` (não expõe URL direta no HTML).
- `GerarLinkDialog.tsx`: sem mudança — recebe o mesmo shape de asset.

**4. Validação ponta-a-ponta**
- Subir 1 foto, 1 vídeo, 1 PDF em Casa Tua.
- Confirmar thumb, progresso, e abertura via signed URL no CRM.
- Gerar link comercial e abrir no site — os assets de upload devem carregar
  igual aos de link externo.
- Testar sem quebrar nada dos materiais atuais (todos ficam `origem='link'`).

## O que **fica fora** desta fase

- Ingestão IA (tags/embeddings) — próxima fase.
- Transcodificação de vídeo (mantemos o arquivo original; se ficar grande demais
  a gente evolui depois).
- Editor de imagem/crop dentro do CRM.

Se aprovar, começo pela Fase 1 (bucket + migration) e paro pra você validar
antes de mexer no frontend.
