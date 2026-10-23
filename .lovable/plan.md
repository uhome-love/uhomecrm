# Visita em parceria conta 0,5 na Roleta

## O que foi encontrado
- O contador da Roleta (visitas realizadas na semana) conta só visitas onde o corretor é o dono. Parceria é ignorada: quem é parceiro ganha 0, o dono ganha 1 inteiro.
- Jocarli: 2 visitas realizadas (19/10 e 22/10) no nome da Larissa e já existe 1 parceria ativa no lead. Mesmo assim o contador não divide.
- Ao editar uma visita, o botão "Visita em parceria?" aparece desligado (não carrega a parceria existente) e ao salvar a edição a parceria não é gravada — só funciona ao criar visita nova. Por isso a Larissa "não consegue colocar".
- Hoje há 353 parcerias ativas; 9 visitas realizadas nas últimas 2 semanas estão em leads com parceria.

## Regra nova (confirmar)
- Visita realizada em lead com parceria ativa conta 0,5 para o dono e 0,5 para o parceiro.
- Sem parceria, continua 1 para o dono.
- Meta continua 2 (ex.: 1 visita própria + 2 em parceria = 2,0 libera).
- Vale para todas as janelas que usam o contador (semana anterior, semana atual, domingo). A regra "noite exige 1 visita marcada ou realizada hoje" passa a aceitar também visita em parceria onde ele é parceiro.

## Etapas
1. Mapeamento (só leitura): relatório com todas as visitas realizadas da semana passada e atual em leads com parceria, mostrando dono, parceiro, contagem atual e contagem nova por corretor; listar quem muda de situação (bloqueado → apto ou o contrário) e parcerias suspeitas (parceiro = dono, parceiro inativo, duplicadas). Apresento antes de gravar.
2. Formulário da visita: ao editar, mostrar parceria existente ligada com o parceiro; permitir ligar/trocar ao editar e gravar; impedir escolher o próprio corretor.
3. Contador da Roleta: passar a somar 0,5 por visita em parceria (dono e parceiro), mostrando "1,5 de 2" nos requisitos e na mensagem de bloqueio.
4. Validação ponta a ponta com lead de teste: criar visita com parceria, editar adicionando parceria, marcar realizada, conferir contador dos dois corretores na Roleta e no cartão do Início; depois apagar o teste. Conferir Jocarli/Larissa ao vivo.

## Detalhes técnicos
- `roleta_visitas_realizadas_periodo` passa a retornar numeric: soma por (lead, dia) com peso 0.5 quando houver `pipeline_parcerias` status `ativa` no lead e o corretor for principal ou parceiro; peso 1 caso contrário. Resolver ids auth/profile dos dois lados. Ajustar `roleta_apto_janela`, `roleta_motivo_bloqueio` (variáveis numeric, formato "1,5") e `roleta_tem_visita_hoje`. Uma migration (fora do horário se exceder o limite do dia).
- `VisitaForm.tsx`: carregar parceria ativa do lead no modo edição; inserir/atualizar parceria também no fluxo de edição.
- Front `useRoletaRequisitos`/`useRoletaPerformanceStatus`: exibir decimal.
- Teste unitário da regra de peso (1 sem parceria, 0,5 com parceria, meta 2).
