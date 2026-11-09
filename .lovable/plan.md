# Oferta Ativa — melhorias sugeridas (revisão completa)

Revisei a tela, o fluxo de ligação e o código. A base está boa (arquivos pequenos, uma só fila para as 3 origens, trava contra duplicidade no servidor). Abaixo, o que eu melhoraria, em ordem de importância. Nada será feito sem sua aprovação; cada fase passa por mockup (quando visual) e teste no computador e no celular.

## Fase A — Bugs e riscos (prioridade)

1. **Gravação repetida após falha de internet**: se a internet cair no meio do "gravar", o corretor tenta de novo e a ligação pode contar 2 vezes. Corrigir para que a mesma ligação nunca conte duas vezes.
2. **"Sair" libera o cliente direto pela tela**, sem passar pela regra do servidor. Trocar pela regra oficial (igual ao "Pular").
3. **Anotação no Pipeline pode cair no cliente errado**: hoje procura pelos 8 últimos dígitos do telefone; dois clientes parecidos podem se confundir. Usar a mesma busca exata do aproveitamento.
4. **Pular sem aviso de erro**: se falhar, nada aparece. Mostrar aviso e não perder o cliente.
5. **Estagnado/Descartado pulado pode voltar na hora** para o mesmo corretor. Fazer ele não voltar por 30 min (igual às Listas).
6. **Aproveitou, mas a visita não salvou**: hoje só avisa. Oferecer botão "Tentar marcar de novo" na hora, sem perder o cliente.
7. **Resumo da sessão some se a página recarregar**: guardar a sessão do dia no aparelho.

## Fase B — Experiência do corretor

1. **Botão "Desfazer" por 5 segundos** depois de registrar (clicou errado "Não atendeu"? volta).
2. **Melhor hora para ligar**: mostrar no cliente "atendeu antes às 18h" quando houver histórico.
3. **Contagem regressiva da reserva** discreta ("cliente reservado para você por 4 min").
4. **Atalhos visíveis no computador** (1–5 e P) num pequeno guia "?".
5. **Meta do dia no topo da tela de ligação** com barra de progresso 30/3/1 e comemoração ao bater cada meta.

## Fase C — Visual e motivação

1. **Comemoração maior** ao aproveitar/marcar visita (confete curto, respeitando quem desliga animações).
2. **Sequência ("streak")**: "5 dias seguidos batendo a meta 🔥".
3. **Ranking com destaque da sua posição** e "faltam X ligações para passar fulano".
4. **Tela vazia mais útil**: sugerir a próxima fila com mais clientes disponíveis.
5. Revisão fina de cores/espaços no celular (botões fixos, abas, roteiro).

## Fase D — Organização e código

1. Testes automáticos das regras principais (contagem de ligação, pular, sair, visita).
2. Separar a parte de "gravar resultado" em pedaços menores e com tipos claros (sem `eslint-disable`).
3. Nome do corretor no roteiro vindo do perfil oficial (hoje pode vir vazio).

## Detalhes técnicos

- A1: idempotency key estável por (corretor, lead, tentativa local) gerada uma vez por cliente, em vez de `Date.now()`.
- A2: substituir `update` em `oferta_ativa_leads` por RPC `release_oa_lock` (ou `skip_oa_lead` com 0 min) validando dono da reserva.
- A3: `anotarNoPipeline` passa a usar `_oa_cliente_pipeline` via RPC servidor (telefone normalizado completo).
- A5: `bolsao_registrar('liberar')` grava pulo com cooldown 30 min por corretor.
- A7: `sessionStorage` com chave por dia BRT.
- D2: dividir `useFilaOA.registrar` em `registrarLista`/`registrarBolsao`.

## Sugestão

Começar pela **Fase A** (sem mudança visual, só segurança e correções), testar ponta a ponta com clientes fictícios e apagar depois. Em seguida mockup das Fases B e C para você escolher o que entra.
