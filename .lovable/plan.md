# Minhas páginas de Natal: construção (desenho aprovado)

## Passos
1. **Senha do site:** abro uma caixa segura para você colar a senha `CRM_BRIDGE_TOKEN`, a mesma que está no projeto do site. Sem essa senha a tela mostra só o erro "Tentar de novo".
2. **Função de servidor `natal-links`:** confere o login, lê o link (slug) e o e-mail do próprio corretor e busca no site a lista `list_natal_links`. Quando o site responde com erro, repassa a mensagem dele. É só leitura e não grava nada no CRM.
3. **Tela nova** (igual ao desenho aprovado): fica numa nova aba da Campanha de Natal e tem um atalho no painel do corretor. Ela traz:
   - o cartão da página do corretor e o aviso de foto;
   - a grade de empreendimentos;
   - os botões Copiar, WhatsApp (com a mensagem editável), Abrir e Prévia;
   - os avisos de carregando, erro e "O Natal terminou em 18/12".
4. **Testes:** formatação do preço em R$ e montagem do link do WhatsApp.
5. **Validação ao vivo** com um corretor real, no computador e no celular: abrir os links e confirmar o nome, a foto e o WhatsApp do corretor.

## Detalhes técnicos
- Arquivos: `src/natal/central/MinhasPaginasNatal.tsx`, `src/natal/central/natalLinks.ts` (helpers puros + teste), aba em `CampanhaNatalPage.tsx`, atalho no painel por wrapper pequeno de `src/natal/`.
- Edge: getClaims, CORS, POST no endpoint `crm-bridge` do site, com o token só no servidor.
- Prévia por iframe, com "Abrir em nova aba" como alternativa.
- Sem migration e sem mudança nas regras de leads ou da Roleta.
