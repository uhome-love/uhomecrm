# Central de Tarefas — aproveitar a largura da tela

Objetivo: deixar `/minhas-tarefas` usar a largura total do conteúdo (como Agenda de Visitas), em vez de ficar centralizada e estreita, **sem mudar nenhuma funcionalidade, query ou regra**. Apenas layout/apresentação em `src/pages/MinhasTarefas.tsx`.

## Diagnóstico
- Hoje o container é `p-4 md:p-6 max-w-4xl mx-auto` → trava em ~896px e centraliza, sobrando muito espaço vazio nas laterais em telas grandes.
- A lista de tarefas é uma coluna única (`space-y-3`), então mesmo soltando a largura os cards ficariam largos demais.
- A Agenda de Visitas usa largura total e densidade maior — é o padrão a seguir.

## Mudanças propostas (somente visual/layout)

1. **Largura total**
   - Trocar `max-w-4xl mx-auto` por um container full‑width consistente com o resto do app (mantendo padding lateral). Cabeçalho, filtros e lista passam a ocupar a largura disponível.

2. **Lista de tarefas em grid responsivo**
   - Converter a lista de cards de coluna única para grid responsivo: 1 coluna no mobile, 2 em `lg`, 3 em `xl`/`2xl` (`grid gap-3`), preenchendo o espaço horizontal sem esticar cards.
   - Aplicar o mesmo grid à lista de "Desatualizados".
   - Skeleton de carregamento e empty states ajustados ao novo container.

3. **Ajustes finos de densidade (opcional, leve)**
   - Garantir que filtros e cabeçalho fiquem alinhados à esquerda na largura nova, sem alterar componentes (`PageHeader`, badges, ações permanecem iguais).

## Fora de escopo (não tocar)
- Nenhuma query Supabase, contadores, abas, fluxo de criar/editar/adiar/concluir, navegação, elegibilidade ou lógica de categoria.
- Sem mudanças em hooks, `taskQueryUtils`, `taskBuckets` ou nos diálogos de criação/edição.

## Arquivo afetado
- `src/pages/MinhasTarefas.tsx` (apenas classes de layout/wrappers).

## Verificação
- Screenshots em 390, 820, 1440 e 1920 px.
- Conferir: cards preenchendo a largura sem quebrar, contadores idênticos, troca de abas, criar/editar/adiar/concluir, dark mode, tooltip de Desatualizados.
