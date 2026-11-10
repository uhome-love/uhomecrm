# Ficha do lead · topo no celular (só visual)

Somente celular (até 767 px). Computador não muda. Sem mudança de dado nem regra.

## Como fica o topo (5 linhas)
1. Avatar 40 px + nome + X de fechar.
2. Pills etapa · prazo · temperatura na mesma linha; se apertar, o espaço entre elas diminui antes de quebrar.
3. Último movimento ("Voltou para Aquecimento · 01 nov").
4. Telefone (copiar, editar) + "DDD 44 · PR".
5. E-mail (copiar) + responsável (ícone + nome). O e-mail é cortado com "…"; o nome do responsável nunca.

Da linha 2 em diante, tudo começa na borda esquerda, alinhado ao avatar (sem recuo sob o nome).
Ícones de copiar/editar continuam pequenos, mas cada um ganha área de toque de 40 × 40 px.

## Barra fixa de baixo
Hoje ela tem: Ligar, WhatsApp, Anotar e "Registrar" (principal). Não tem Agendar visita.
Proposta: Ligar, WhatsApp e **Agendar visita como botão principal**, abrindo o mesmo formulário de visita do computador.
Anotar e Registrar continuam acessíveis: Anotar pelo "Mais ações" e Registrar pelo quadro "Próximo passo" (que já tem o botão) e pela aba Histórico.

## Teste
390 px e 360 px, tema claro e escuro, Leonardo Prado e um lead de nome e e-mail longos. Só olhar; abrir o formulário de visita e Cancelar.

## Detalhes técnicos
- `DrawerTopo.tsx`: no mobile, avatar e nome numa linha própria; demais blocos saem do container do nome (fora do recuo) via layout separado `md:` mantendo o desktop idêntico. Pills `flex-nowrap gap-1 min-[380px]:gap-1.5`; `metaExtra` em linha própria; contato dividido em duas linhas (telefone+DDD / e-mail `truncate min-w-0 flex-1` + responsável `shrink-0`). Botões de ícone com `h-10 w-10 -m-3` (toque 40 px sem alterar o visual).
- `PipelineLeadDetail.tsx`: barra fixa mobile troca Anotar/Registrar por "Agendar visita" (`setScheduleVisitOpen(true)`), confirmando que Anotar segue no "Mais ações" mobile e Registrar no DrawerAgora em mobile.
