# Minhas Tarefas — trocar grade de 3 cards por lista densa em linha

Objetivo: substituir a grade de cards (`grid lg:grid-cols-2 xl:grid-cols-3`) por uma **lista densa de uma tarefa por linha**, em largura total, escaneável, mantendo **todas as ações visíveis**. Sem alterar regras de negócio, queries, contadores, filtros ou fluxos.

Arquivo único afetado: `src/pages/MinhasTarefas.tsx` (apenas markup/classes de apresentação).

## Estrutura de cada linha
Layout horizontal em uma faixa fina (não card empilhado):

```text
[●] [ícone tipo]  Nome do lead · Empreendimento · Telefone        [chip prazo]   [Ligar][WhatsApp][Scripts][Concluir][Editar][Adiar][+ Nova]
        \_ badge tipo + "ATRASADA"/descrição em linha secundária discreta
```

- **Coluna esquerda:** indicador de status (borda/círculo colorido por urgência — atrasada=destructive, hoje=warning, concluída=success) + chip redondo do ícone do tipo (reaproveita `tipoVisual`).
- **Centro (flex-1, min-w-0, truncate):** nome do lead (clicável → pipeline, como hoje) em destaque; linha secundária menor com empreendimento, telefone, tipo e descrição quando houver. Texto trunca para não quebrar a linha.
- **Direita:** chip de prazo (data/hora ou "Concluída dd/MM") + a barra de ações com **todos os botões atuais visíveis** (Ligar, WhatsApp, Scripts, Concluir, Editar, Adiar, Nova Tarefa), em tamanho compacto (`h-8`, ícones 3.5).

## Densidade e responsivo
- Container vira `divide-y rounded-[12px] border` (lista contínua) em vez de `grid gap-3`, aproveitando a largura toda da tela.
- Desktop: conteúdo à esquerda e ações à direita na mesma linha (`flex items-center justify-between`).
- Mobile: a linha colapsa em bloco — meta acima, ações abaixo em `flex-wrap`, mantendo todos os botões.
- Hover: leve realce de fundo (`hover:bg-muted/40`) em vez de `hover:shadow-md`.

## Reaproveitamento
- Mesmas variáveis e handlers já existentes (`isOverdue`, `isConcluida`, `tipoVisual`, `handleConcluir`, `openEditTarefa`, `openWhatsApp`, navegação, adiar, nova tarefa). Apenas o JSX do item muda.
- Skeleton de carregamento e a lista de "Desatualizados" são ajustados para o mesmo formato de linha (consistência), sem mexer na lógica.

## Fora de escopo
Nenhuma mudança em: queries Supabase, contadores, abas/filtros, elegibilidade, atrasadas/desatualizados, diálogos de concluir/adiar/editar/nova, navegação, hooks, `taskBuckets`/`taskQueryUtils`, timezone BRT.

## Verificação
Screenshots em 390px (mobile), 820px (tablet) e 1440/1920px (desktop): confirmar linha densa legível, prazo e ações visíveis, truncamento correto e que cada aba (Hoje/Amanhã/Semana/Concluídas) continua filtrando.
