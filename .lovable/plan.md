# Redesign do Hub de Materiais — Plano de Implementação

## Problemas identificados (validados com screenshot ao vivo)

1. **Card do empreendimento muito estreito** — em desktop, com a sidebar aberta, o grid `lg:grid-cols-3` deixa o card com pouca largura interna. Os títulos dos materiais quebram com `line-clamp-2` e ainda aparecem cortados (`Drive Cas...`, `Fotos Deco...`).
2. **Lista vertical poluída** — cada material ocupa uma linha com ícone + texto + até 5 botões (favorito, copiar, download, WhatsApp, editar/excluir). Isso dificulta a leitura e não parece um marketplace de materiais.
3. **Ações contraditórias** — o usuário quer o fluxo: localizar → copiar → enviar pelo WhatsApp do corretor. Hoje o botão de WhatsApp tenta enviar sozinho, e o botão "Gerar link comercial" cria uma landing externa, que não é o objetivo.
4. **Falta de visual rico** — materiais de imagem/vídeo não mostram thumbnail, perdem a cara de "catálogo de ativos".
5. **Favoritos no lado de cada material** — polui a interface e não está no fluxo principal.

## Mockup aprovado para build

Veja os screenshots anexos:
- **Desktop**: card de empreendimento full-width, grid interno de 4 colunas de materiais com thumbnail, categoria em chip, título em 2 linhas, metadados e botões `Copiar` + `Download` (se arquivo) + `✨ Follow-up`.
- **Mobile**: card full-width, materiais empilhados 1 por linha, mesma ação primária `Copiar` e botão de follow-up com IA.

## Mudanças no escopo

### 1. Layout do card de empreendimento (`MaterialCard.tsx`)
- **Tornar o card full-width** dentro do container (remover grid de 1/2/3 colunas de empreendimentos; cada empreendimento vira uma "seção" horizontal).
- Dentro de cada card, os materiais serão exibidos em **grid interno** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`, ocupando a largura disponível.
- Header do card mantém logo, nome, contador de materiais/categorias e menu de gestão (apenas para gestores).

### 2. Novo item de material (`MaterialItem` — novo componente)
Cada material vira um card interno com:
- **Thumbnail superior** (120px): imagem real para fotos/vídeos; ícone ilustrado para PDF, Drive, link.
- **Chip de categoria** no canto superior esquerdo (Drive, Fotos, Vídeo, Apresentação, Atendimento, etc.).
- **Título** com `line-clamp-2` em tipografia 13px/600, nunca truncado verticalmente.
- **Metadados**: tipo do arquivo (PDF, Link, Imagens, etc.) + contagem/tamanho/duração/data.
- **Ações**:
  - `Copiar` — botão primário (azul), copia o link assinado para a área de transferência.
  - `Download` — botão ghost outline, aparece apenas se `storage_path` existir.
  - `✨ Follow-up` — botão outline com tom primário, abre diálogo de IA para gerar mensagem de acompanhamento sobre esse material.
- Remover completamente: ⭐ favorito por material, botão WhatsApp individual, botão "Gerar link comercial" no card.

### 3. Remoção do "Gerar link comercial"
- Remover o botão do `MaterialCard.tsx`.
- Remover o componente `GerarLinkDialog.tsx` e suas referências.
- Remover a função `materiais-share-create` e a tabela `materiais_shares` **se não houver outro uso**. Antes de dropar, confirmar no plano se deseja manter histórico/analytics de shares existentes ou se pode remover.
- Remover as páginas/rotas de landing pública (`/materiais/:id`) se não houver outro uso.

### 4. Novo diálogo: gerador de follow-up com IA (`FollowUpMaterialDialog.tsx`)
Fluxo:
- Corretor clica em `✨ Follow-up` no material.
- Diálogo abre com:
  - Nome do material e empreendimento pré-preenchidos.
  - Campo opcional "Tom da mensagem" (Amigável, Consultivo, Urgência).
  - Campo opcional "Contexto do cliente" (textarea curta, ex: "cliente quer 2 quartos").
  - Botão "Gerar com IA".
- Chama a edge function `homi-follow-up-message` (já existente) com o material selecionado.
- Exibe 3 variações de mensagem com botões `Copiar` e `Enviar no WhatsApp`.
- Registrar ação "follow-up" no `materiais_recentes` / analytics.

### 5. Ações em massa no footer do card
Adicionar no footer de cada empreendimento:
- `Copiar todos os links` — copia a lista de links do empreendimento para a área de transferência (um por linha, com título e URL).
- `✨ Gerar follow-up com IA` — abre o mesmo diálogo, mas considerando todos os materiais do empreendimento.

### 6. Ajustes na página principal (`MateriaisPage.tsx`)
- Remover grid externo de cards; empilhar empreendimentos verticalmente.
- Manter tabs Todos / Favoritos / Recentes.
- Manter busca textual + "Buscar com IA".
- Ajustar placeholder da busca para "Buscar por título, tag, empreendimento ou descrição...".
- Favoritos e Recentes devem usar o mesmo novo componente visual `MaterialItem`, não a lista compacta atual (ou adaptar a lista compacta para o novo visual).

### 7. Analytics e registros
- Manter `registrarMaterialRecente` para: copiar, download, abrir/preview, follow-up gerado.
- Remover registro de "whatsapp" individual (não haverá mais botão direto).
- Analytics continua contando views/clicks; se `materiais_shares` for removido, os eventos de share-view também serão removidos.

## Arquivos afetados

### Alterar
- `src/components/materiais/MaterialCard.tsx` — redesign completo.
- `src/pages/MateriaisPage.tsx` — layout externo, grid, busca.
- `src/components/materiais/MaterialListaCompact.tsx` — adaptar para novo visual (ou depreciar).
- `src/components/materiais/MaterialPreviewDialog.tsx` — manter, integrar no click da thumbnail.

### Criar
- `src/components/materiais/MaterialItem.tsx` — novo card interno de material.
- `src/components/materiais/FollowUpMaterialDialog.tsx` — diálogo de IA para follow-up.
- `src/hooks/useMaterialFollowUp.ts` — hook para chamar `homi-follow-up-message`.

### Remover
- `src/components/materiais/GerarLinkDialog.tsx`.
- Referências a `materiais-share-create` e landing pages se aprovado.
- Botões de favorito e WhatsApp nos itens individuais (favorito global continua via aba Favoritos, se mantido).

## Fluxo de uso final

1. Corretor entra em `/materiais`.
2. Vê empreendimentos em seções full-width com cards de materiais visuais.
3. Usa busca ou "Buscar com IA" para encontrar material.
4. Clica `Copiar` no material desejado.
5. Abre o WhatsApp próprio do celular/computador e cola o link.
6. (Opcional) Clica `✨ Follow-up` para receber 3 sugestões de mensagem da IA e copiar/enviar.

## Critérios de validação

- [ ] Card de empreendimento ocupa a largura total disponível (não fica estreito).
- [ ] Títulos de materiais nunca aparecem cortados no desktop nem mobile.
- [ ] Botão "Gerar link comercial" não existe mais em lugar nenhum.
- [ ] Cada material tem apenas: `Copiar`, `Download` (se arquivo), `✨ Follow-up`.
- [ ] Favorito e WhatsApp não aparecem ao lado de cada material.
- [ ] Follow-up com IA gera 3 mensagens e permite copiar ou enviar pelo WhatsApp.
- [ ] Mobile: layout responsivo, cards empilhados, ações acessíveis.
- [ ] Nenhum erro de build/typecheck após as alterações.

## Perguntas para confirmação antes do build

1. **Landing de link comercial**: posso remover `GerarLinkDialog.tsx`, a edge function `materiais-share-create` e a tabela `materiais_shares` completamente? Ou prefere desativar a UI mas manter o histórico/back-end?
2. **Aba Favoritos**: como não haverá mais botão ⭐ no item, como o corretor favorita? Sugiro manter o favorito no menu de 3 pontos ou em uma ação secundária no hover. Ou removemos a aba Favoritos também?
3. **Follow-up IA**: usar a edge function `homi-follow-up-message` existente (ela já recebe materiais e empreendimento) ou prefere criar uma function nova específica?

Assim que você aprovar o mockup e responder as 3 perguntas, parto para o build.