## Diagnóstico

O `FocusFooter` está **dentro** do container scrollável do body:

```tsx
{/* BODY (linha 756) */}
<div className="flex-1 overflow-y-auto flex flex-col">
  {/* ...config / loading / empty / LeadFocusScreen... */}

  {/* Footer renderizado AQUI dentro (linha 873) */}
  <FocusFooter ... />
</div>
```

O `sticky bottom-0` do footer (linha 27 de `FocusFooter.tsx`) gruda no fundo do **scroll container**, não no fundo do modal. Como o `LeadFocusScreen` usa `flex-1 min-h-0` e tem rolagem própria internamente em alguns blocos (timeline, painel), o footer acaba flutuando no meio da viewport quando o usuário rola — é o bug do print.

## Correção

Mover `<FocusFooter />` para **fora** do `<div className="flex-1 overflow-y-auto ...">`, virando irmão direto da BODY dentro do `DialogContent`. O `DialogContent` já é `flex flex-col h-full`, então:

- BODY (`flex-1 overflow-y-auto`) ocupa o espaço restante e rola sozinho.
- FOOTER (`shrink-0`) cola permanentemente na base do modal, sem depender de `sticky`.

E remover o `sticky bottom-0 z-10` do `FocusFooter` (não precisa mais — vai estar sempre no fim do flex-col do modal).

### Arquivos alterados

1. **`src/components/pipeline/FocusModeModal.tsx`** — mover bloco do `<FocusFooter />` (linhas 871-880) de dentro do `</div>` do body para depois dele.
2. **`src/components/pipeline/focus/FocusFooter.tsx`** — trocar `sticky bottom-0 left-0 right-0 z-10` por apenas `shrink-0` (mantém o resto do estilo: grid 3 colunas, padding, background blur, border top).

Nenhuma mudança visual além da correção do posicionamento — mesmo background, mesma altura, mesmos botões.

## Verificação

1. Abrir Modo Foco em `/corretor`.
2. Rolar o conteúdo do lead até o fim — confirmar que o rodapé permanece colado na base do modal o tempo todo.
3. Confirmar que setas ← / → e botões Anterior/Próximo continuam funcionando.
4. Confirmar que o footer não aparece em configPhase / empty state / loading (condicional na linha 873 já cuida disso).

## Fora de escopo

Sem mudança de lógica, atalhos, telemetria ou conteúdo do lead. Apenas posicionamento do rodapé.
