# Ficha do cliente — análise visual e acabamento final

## Resposta direta
Não, ainda não é o máximo. A estrutura está certa (topo, "Agora", abas), mas o acabamento ainda tem cara de "montado em partes": cada bloco tem um estilo, há repetições e espaços mal usados. Nota hoje: 7/10. Abaixo, o que impede o 10.

## O que está bom (manter)
- Topo único com nome, etapa, produto, origem, corretor e contatos.
- Botões Ligar / WhatsApp / Anotar no canto.
- Um só botão principal "Registrar atividade".
- Linha do tempo agrupada por dia.

## Problemas encontrados (pela imagem do Ivo Xavier)

**Topo**
1. Selos sem padrão: "Qualificação" tem borda dupla azul forte; "Quente" e "Atenção" são só texto colorido. Parecem de sistemas diferentes.
2. "Atenção" no topo repete o quadro "13 dias sem atualização" logo abaixo.
3. Faixa cinza vazia entre o topo e o corpo — espaço desperdiçado.
4. Botões de ação com tamanhos e pesos diferentes do botão fechar (X).

**Coluna esquerda**
5. Cinco cartões empilhados com estilos diferentes (títulos em MAIÚSCULO cinza, outros em negrito, um com ícone, outro em itálico). Falta ritmo.
6. "Negócio — Ainda não há proposta" ocupa um cartão inteiro numa etapa (Qualificação) em que negócio nem existe.
7. "13 dias sem atualização" + "8d" + "Faltam 8 dias": três números para a mesma informação, confuso.
8. "Perfil do lead 0/5" em itálico com texto longo parece aviso de erro.
9. Metade de baixo da coluna vazia.

**Coluna direita**
10. Título "História do lead / a jornada — 15 marcos" repete a aba "Linha do tempo 8" — e os números não batem (8 vs 15 vs 11).
11. Botão "Novo histórico" roxo, diferente do azul do "Registrar atividade" — duas cores de ação e dois botões para quase a mesma coisa.
12. Filtro Narrativa/Sistema grande demais e com emojis pequenos borrados.
13. Itens da linha do tempo: ícone redondo + emoji + caixa com borda colorida = três marcações por item. Visual carregado.
14. Caixas de texto com largura variável (umas estreitas, outras largas) — parece desalinhado.
15. Barra de abas centralizada num fundo azulado largo, enquanto o conteúdo é alinhado à esquerda.

## Proposta de acabamento (somente visual, nada de regra muda)

**Topo**
- Todos os selos no mesmo formato (pílula suave, mesma altura): Etapa · Temperatura · Saúde. Saúde só aparece no topo; o quadro de atraso na esquerda vira uma linha discreta dentro do "Agora".
- Remover a faixa vazia; topo encosta no corpo com uma linha fina.
- Botões de ação e X com mesma altura e estilo.

**Coluna esquerda — um só cartão "Agora" + seções leves**
- "Agora": próxima tarefa/visita, uma linha de saúde ("13 dias sem contato · estagna em 8 dias"), botão Registrar atividade.
- Negócio só aparece a partir de Documentação.
- "Etapa da qualificação" e "Perfil do lead" como seções sem caixa pesada, mesmo título e mesmo tamanho; perfil vazio vira "Completar perfil (0/5)" em texto normal.
- Títulos de seção todos no mesmo estilo.

**Coluna direita**
- Remover o título "História do lead" (a aba já diz). Contador único e coerente.
- Trocar "Novo histórico" por botão discreto "+ Anotação" na mesma cor de ação do sistema (azul), ou remover se "Anotar" do topo já faz isso.
- Narrativa/Sistema vira filtro pequeno, sem emoji.
- Item da linha do tempo: só o ícone redondo + título + texto corrido + autor/hora. Sem emoji duplicado e sem caixa; largura do texto alinhada.
- Abas alinhadas à esquerda, sublinhado simples na aba ativa.

**Celular**
- Mesmas regras; conferir em 390px com o menu fixo embaixo.

## Ordem de trabalho
1. Mockup computador + celular com essas mudanças para sua aprovação.
2. Construção após aprovação.
3. Conferência ao vivo em fichas de etapas diferentes (Qualificação, Visita, Proposta, Ganho), computador e celular, sem salvar nada em clientes reais.

## Detalhes técnicos
- Arquivos: `DrawerTopo.tsx`, `DrawerAgora.tsx`, `PipelineLeadDetail.tsx`, `LeadHistoricoTab.tsx`/timeline, cartão de perfil e etapa da qualificação.
- Criar um componente de selo único e um de título de seção, usando só tokens do design system (`--primary` para ação).
- Contagem da aba e da timeline vindo da mesma fonte.
- Nenhuma mudança em regras, consultas ou banco.
