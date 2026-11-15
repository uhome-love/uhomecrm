# Caixa "Veio do site" organizada e fácil de entender

Só visual. Nada muda no que é salvo, na distribuição, no corretor ou na etapa.

## Problema hoje
A caixa empilha até 14 linhas soltas (pesquisou, onde clicou, página, entrou por, visitas, imóveis vistos, favoritos, buscas, imóvel, interesse, bairros, aparelho...), todas com o mesmo peso. Fica uma lista de textos difícil de ler.

## Como vai ficar (3 blocos, do mais útil para o menos)

```text
VEIO DO SITE                        [Google Ads — Natal]
-----------------------------------------------------------
O QUE PROCURA            (destaque, primeiro)
  Apto · Auxiliadora, Petrópolis +2 · 2 quartos · até 300mil
  Imóvel: Orygem (quando houver)

COMO CHEGOU
  Pesquisou "apartamento auxiliadora"
  Clicou em: Pop-up de saída  ·  Página: Busca  ↗

O QUE FEZ NO SITE
  3 visitas · 12 min · celular
  Viu 4 imóveis · 2 favoritos        [Ver detalhes ▾]
-----------------------------------------------------------
Selos: Cliente que voltou · Conversou com a LIA
```

- Interesse vira **uma frase curta** (mesma régua do cartão: "Apto Auxiliadora até 300mil"), texto completo ao tocar.
- Cada bloco tem título pequeno e no máximo 2 linhas.
- Listas longas (imóveis vistos, favoritos, buscas, primeira página, data da 1ª visita) ficam dentro de **"Ver detalhes"**, fechado por padrão.
- Linhas sem dado não aparecem; bloco sem nenhum dado some inteiro. Some o "Não informado pelo site" repetido.
- Celular 390px: mesmos 3 blocos, sem rolagem lateral, "Ver detalhes" fechado.

## Ordem de trabalho (padrão Lucas)
1. **Mockup** desktop + celular com a Vitória e um lead completo → aprovação.
2. Construir só a caixa.
3. Validar ao vivo em 1280px e 390px, claro e escuro, sem alterar leads reais.

## Detalhes técnicos
- Arquivo único: `src/components/pipeline/drawer/VeioDoSite.tsx` (reorganizar em subcomponentes Bloco/Linha; usar `Collapsible`).
- Reusar o resumo de interesse já usado no cartão/Fila CEO; `lerSiteOrigem` não muda.
- Só tokens do design system.
