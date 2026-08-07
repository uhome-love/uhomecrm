# Mutirão ao vivo fixo no menu lateral

## Situação atual
O item "⚡ Mutirão ao vivo" só entra no menu enquanto existe uma sessão com status `ao_vivo` dentro da janela de início/fim. A última sessão terminou em 01/08, então hoje o item está invisível para todo mundo — inclusive corretores.

## O que muda
O item passa a ser fixo no menu lateral, sempre visível para corretores e gestores/CEO. Quando não houver mutirão rolando, a própria tela já mostra "Nenhum Mutirão ao vivo agora" — nada quebra.

Quando existir sessão ao vivo, o item ganha um indicador visual (ponto pulsante "AO VIVO") para chamar atenção, usando a mesma checagem que já existe hoje.

## Detalhes técnicos
- `src/components/layout/Sidebar.tsx`: remover a condicional `mutiraoAtivo ?` que injeta o item; o item passa a ser adicionado sempre nos grupos "Leads" / "Leads & Visitas" / "Modo Corretor" (mesma posição de hoje).
- `useMutiraoAtivo()` continua sendo usado, mas só para o badge "AO VIVO" no item, não mais para exibir/ocultar.
- Nenhuma mudança de rota, RLS, RPC ou backend. `/oferta-ativa-ao-vivo` já existe e já trata os perfis (corretor vê "Como corretor"; gestor/CEO veem Painel e Configurações).

## Validação
Conferir no preview que o item aparece no menu para o perfil corretor e para CEO, e que abrir a página sem sessão mostra o estado vazio correto.
