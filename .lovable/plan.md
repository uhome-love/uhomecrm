

# Plano: Botao "Ver no site" + Placeholder sem foto

## Ajuste 1: Botao "Ver no site"

### No card (SitePropertyCard.tsx)

Adicionar abaixo do bloco de preco/condominio (apos linha 287), antes do fechamento do `</div>` de texto:

- Botao `w-full h-8 text-sm` com variante `outline`, cor indigo
- Icone `ExternalLink` + texto "Ver no site"
- Acao: `window.open(shareUrl, "_blank")` (o `shareUrl` ja esta computado via `shareUrlUhome` na linha 100)
- Condicional: so renderizar se `imovel.slug || imovel.codigo` (para nao mostrar link quebrado)
- `onClick` com `e.stopPropagation()` para nao abrir o drawer

### No drawer (PropertyPreviewDrawer.tsx)

Adicionar botao "Abrir no uhome.com.br" no bloco de acoes (entre o WhatsApp e os botoes Favoritar/Copiar, ~linha 500):

- Botao com variante `default` (fundo indigo), `w-full h-11`, icone `ExternalLink`
- Usa `propertyUrl` que ja esta computado na linha 233-240
- Condicional: so mostrar se `propertyUrl` nao for vazio
- `target="_blank"`

## Ajuste 2: Placeholder sem foto

No SitePropertyCard.tsx, melhorar o bloco de fallback (linhas 146-148):

- Trocar o emoji `🏠` por icone `Building2` do lucide-react (tamanho 48px, cor `text-gray-300`)
- Adicionar texto "Sem foto" em `text-gray-400 text-xs` abaixo do icone
- Fundo `bg-gray-100 dark:bg-muted`

Adicionar estado `imgError` para tratar imagens que existem mas dao 404:
- No `<img>`, adicionar `onError={() => setImgError(true)}`
- Quando `imgError === true`, renderizar o mesmo placeholder do Building2
- Resetar `imgError` quando `fotoAtiva` mudar

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/components/imoveis/SitePropertyCard.tsx` | Botao "Ver no site" + placeholder Building2 + onError handling |
| `src/components/imoveis/PropertyPreviewDrawer.tsx` | Botao "Abrir no uhome.com.br" nas acoes |

## Nao alterar

- `siteImoveisRemote.ts`, `siteImoveis.ts`, filtros, paginacao, mapa, rotas, sidebar, tema

