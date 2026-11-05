# Nova marca UhomeSales no CRM

Conferi o pacote: **está completo** (53 arquivos) — logo claro/escuro/branco, símbolo, favicon, ícones do app/iPhone, versão de Natal, avatar do Homi e os componentes prontos. Só identidade visual: nenhum dado, regra, rota ou permissão muda.

## O que vai mudar
1. **Menu lateral aberto** — sai o Homi com gorro + "UhomeSales" + "Powered by Homi AI"; entra o logo oficial "HomeSales." (claro ou escuro conforme o tema). Aparece uma vez só.
2. **Menu lateral fechado** — só o símbolo.
3. **Celular** — topo/menu com o mesmo logo.
4. **Aba do navegador** — novo favicon (sem gorro, como pede o guia).
5. **Ícone do app instalado / iPhone** — novos ícones azuis "UhomeSales".
6. **Tela de entrada** — logo + "com Homi IA" embaixo.
7. **Botão "Perguntar ao Homi"** — azul #3D57E6 com o avatar plano do Homi; balão de fala ciano claro (e versão escura).
8. **Natal** — logo e símbolo com o gorro oficial do pacote.

## Dois ajustes ao pacote (para não quebrar o CRM)
- **Gorro de Natal**: o pacote liga o gorro só de 1º/12 a 6/1, mas a campanha Natal do CRM já está no ar desde 02/11. Vou ligar o gorro junto com a campanha atual (mesma chave da decoração) — some sozinho quando ela acabar.
- **Arquivo do app instalado**: o CRM já tem um arquivo de app usado pelas notificações push. Vou manter esse arquivo e trocar só nome, cor e ícones, em vez de criar um segundo (evita quebrar o push).

## Validação
Preview: menu aberto/fechado, tema claro/escuro, celular, tela de entrada, favicon, botão do Homi e gorro de Natal. Depois, conferir no site publicado.

## Detalhes técnicos
- Criar `src/components/brand/` com `brandPaths.ts`, `UhomeSalesLogo.tsx`, `HomiAvatar.tsx` sem alterar conteúdo; `natal` recebe `isNatal()` de `src/natal/` (não `isNatalSeason`).
- `public/`: `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`; atualizar `public/manifest.json` (nome, theme_color #5271FF, ícones) em vez de `site.webmanifest`; trocar tags de ícone no `index.html`; remover `favicon-app.png`/`favicon.png` antigos só se não houver outras referências (push usa ícone — conferir `sw.js`).
- Editar `Sidebar.tsx` (aberto/fechado, remover gorro antigo do logo em `natal.css`), topo mobile, `Auth.tsx` e o botão do Homi.
