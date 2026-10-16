# Oferta Ativa — escolher empreendimentos dentro da lista

## Entendimento
O corretor escolhe a lista normalmente. Dentro dela, os leads às vezes são de empreendimentos diferentes. Ele poderá marcar só os empreendimentos que quer (um ou vários) e o sistema passa a entregar só leads desses empreendimentos, dentro daquela lista.

(Isso substitui o mockup anterior de "escolher empreendimento antes da lista".)

## Como fica a tela de ligação
```text
[ Lista: Base MCMV 2024 ]        Empreendimentos: [Todos] [Open Arvoredo 180] [Open Bosque 84] [Casa Tua 40]
```
- Pílulas no topo da tela de ligação, com a quantidade de leads disponíveis de cada empreendimento naquela lista.
- Só aparece quando a lista tem 2 ou mais empreendimentos.
- Pode marcar vários; "Todos" volta ao normal.
- Ao trocar, o lead atual é liberado (sem registrar tentativa) e vem o próximo do filtro.
- Se acabar os leads do filtro: aviso "Acabaram os leads de X nesta lista" com botão "Ver todos".
- Escolha lembrada por lista no aparelho do corretor.

## O que NÃO muda
- Regras de fila, trava de 5 min, cooldown, base fria e exclusividade com o Pipeline.
- Pontuação, registro de tentativa, Mutirão Ao Vivo, Lake Baikal / Fila CEO.

## Fases
1. Mockup da tela de ligação com as pílulas (aprovação).
2. Banco: a função que entrega o próximo lead ganha um filtro opcional de empreendimentos (vazio = comportamento atual).
3. Tela: pílulas + contagem + liberar lead ao trocar.
4. Validação no preview com conta de corretor, sem registrar tentativa em lead real.

## Detalhes técnicos
- `oferta_ativa_leads.empreendimento` já existe (texto por lead).
- `fetch_next_lead(p_corretor_id, p_lista_id, p_lock_minutes)` recebe `p_empreendimentos text[] DEFAULT NULL`. Para não criar duas versões da função (regra do projeto), a antiga é removida e recriada com o novo parâmetro na mesma migration — isso vai pedir sua confirmação. Chamadas atuais continuam funcionando.
- Contagem por empreendimento: RPC só leitura `oa_lista_empreendimentos(p_lista_id)` (disponíveis, mesma régua da fila).
- Frontend: `useOAServerQueue` passa o filtro; pílulas em `DialingModeWithScript.tsx` (modo lista); preferência em localStorage por lista.
- Migration fora do horário de pico se já houver 2 no dia.
