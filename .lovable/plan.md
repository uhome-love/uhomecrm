# Academia por Módulos — gestão estilo Hotmart

Objetivo: você entra em `/academia?tab=gerenciar`, cria um **módulo**, arrasta os vídeos para dentro dele e pronto — o corretor vê o módulo com a capa e assiste às aulas em sequência, igual Hotmart.

A estrutura já existe no banco (módulo = `academia_trilhas`, aula = `academia_aulas`, upload = bucket `academia-videos`). O que falta é: linguagem de "módulo", uma tela de gestão simples de arrastar-e-soltar, e o conserto do acesso aos vídeos.

## 1. Correção necessária (vídeo hoje não toca)

Os buckets `academia-videos`, `academia-pdfs` e `academia-capas` estão **privados**, mas o código gera link público. Resultado: o upload funciona e o vídeo não abre.

Correção: leitura pública nos três buckets; envio/edição/remoção apenas para gestor/admin (via `has_role`). Limites: vídeo até 500 MB (mp4/webm/mov), PDF até 50 MB, capa até 2 MB.

## 2. Nova tela "Gerenciar" (estilo Hotmart)

Substitui a grade atual de 3 colunas por uma lista vertical de módulos em acordeão:

```text
[+ Novo módulo]

▸ 1  Atendimento                    12 aulas · 48 min   [publicado] ⚙ 🗑
▾ 2  Call Center                     8 aulas · 33 min   [rascunho]  ⚙ 🗑
      ⠿ 1  Aula 1 — Abertura da ligação   04:35  ▶ vídeo   ✎ 🗑
      ⠿ 2  Aula 2 — Contorno de objeção   02:39  ▶ vídeo   ✎ 🗑
      ┌────────────────────────────────────────────┐
      │  Arraste vídeos aqui ou clique para enviar │
      └────────────────────────────────────────────┘
▸ 3  Do Lead à Visita                0 aulas            [rascunho]  ⚙ 🗑
```

Comportamento:
- **Arrastar vários vídeos de uma vez** para dentro do módulo: cada arquivo vira uma aula automaticamente, com título = nome do arquivo (editável), ordem na sequência e duração lida do próprio vídeo. Barra de progresso por arquivo.
- **Reordenar** aulas e módulos arrastando pelo ⠿ (salva `ordem`).
- Editar aula abre o diálogo atual (título, descrição, tipo, XP, quiz) — nada perdido: YouTube, Vimeo, PDF, texto e quiz continuam disponíveis.
- Publicar/despublicar direto na linha do módulo; módulo em rascunho não aparece para o corretor.
- Capa do módulo (pôster 2:3) no diálogo de edição, como já existe.

## 3. Os 5 módulos pedidos

Criados já com capa e categoria, prontos para receber vídeos:

| Módulo | Categoria |
|---|---|
| Atendimento | Objeções e Scripts |
| Call Center | Técnicas de Vendas |
| Do Lead à Visita | Processos Uhome |
| Empreendimento Casa Tua | Empreendimentos |
| Gestão Financeira | Processos Uhome |

Os 4 módulos existentes (Do Lead ao Fechamento, Nossos Empreendimentos, Oferta Ativa & Ligações, UhomeSales na Prática) permanecem intactos.

## 4. Linguagem

"Trilha" passa a se chamar **Módulo** em toda a Academia (gestão, carrosséis, hero, certificados). Só texto de interface — rotas, tabelas e progresso dos corretores não mudam.

## 5. Detalhes técnicos

- Migration: políticas de storage nos 3 buckets + `public = true` + limites/mime; insert dos 5 módulos (`publicada = false`).
- `src/pages/AcademiaGerenciarPage.tsx` (599 linhas) é dividido em: `ModuloAccordion.tsx`, `ModuloRow.tsx`, `AulaRow.tsx`, `AulaDropzone.tsx`, `AulaDialog.tsx`, `QuizDialog.tsx` em `src/components/academia/gerenciar/`.
- Upload múltiplo com fila sequencial (evita estourar memória), `duracao_minutos` extraída via elemento `<video>` antes do envio.
- Reordenação com `@dnd-kit` (já usado no projeto) e update em lote de `ordem`.

## 6. Validação

Typecheck limpo + validação ao vivo no preview: criar módulo de teste, subir 2 vídeos por arrastar, reordenar, publicar, assistir como corretor e confirmar que o vídeo toca e o XP registra. Módulo de teste apagado ao final.
