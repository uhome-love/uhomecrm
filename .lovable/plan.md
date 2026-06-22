## Objetivo

Deixar o novo template de reengajamento **`atrio_lancamento`** pronto para disparo na Central de Disparos, com a imagem de cabeçalho hospedada e vinculada automaticamente.

O template já está **aprovado/ativo no Meta**, então ele já aparece sozinho na lista de templates do `DisparoCustomizadoCard` (puxada via `meta-templates-list`). Falta apenas: (1) hospedar a imagem do header e (2) mapear o template → imagem.

---

## 1. Hospedar a imagem do cabeçalho

A imagem enviada (peça "269 MIL — Lançamento na Orla do Guaíba") será enviada para o bucket público **`campaign-images`**, seguindo o padrão das demais campanhas:

```text
campaign-images/reengajamento/atrio-lancamento.png
```

Mesmo bucket/pasta das imagens `casatua-*` já existentes, mantendo o padrão de URL pública usado hoje.

## 2. Vincular a imagem ao template

No `src/components/central-nutricao/DisparoCustomizadoCard.tsx`, adicionar a entrada no mapa `TEMPLATE_HEADER_IMAGES`:

```ts
const TEMPLATE_HEADER_IMAGES: Record<string, string> = {
  casatua_junho25k: "...",
  casatua_eventosabado: "...",
  atrio_lancamento: "https://api.uhomesales.com/storage/v1/object/public/campaign-images/reengajamento/atrio-lancamento.png",
};
```

Com isso, ao selecionar o template `atrio_lancamento` no card, o campo de imagem do header é preenchido automaticamente (e a URL é enviada como `header_image_url` no disparo).

---

## Como ficará o fluxo de disparo (sem mudança no fluxo já existente)

1. Central de Disparos → card "Disparo Customizado", canal **Meta**.
2. Selecionar o público (ex.: Descartados / reengajáveis) + período + dedup.
3. Selecionar o template **atrio_lancamento** → imagem do header já preenchida.
4. A variável `{{1}}` (nome) continua sendo preenchida pela função de enqueue, como nos demais templates.
5. Preview → confirmar contagem → Disparar.

O roteamento de respostas (SIM → Fila do CEO / NÃO → inativa) já é o comportamento padrão de reengajamento e continua valendo.

---

## Arquivos / ações

- **Storage:** upload de `atrio-lancamento.png` no bucket `campaign-images` (pasta `reengajamento`).
- **`src/components/central-nutricao/DisparoCustomizadoCard.tsx`:** +1 linha no mapa `TEMPLATE_HEADER_IMAGES`.

Sem migrations, sem mudança de edge function, sem alteração de lógica de público/dedup/roteamento.