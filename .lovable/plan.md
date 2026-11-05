# Novo logo UhomeSales no CRM

Usar o logo escolhido no guia enviado (Conceito A — símbolo da casa com "U" + "HomeSales." em azul #5271FF e cinza #64748B), aplicado exatamente como na seção "Aplicação no CRM".

## Onde o logo entra
1. **Menu lateral (computador)** — tema claro: "Home" azul + "Sales" cinza; tema escuro: "Sales" cinza claro #AEB7C6. Menu fechado mostra só o símbolo.
2. **Celular** — topo e menu com o mesmo logo/símbolo.
3. **Ícone da aba do navegador** — símbolo azul (32/16 px), substitui o ícone atual.
4. **Ícone do app instalado (celular)** — símbolo branco em quadrado azul arredondado, nome "UhomeSales".
5. **Tela de entrada** — logo "HomeSales." com "com Homi IA" embaixo, encaixado no desenho de login já aprovado (que ainda vai ser construído na Fase 2).
6. **Natal** — durante a campanha, o gorro passa a ser o do guia (encostado no topo da casa), substituindo o gorro atual do logo. Some sozinho quando a campanha acabar.

## Regras do guia respeitadas
- Não esticar, não trocar cores, não inclinar/sombrear, não colocar o Homi em cima do símbolo.
- Tamanho mínimo: logo 24 px de altura, símbolo 16 px.
- Cores e fonte do logo (Montserrat 800) só no logo; o resto do CRM segue igual.

## O que NÃO muda
- Nenhuma tela, botão, dado ou regra do CRM; só a marca.
- Os conceitos B, C e D do guia não são usados.

## Validação
- Conferir no preview: menu aberto/fechado, tema claro/escuro, celular, aba do navegador, tela de entrada e versão de Natal.

## Detalhes técnicos
- Extrair os SVGs do símbolo/logotipo do HTML enviado (renderizado) e salvar como componente `UhomeSalesLogo` (variantes: completo, símbolo, negativo, natal) usando tokens `shell-*`/marca em `index.css`.
- Favicon `public/favicon.svg` + PNG 192/512 para o manifesto PWA; remover `favicon.ico` antigo; atualizar `index.html` e manifest.
- Gorro natalino só em `src/natal/` (wrapper), mantendo o padrão de remoção da campanha.
