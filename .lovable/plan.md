# Aba "LIA do site" (só administradores)

## O que você vai ver
- Novo item no menu **"LIA site"** (aparece só para administradores; a Lia do WhatsApp continua como está).
- **Lista de conversas**: nome, telefone, página ou imóvel, campanha, situação (Conversando / Contato capturado / Visita marcada, com cor) e horário.
- **Filtros**: período (Hoje, 7 dias, 30 dias, Personalizado em dd/mm/aaaa), situação e "Só com telefone".
- **Ao abrir uma conversa**: chat completo em balões (cliente x LIA, com horário), quadro de contexto (página/imóvel, campanha, origem, dados capturados) e botão **"Abrir lead"** que abre a ficha do lead no CRM quando houver vínculo; sem vínculo, o botão aparece desativado com "Sem lead no CRM".
- No celular: lista em cartões; conversa abre em tela cheia com voltar; menu fixo embaixo preservado.
- Mensagens claras para "site não respondeu", "nenhuma conversa no período" e carregando.

## Ordem de trabalho (padrão Uhome)
1. Mockup (computador + celular) para sua aprovação antes do código.
2. Construção após aprovação.
3. Validação ao vivo no computador e no celular 390px, só leitura (nada é alterado no site).

## Detalhes técnicos
- Nova função de servidor `lia-site-conversas` (mesmo padrão de `natal-links`): exige login, confere papel `admin` em `user_roles` (403 caso contrário), chama `crm-bridge` do site com `x-crm-token = CRM_BRIDGE_TOKEN` (segredo já existente). Ações aceitas apenas `list_lia_conversas` (repassa filtros: período, situação, só com telefone, paginação) e `get_lia_conversa` (`id`). Token nunca vai ao navegador. 401 do site vira aviso "O site recusou a ligação".
- Página `src/pages/LiaSiteConversas.tsx` + componentes `LiaSiteLista`, `LiaSiteFiltros`, `LiaSiteConversa` (arquivos pequenos); dados via React Query; datas em BRT com `CampoDataBR`/formatBRT.
- Rota protegida só admin; item no `navConfig.tsx` só para admin.
- Os nomes exatos dos campos devolvidos pelo site serão conferidos na primeira chamada real; o mapeamento fica num único adaptador para tolerar variações.
- Botão do lead navega para a ficha do `crm_lead_id` no Pipeline.
- Sem tabelas novas e sem mudanças no banco.
