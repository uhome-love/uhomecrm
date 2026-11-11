# Ficha do lead · data da visita e largura da coluna (só exibição)

Sem migration, sem mudar o que é gravado. Cores, emojis e destaques da linha do tempo não mudam.

## 1. Data da visita do Eraldo — o que descobri

Não é erro de fuso. Os registros do banco mostram duas ações diferentes:

- Hoje 17h29 a Adriana agendou a visita para **10/11 às 10h**. O texto gravado nessa hora foi "10/11/2026 · Imóvel: Avulso - ImovelWeb".
- Hoje 21h05 a data foi **alterada para 11/11 às 11h**. Isso ficou gravado como alteração de data, não como novo agendamento.

Então o "Para 10 nov" mostra corretamente o agendamento original. Na investigação anterior eu olhei só a visita como está agora (11/11 11h) e não vi a alteração. Corrijo aqui o que eu disse antes.

Mas a exibição tem dois problemas reais:
- O card "Visita agendada" está sem a hora. O texto gravado veio sem hora, mas o registro do agendamento tem 10h. Não consegui confirmar por que a hora ficou fora do texto (o código atual inclui a hora). Isso fica só como observação; a gravação não muda nesta rodada.
- Quem lê só "Para 10 nov" acha que a visita é dia 10.

Mudança na exibição:
- Quando o texto da visita não tiver hora, completar com a hora do registro do agendamento da mesma visita, lida no horário de Brasília: "Para 10 nov, 10:00 · Avulso - ImovelWeb".
- A alteração de data aparece como "Visita remarcada · 10 nov, 10:00 → 11 nov, 11:00" (mesma cor/emoji já aprovados para alteração de data), para ficar claro que a visita vale para 11/11.
- Se a visita foi remarcada depois, o card do agendamento ganha um selo cinza discreto: "remarcada".

### Outras datas conferidas (sem erro de fuso)
- Linha do tempo, eventos da visita (agendada/alterada): já usam horário de Brasília.
- Linha do tempo, texto "dd/mm/aaaa" vindo do registro: só lido como texto, sem conversão — seguro.
- Card Próximo passo: data da visita é montada ao meio-dia (não vira o dia anterior); datas de tarefa usam horário de Brasília — seguro.
- Resumo ("Entrou", visitas): datas só com dia são lidas ao meio-dia de Brasília — seguro.
- Achado fora da ficha (não vou mexer): a busca global mostra a data da visita lida como UTC e pode mostrar o dia anterior. Fica anotado para outra rodada.

## 2. Coluna da esquerda sem quebras

- Coluna da esquerda com largura mínima de 320 px (máximo continua 440 px); a direita usa o resto.
- Duas colunas só quando a ficha comporta 320 px à esquerda + a área da direita. Abaixo disso (telas menores que ~1100 px, ex.: tablet), a ficha usa o layout empilhado do celular. Em 1280 px e 1440 px continua em duas colunas.
- Sem quebra de linha: rótulo "PRÓXIMO PASSO", selo de saúde ("Parado há 18 dias"), data da tarefa e "Sugestão do Homi".
- Resumo: o rótulo nunca quebra; o valor pode quebrar ("Não informado · Preencher" fica junto sempre que couber).

## 3. Campo de registro

Quando os chips ocupam a linha toda e o "Registrar" desce, ele fica alinhado à direita.

## Testes
- Eraldo: "Para 10 nov, 10:00" + "Visita remarcada · 10 nov, 10:00 → 11 nov, 11:00"; card Próximo passo mostrando a visita de 11/11 às 11h.
- Leonardo: Próximo passo sem quebras.
- 1280 px e 1440 px, claro e escuro, e celular 390 px. Nada é salvo.

## Detalhes técnicos
- Causa confirmada em `visita_eventos` do Eraldo: `criada` data_nova 2026-11-10 13:00 UTC (10:00 BRT) às 20:29 UTC; `data_alterada` 10/11 13:00 → 11/11 14:00 UTC às 00:05 UTC. Atividade gravada por `logVisitaEvento` com descrição sem hora.
- `LeadHistoricoTab.tsx`: casar a atividade "Visita agendada" com o evento `criada` (mesmo lead, diferença ≤ 1 min) para completar `pv.hora` via `Intl` America/Sao_Paulo; título do `data_alterada` vira "Visita remarcada" com formato curto "dd mmm, HH:mm".
- `DrawerLeadInfo.tsx` (aside): `min-w-[320px]` e troca do ponto de duas colunas de `md` para `min-[1100px]`; `PipelineLeadDetail.tsx` passa a usar o layout de abas/empilhado abaixo desse ponto (só exibição, mesmas ações).
- `DrawerAgora.tsx`, `HomiSugestaoRecolhida.tsx`: `whitespace-nowrap` nos rótulos/selo/data. `ResumoLeadLateral.tsx`: rótulo `shrink-0 whitespace-nowrap`, valor `min-w-0 break-words`. `RegistroRapido.tsx`: botão com `ml-auto`.
