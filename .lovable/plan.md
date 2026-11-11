# Ficha do lead · acabamento final (só visual)

Sem migration e sem mudar o que é gravado. Cores, emojis e layout aprovados continuam.

## 1. Contagem de dias
- "Venceu há N dias" / "Vence em N dias" passa a contar dias de calendário no horário de Brasília (hoje menos a data da tarefa), sem arredondar. Leonardo: tarefa de 25/10 passa a mostrar "Venceu há 16 dias". Hoje = "Venceu hoje"; amanhã = "Vence amanhã".
- O selo "Parado há N dias" passa a usar a mesma conta de calendário. Atenção: o selo mede outra coisa (dias desde o último contato, não o vencimento da tarefa). No Leonardo o último contato foi antes do vencimento, então os números continuam diferentes (selo maior que a tarefa). Os dois ficam corretos e calculados do mesmo jeito.

## 2. Homi recolhido
"Ver" e a seta ficam juntos na ponta direita, com espaço garantido depois de "Sugestão do Homi" (o texto não encosta no "Ver" em telas estreitas).

## 3. Dinheiro sem quebra
Espaço não quebrável em todos os valores curtos da ficha ("R$ 1,1 mi", "R$ 599 mil"): card Situação, card Negócio e linha do tempo.

## 4. Resultado da visita com cor pelo sentido
- Verde com check: quer proposta, quer visitar de novo, gostou, continuar visitando.
- Cinza sem check: vai pensar, aguardando retorno, e qualquer resultado não reconhecido.
- Vermelho suave sem check: não gostou, sem interesse.
O texto e o emoji do resultado continuam como estão.

## 5. Botão principal em etapas de negócio
Em Documentação, Proposta e Contrato: "Agendar visita" vira botão de contorno (topo do computador e barra do celular), e "Atualizar contrato/proposta/documentação" no card Negócio fica como o único botão azul. Nas etapas de lead, nada muda.

## 6. Resumo → Interesse
O que encontrei: no Leandro, o negócio também está gravado como "Avulso" (empreendimento, unidade e produto oficial = "Avulso"). "Casa Tua Porto Alegre" não existe no negócio dele; o que existe são visitas em "Casa Tua". Então trocar pelo negócio não muda nada no caso dele.
Proposta:
- Usar o empreendimento do negócio quando houver um específico (não "Avulso"); senão o do lead.
- Se os dois forem "Avulso", mostrar o imóvel da última visita ("Casa Tua"), com o texto "Avulso · última visita: Casa Tua".
- Sempre com a primeira letra maiúscula ("avulso" → "Avulso").
Se preferir só a letra maiúscula sem usar a visita, me avise ao aprovar.

## 7. Visita remarcada
Sem o selo cinza "visita" e autor só com o primeiro nome ("Adriana"), igual aos outros itens.

## 8. Abas no celular
As abas rolam para o lado, com um esmaecido na borda direita enquanto houver aba escondida (some ao chegar no fim). "Negócio" não aparece cortado de repente.

## Testes
- Leonardo: tarefa "Venceu há 16 dias"; selo contado por calendário; "Ver" à direita.
- Eraldo: "R$ 1,1 mi" inteiro; remarcada sem selo e com "Adriana".
- Leandro: "Vai pensar" em cinza; só "Atualizar contrato" em azul; Interesse conforme item 6.
- 1280 px, escuro e celular 390 px. Nada é salvo.

## Detalhes técnicos
- `DrawerAgora.tsx`: helper `diasCalendarioBRT(dataISO)` (diferença entre datas YYYY-MM-DD em America/Sao_Paulo) no lugar de `formatDistance`; o selo usa o mesmo helper sobre a data-base do relógio de saúde (`PipelineLeadDetail.tsx`, só exibição; `diasSemToque` e regras de saúde não mudam).
- `HomiSugestaoRecolhida.tsx`: `gap-3` e grupo "Ver"+seta com `ml-auto`.
- `valorCurto` usado com `\u00a0` via pequeno wrapper de exibição na ficha (teste existente não muda).
- `LeadHistoricoTab.tsx`: mapa de tom por resultado (positivo/neutro/negativo) nos chips; `data_alterada` sem badge e `autor` via `firstName`.
- `PipelineLeadDetail.tsx`: variante `outline` do Agendar visita quando a etapa é documentacao/proposta/contrato_gerado (topo e barra); `LeadFlagControls` mantém o botão azul.
- `ResumoLeadLateral.tsx`: recebe empreendimento do negócio e imóvel da última visita (dados já carregados na ficha); capitaliza a primeira letra.
- Abas mobile: `overflow-x-auto` já existe; adicionar máscara de gradiente controlada por scroll.
