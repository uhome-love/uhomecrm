# Roleta — corrigir "sem foco" e "credenciamento fechado" fantasmas

## O que foi verificado (dados reais, agora 20:0x BRT)

- Rafaela Campos **tem** foco: 3 empreendimentos alocados, e **2 visitas hoje** (elegível para a noturna).
- Ela **não tem nenhum credenciamento hoje** — ou seja, nunca conseguiu enviar; travou na tela.
- A janela noturna estava **aberta normalmente**: 13 corretores se credenciaram entre 18:07 e 19:55 e foram aprovados.
- Permissões de leitura de `corretor_alocacao` e `empreendimentos_canonicos` estão liberadas para qualquer usuário logado — não é bloqueio de acesso.

Conclusão: o backend está correto nos dois casos. Os dois bugs têm a **mesma causa no aplicativo**: a tela da Roleta calcula o horário e lê a alocação **uma única vez, quando abre**, e nunca mais atualiza sozinha. Quem deixa o CRM aberto (PWA no celular) continua vendo a foto antiga — "credenciamento fechado" (horário da tarde) ou "você não tem empreendimentos alocados" (antes do gestor definir o foco). Fechar/limpar o cache força um recarregamento e por isso "resolve".

Há também uma inconsistência de texto: a tela de credenciamento fechado diz "Noturna: 18:30 – 20:00", enquanto a regra real é **18:30 – 21:30**.

## O que será feito

1. **Relógio vivo na Roleta** — a tela passa a recalcular a janela a cada 30 segundos. Às 18:30 o card "Credenciamento fechado" vira sozinho a tela de marcar presença, sem recarregar o app.
2. **Foco sempre fresco** — ao abrir a Roleta, a alocação do corretor é recarregada do servidor (sem cache), e volta a ser buscada quando o app volta ao primeiro plano. Some o falso "você não tem empreendimentos alocados".
3. **Nunca mais bloquear por engano** — se a leitura da alocação falhar ou vier vazia, o botão exibe "Tentar novamente" em vez de afirmar que não há foco; e o corretor pode enviar o credenciamento mesmo assim (o servidor já valida a alocação de verdade e devolve mensagem clara).
4. **Empreendimento inativo** — hoje, se todos os empreendimentos do corretor estiverem inativos, a lista aparece vazia sem explicação. Passa a mostrar aviso explícito ("seus empreendimentos estão inativos, fale com o gestor").
5. **Corrigir os horários exibidos** — texto da tela fechada passa a: Manhã 07:00–09:30, Tarde 12:00–13:30, Noturna 18:30–21:30 (igual à regra aplicada).
6. **Mesma correção de relógio** no seletor de janela (o item "Noturna — abre às 18:30" também está congelado no horário de abertura da tela).

## Detalhes técnicos

- `src/components/roleta/corretor/RoletaCorretorView.tsx`: trocar `getCurrentWindowInfo()` chamado no corpo do componente por estado com `setInterval` de 30s (mesmo para o bloco de minutos BRT do `<Select>`); ajustar textos das janelas; tratar `alocacaoAtiva.length === 0 && minhaAlocacao.length > 0`.
- `src/hooks/useFocoCorretores.ts` (`useMinhaAlocacao`): `staleTime: 0`, `refetchOnMount: "always"`, `refetchOnWindowFocus: true` e `refetchInterval` de 2 min enquanto a tela estiver aberta. Nada de mudança de regra de negócio.
- Sem migração de banco. RPC `credenciar_por_alocacao` permanece como está (é a validação real).

## Validação

Verificar no preview: abrir a Roleta como corretor, confirmar que a alocação carrega, simular relógio de janela e conferir que a tela troca sozinha; conferir o texto de horários. Pedir à Rafaela para reabrir e credenciar na noturna (ainda aberta até 21:30).
