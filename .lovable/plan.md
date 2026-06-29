## Problema

No mobile, ao rolar a Central de Relatórios o conteúdo "vaza" por trás do cabeçalho fixo ("Central de Relatórios" + filtros). Nas capturas dá pra ver "Pipeline de Leads" e "VGV assinado por dia" aparecendo atrás/acima do header enquanto se rola.

## Causa raiz

1. **Padding duplo do container de scroll.** Toda página é renderizada dentro de um container com scroll que aplica `p-4 sm:p-6 lg:p-8` (`AppLayout.tsx:301-302`), exceto as marcadas como `noPadding`. A Central **não** está marcada como `noPadding` (`pageRegistry.ts:198`), enquanto o Pipeline está (`pageRegistry.ts:142`). Resultado: o header `sticky top-0` da Central fica preso *dentro* da área com padding, deixando uma faixa acima dele onde o conteúdo rola e fica visível.
2. **Header semi-transparente sem blur efetivo no mobile.** O cabeçalho usa `bg-background/85 backdrop-blur` (`CentralHeader.tsx:69`). Em iOS/Android o `backdrop-blur` frequentemente falha quando há ancestrais com `overflow`/`transform`, então o fundo translúcido deixa o texto de trás aparecer nítido — exatamente o "bug" das imagens.

## Correção

```text
1. pageRegistry.ts  → /central-relatorios recebe noPadding: true
                      (elimina o padding externo; a própria página já
                       aplica p-4 sm:p-6 no <main>)

2. CentralHeader.tsx → fundo opaco e sólido:
   - trocar bg-background/85 backdrop-blur por bg-background
     (mantendo supports-[backdrop-filter] como progressive enhancement
      opcional, mas com base 100% opaca para não vazar no mobile)

3. CentralRelatoriosV2.tsx → garantir que o root da página não
   introduz gap: manter min-h-full e deixar o header colado no topo
   real do container de scroll (já resolvido pelo passo 1).
```

## Validação

- Rodar Playwright em viewport mobile (≈440px) autenticado, abrir `/central-relatorios`, rolar até o fim e capturar screenshots em 2–3 posições de scroll para confirmar que:
  - nenhum conteúdo aparece atrás do header;
  - o header permanece fixo e legível (fundo sólido);
  - todas as seções (Geral, Pipeline, Oferta Ativa, Visitas, Negócios, Vendas, Ranking) rolam sem travar e sem overflow horizontal.
- Conferir também desktop (1280px) para garantir que remover o padding externo não quebrou o espaçamento (a página já tem padding próprio no `<main>`).

## Arquivos afetados

- `src/config/pageRegistry.ts` (1 linha)
- `src/components/central-v2/CentralHeader.tsx` (classe do `<header>`)
- `src/pages/CentralRelatoriosV2.tsx` (apenas se necessário ajuste fino do wrapper)

Mudança puramente de layout/apresentação — sem alterar dados, RPCs ou lógica.