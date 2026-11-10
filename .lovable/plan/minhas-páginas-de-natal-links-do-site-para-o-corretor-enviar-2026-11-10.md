# Minhas páginas de Natal (links do site para o corretor enviar)

## O que o corretor ganha
Uma nova área dentro da Campanha de Natal onde ele vê a sua página pessoal do "Natal Chave de Ouro" no site e cada empreendimento da campanha, já com o link dele, e envia ao cliente em um toque (copiar, WhatsApp ou abrir).

## Ordem de trabalho (regra fixa)
1. **Desenho primeiro** — mockup da tela no computador e no celular, para aprovação do Lucas. Nada é construído antes.
2. **Construção** — só depois do desenho aprovado.
3. **Validação ao vivo** — com um corretor real: abrir os links e confirmar nome, foto e WhatsApp do corretor, sem formulário. Computador e celular.

## Tela
- Topo: cartão "Sua página do Natal Chave de Ouro" com foto, nome, link e botões **Copiar link**, **Enviar no WhatsApp**, **Abrir**.
- Aviso amarelo quando o site não tem a foto do corretor: "Sua foto ainda não está no site. Fale com o marketing."
- Grade de empreendimentos (2 colunas no celular, 3–4 no computador): foto, nome, bairro, "a partir de R$ ...", entrega, os mesmos 3 botões (mensagem editável antes de enviar) e **Prévia** (abre a página do cliente numa janela).
- Estados: carregando, erro com a mensagem do site + "Tentar de novo", e "O Natal terminou em 18/12".
- Visual Natal que já existe no CRM.
- Atalhos: nas abas da Campanha de Natal e no painel inicial do corretor.

## O que precisa de você
- A senha de ligação com o site (`CRM_BRIDGE_TOKEN`) **não aparece hoje nas funções do CRM**. Antes de construir, confiro se ela já está guardada; se não estiver, peço que você cole o mesmo valor usado no site, numa caixa segura.

## Detalhes técnicos
- O arquivo citado `menuNatal.tsx` não existe; a área entra como nova aba em `src/natal/central/CampanhaNatalPage.tsx` (componente novo `MinhasPaginasNatal.tsx` + `natalLinks.ts` com helpers puros).
- Função de servidor nova `natal-links`: valida o login (getClaims), lê `slug_ref` e e-mail do próprio perfil (mesma lógica de `useBrokerSlug`), faz POST no `crm-bridge` do site com `x-crm-token` e `action: list_natal_links`; sem slug envia só o e-mail; repassa status e `error` do site. Token nunca vai ao navegador. Só leitura — não grava nada no CRM.
- Prévia via iframe da `url` (se o site bloquear iframe, cai para "Abrir em nova aba").
- Testes vitest: formatação do preço em R$ e link `https://wa.me/?text=` com mensagem + link codificados.
- Sem migration e sem mudança em regras de leads/Roleta.
