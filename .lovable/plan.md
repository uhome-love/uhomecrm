# Correção: Oferta Ativa do corretor + botão do Mutirão

## O que está acontecendo

**1. Oferta Ativa "não abre" para a corretora**
A página `/oferta-ativa` é a visão de gestão. Quando quem entra é corretor puro, ela redireciona para `/corretor` (Minha Rotina) — exatamente o sintoma relatado. O menu do corretor aponta para `/corretor/call`, mas qualquer entrada por `/oferta-ativa` (aba salva, link antigo, favorito, atalho de outra tela) cai no redirect e parece "não abrir".

Os dados da Adriana estão corretos: perfil ativo, papel corretor, equipe do Junior Padilha, e 3 campanhas liberadas visíveis para ela (Alto Lindóia, Campanha de Investimento – Ago/2026 e Casa Tua POA · Terraço). Não é problema de permissão nem de campanha.

**2. Botão "Mutirão Inteligente" sem mutirão hoje**
Não existe sessão ao vivo hoje (a última foi 21/08, já encerrada). O banner do dashboard do corretor está programado para pulsar em **toda quinta-feira das 10h às 21h BRT**, mesmo sem sessão criada. Hoje é quinta, por isso o botão apareceu.

## O que será feito

1. **Redirecionar o corretor para a tela certa**: ao entrar em `/oferta-ativa`, corretor puro passa a ir para `/corretor/call` (a Oferta Ativa dele, com Ligar / Bases / Reservados / Aproveitados / Meus resultados / Ranking) em vez de voltar para Minha Rotina.
2. **Banner do Mutirão só quando houver sessão ao vivo**: remover a regra de "quinta-feira 10h–21h". Sem sessão ao vivo, o botão não aparece.

Nenhuma mudança de banco, de RLS ou de regra de campanha.

## Detalhes técnicos

- `src/pages/OfertaAtiva.tsx`: no guard `if (isCorretor && !isGestor && !isAdmin)`, trocar `<Navigate to="/corretor" replace />` por `<Navigate to="/corretor/call" replace />`.
- `src/components/oferta-ativa-ao-vivo/MutiraoPulseBanner.tsx`: remover o cálculo `isThursday`/`inWindow` e retornar `null` quando não houver sessão com `status='ao_vivo'` na janela `inicio_at <= agora <= fim_at`. O restante do banner (texto ao vivo + janela em BRT) fica igual.
- Sem alterações em `useCampanhasDisponiveis`, `useOAListas` ou políticas de `oferta_ativa_listas`.

## Validação

- Abrir `/oferta-ativa` com acesso de corretora: deve cair em `/corretor/call` com a campanha do dia e as abas carregadas.
- Confirmar no dashboard do corretor que o botão do Mutirão não aparece hoje (sem sessão ao vivo) e reaparece quando uma sessão for aberta.
