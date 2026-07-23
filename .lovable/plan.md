Objetivo: transformar a página de Materiais em um hub denso, onde os cards de material dominem a tela, reduzindo a altura ocupada por menus, buscas duplicadas e bordas.

Escopo: alterações apenas de layout/CSS/estrutura de componentes. Nenhuma mudança de regra de negócio, banco ou edge function.

Arquivos envolvidos:
- src/pages/MateriaisPage.tsx
- src/components/materiais/MateriaisSidebar.tsx
- src/components/materiais/MateriaisEmpreendimentoPanel.tsx
- src/components/materiais/MaterialItem.tsx
- src/components/materiais/MaterialPreviewDialog.tsx (caso o preview seja afetado por z-index/overlay)

1. Header compacto e unificado
   - Remover subtítulo abaixo do título (ou torná-lo tooltip/toggle).
   - Título "Materiais", botão "Analytics" e "Novo empreendimento" ficam em uma única linha.
   - No mobile, "Analytics" + "Novo" entram em um único DropdownMenu de ações para liberar largura.

2. Barra de navegação única (horizontal, anexada ao header)
   - Abas "Empreendimentos" / "Recentes" + busca global em uma linha compartilhada.
   - A busca global passa a filtrar tanto materiais quanto empreendimentos (mesmo campo, um placeholder só).
   - Botão "Buscar com IA" vira ícone de ação ao lado do input para economizar espaço.

3. Sidebar de empreendimentos enxuta
   - Remover a busca interna da sidebar; a busca global já cumpre o papel.
   - Reduzir padding e largura mínima (ex: 240px).
   - Destacar visualmente o empreendimento selecionado com uma borda lateral de destaque (indigo) em vez de card destacado.
   - Favoritos continuam no topo da lista, sem label separado com espaçamento extra.

4. Painel principal ocupando mais tela
   - Remover o wrapper `border rounded-xl` que cria duas bordas consecutivas.
   - Reduzir padding do `main` (de p-4 sm:p-6 para p-3 ou p-2).
   - Aumentar o grid de materiais conforme a largura: 4 colunas em 1280px, 5 em 1600px, 2 colunas em tablet, 1 coluna em mobile.
   - Cards de material ocupam mais altura do viewport (thumbnail maior, área de ação otimizada).

5. Ações do card sem corte em telas pequenas
   - No mobile: ações secundárias (download, abrir, IA) entram em um menu de 3 pontos; botão primário "Copiar" mantém-se visível.
   - No desktop: mantém as ações rápidas, mas com ícones menores e padding ajustado para evitar overflow.
   - Garantir `min-width: 0` em todos os containers para truncamento correto de texto.

6. Mobile-first adjustments
   - Header empilhado: título + dropdown de ações.
   - Botão de empreendimento no mobile fica sticky acima do conteúdo, liberando área de scroll.
   - Aba "Recentes" mantém lista compacta, mas com a mesma densidade do painel principal.

7. Validação visual
   - Após implementar, capturar screenshots em:
     a) 1378x797 (viewport atual do usuário)
     b) 1920x1080
     c) 390x844 (mobile)
   - Verificar se materiais aparecem no topo 1/3 da tela em desktop e se não há botões cortados no mobile.

Critérios de aceitação:
- Materiais começam a ser visíveis nos primeiros 35% da altura da tela em desktop.
- Nenhum botão cortado ou texto truncado em mobile 390px.
- Sidebar e busca global não duplicam funções.
- Sem regressão na pré-visualização de materiais (modal de imagem/vídeo/PDF continua funcionando).