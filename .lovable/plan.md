## Viabilidade de thumbnails automáticas

Conferi o código atual e a arquitetura disponível. O resultado é:

- **Imagens**: já funcionam. A `MaterialItem.tsx` gera uma signed URL do Storage e renderiza a imagem real no card. ✅
- **Vídeos**: extrair thumbnail automática exige ffmpeg, que não está disponível nativamente no Supabase Edge Functions (Deno). Precisaria de serviço externo/worker adicional. ❌
- **PDFs**: renderizar a primeira página em imagem exige bibliotecas pesadas de PDF no Deno. ❌
- **Links externos**: sem serviço de screenshot externo, não há preview automático. ❌
- **Áudio**: não existe preview visual nativo viável. ❌

A coluna `thumb_url` existe em `materiais_links`, mas nunca é preenchida. Upload manual de capa seria possível, mas não é automático.

**Conclusão**: thumbnails automáticas para vídeo/PDF/links/áudio não são viáveis no ambiente atual. Vamos seguir o plano B: **visualização em lista**.

---

## Plano: Hub de Materiais em Lista + Follow-up IA com seleção de materiais

### Objetivo
Trocar o grid de cards por uma lista densa, organizada por categoria, com ações de atalho sempre visíveis. O follow-up com IA passa a permitir escolher um material específico, vários ou todos do empreendimento, e a IA gera a mensagem com base no conteúdo daquele(s) material(is).

---

### Parte 1 — Layout em lista

1. **Novo componente `MaterialListItem.tsx`**
   - Linha horizontal com: ícone colorido do tipo, título em até 2 linhas, meta (extensão/tamanho), badge de categoria.
   - Ações de atalho à direita: **Copiar**, **Baixar/Abrir**, **Follow-up IA**.
   - Mobile: ações secundárias entram em menu de 3 pontos para não cortar.
   - Hover: fundo leve e destaque nas ações.

2. **Agrupamento por categoria no painel do empreendimento**
   - Grupos dobráveis (`Collapsible`) com título e contador.
   - Ordem fixa: Drive da construtora, Apresentação, Tabela de vendas, Disponibilidade, Script de vendas, Material de atendimento, Outros.

3. **Filtro rápido por tipo de mídia**
   - Chips: Todos, Imagens, Vídeos, PDFs, Links, Áudio.

4. **Preview inline só para imagens**
   - Miniatura quadrada pequena (48x48) quando for imagem.
   - Demais tipos usam ícone — sem área de preview vazia.

5. **Remover o grid de h-32 vazio**
   - A lista elimina o espaço atual que aparece vazio para links, PDFs, áudio e vídeo.

6. **Ações em massa no cabeçalho do empreendimento**
   - Manter "Copiar todos" e "Follow-up IA (todos)".

### Arquivos alterados — Parte 1
- `src/components/materiais/MaterialItem.tsx` → refatorar para layout em lista.
- `src/components/materiais/MateriaisEmpreendimentoPanel.tsx` → lista agrupada por categoria + filtros de tipo.
- `src/components/materiais/MaterialPreviewDialog.tsx` → mantido inalterado (preview em modal continua útil).
- `src/components/materiais/CategoriaIcon.tsx` → aproveitar cores/ícones existentes.

---

### Parte 2 — Follow-up IA com seleção de material

Atualmente o botão de "Follow-up IA" gera uma mensagem genérica com base no contexto do empreendimento. O dono do produto quer que o corretor possa **escolher** o(s) material(is) base.

1. **Novo componente `SelecionarMateriaisDialog.tsx`**
   - Abre ao clicar em "Follow-up IA" no cabeçalho do empreendimento ou em "Follow-up IA" de uma linha.
   - Mostra a lista de materiais daquele empreendimento com checkboxes.
   - Opções: Selecionar um, vários, ou "Selecionar todos".
   - Campo opcional: "Para quem é o follow-up?" (lead, cliente, corretor) — pode ser simplesmente um textarea de contexto.

2. **Atualizar `homi-follow-up-message` edge function**
   - Receber opcionalmente `material_ids: string[]`.
   - Se receber ids, buscar os chunks/resumo_ia/tags dos materiais selecionados em `materiais_links` e `materiais_chunks`.
   - Incluir o conteúdo extraído no contexto do prompt para gerar mensagem específica sobre o material.
   - Se não receber ids, manter comportamento atual (contexto geral do empreendimento).

3. **Ajustar hook de chamada no frontend**
   - `useMateriaisFavoritos` ou hook similar que chama `homi-follow-up-message` passando `material_ids`.

4. **Fluxos de uso**
   - **Cabeçalho do empreendimento**: "Follow-up IA" → abre seleção com todos pré-selecionados (pode desmarcar).
   - **Linha individual**: "Follow-up IA" → abre seleção com apenas aquele material pré-selecionado.
   - **Resultado**: mensagem de WhatsApp pronta, com referência natural ao(s) material(is) escolhido(s), ex.: "Olá! Segue o book de apresentação do Casa Tua que comentei...".

### Arquivos alterados — Parte 2
- `supabase/functions/homi-follow-up-message/index.ts` → aceitar `material_ids` e injetar contexto dos materiais.
- `src/components/materiais/SelecionarMateriaisDialog.tsx` → novo.
- `src/components/materiais/MaterialListItem.tsx` → chamar diálogo de seleção.
- `src/components/materiais/MateriaisEmpreendimentoPanel.tsx` → chamar diálogo de seleção no cabeçalho.
- `src/hooks/useMateriaisFavoritos.ts` ou hook de follow-up → passar `material_ids`.

---

### Fora de escopo (mantido como está)
- Upload de materiais.
- Extração de texto/IA do HOMI para a base de conhecimento.
- Analytics e favoritos por empreendimento.
- Permissões (quem edita/exclui).
- Thumbnails automáticas para vídeo/PDF (não viável).

---

### Critério de validação
- Abrir `/materiais` e ver uma lista compacta, sem cards grandes vazios.
- Títulos longos visíveis em 2 linhas.
- Botões de Copiar, Baixar/Abrir e Follow-up IA acessíveis sem cortar em 1378px e mobile.
- Categorias agrupadas e dobráveis.
- Filtro por tipo funcionar.
- Clicar em Follow-up IA abre o diálogo de seleção.
- Selecionar 1 material, vários ou todos funciona.
- Mensagem gerada pela IA faz referência ao conteúdo do material escolhido.
- Nenhuma regressão nos modais de preview.