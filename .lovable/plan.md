## Corrigir sobreposição do header do Pipeline (visão Gestor/CEO)

### Diagnóstico

No desktop (≥ lg, viewport atual 1581px), o Header do Pipeline tem 3 linhas, mas a **Linha 1** usa `flex-wrap` com altura fixa `h-12`. Quando o conjunto de elementos não cabe (caso do gerente: seletor de corretor + filtros avançados + busca 280px + Ordenar + Modo Foco + Novo Lead), os botões da direita "quebram" para baixo e invadem a **Linha 2**, onde ficam as tabs (Kanban / Modo Time / Inteligência) e as pílulas (Em dia / Sem tarefa / Atrasado / Negócios) alinhadas à direita. Resultado: tudo se sobrepõe como na captura.

**Arquivo:** `src/components/pipeline/PipelineHeader.tsx` (branch `hidden lg:block`, linhas 434–528).

### Correção

Manter o mesmo conteúdo, mas impedir o wrap da Linha 1 e dar respiro à Linha 2.

**Linha 1 (lg+)** — `PipelineHeader.tsx` linha 436:
- Remover `flex-wrap` e `h-12` fixos.
- Trocar por `min-h-12 py-1.5 flex-nowrap` para manter linha única e crescer só se necessário.
- Reduzir a largura da busca quando o espaço aperta: `w-[280px]` → `w-[200px] xl:w-[260px]` (linha 486).
- Garantir `min-w-0` no container da direita (linha 458) para que `flex-1` (linha 456) absorva o sobrante sem empurrar nada para baixo.

**Linha 2 (lg+)** — linha 531:
- Trocar `overflow-x-auto h-9` por `flex-wrap gap-y-1 min-h-9 py-1` para que as pílulas da direita, quando o espaço é curto, desçam de forma controlada abaixo das tabs (em vez de ficarem sobrepostas).
- Mantém o `flex-1` separador (linha 624) que joga as pílulas à direita.

Nada do conteúdo, dos contadores, do comportamento dos filtros ou das ações (Modo Foco, Novo Lead, Selecionar, Fila CEO, Refresh) muda — só o layout.

### Validação

1. Recarregar `/pipeline` no preview (gestor logado, 1581px) e tirar screenshot.
2. Conferir com `image_tools--zoom_image` o header completo: Linha 1 inteira (logo+contagem | corretor select | filtros | busca | Ordenar | Modo Foco | Novo Lead) sem quebrar; Linha 2 com tabs à esquerda e pílulas à direita, sem sobreposição.
3. Conferir também em ~1280px (tablet/lg) para garantir que a Linha 1 ainda não quebra (ou, se quebrar, que cresce verticalmente sem invadir a Linha 2).
4. Sem mudanças em mobile/tablet (`md:hidden` e `md:block lg:hidden` ficam intactos).

### Fora de escopo

- Lógica de filtros, contadores, telemetria, dark mode tokens.
- Cards do kanban, drawer do lead, Modo Foco interno.
