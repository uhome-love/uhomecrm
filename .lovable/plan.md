# Bolsão de Leads Estagnados: estrutura da ideia (antes do mockup)

## Situação hoje (verificado nos dados)
- 1.217 leads marcados como estagnados estão acumulados.
- 1.089 deles nunca tiveram visita nem negócio, ou seja, poderiam entrar no Bolsão.
- 985 desses já estão estagnados há mais de 7 dias e entrariam no Bolsão no primeiro dia.

## Ciclo de vida do lead
```text
Corretor não dá sequência -> ESTAGNADO
   |
   v
Dias 0 a 7: POSSE DO GERENTE (página Leads Estagnados)
   gerente pode Devolver / Repassar / Fila CEO / Descartar
   |
   v (7 dias sem decisão, automático)
BOLSÃO (gerente deixa de ver)
   qualquer corretor pode pegar
   |
   v
Corretor aproveita -> vai para o pipeline dele em "Novo Lead"
```

Regra de entrada: só leads estagnados que **nunca tiveram visita registrada nem negócio criado**. Quem já teve visita ou negócio fica fora para sempre e continua com o gerente.

## Onde fica: entrada da Oferta Ativa com 3 portas
Ao abrir a Oferta Ativa, o corretor escolhe de onde quer ligar:

```text
+----------------------+----------------------+----------------------+
| Estagnados recentes  | Descartados recentes | Listas de leads      |
| ~985 hoje            | ~2.074 (últimos 60d) | (campanhas atuais)   |
+----------------------+----------------------+----------------------+
        |
        v
Escolhe: [um ou mais empreendimentos]  ou  [Aleatório - qualquer produto]
        |
        v
Tela de ligação de sempre (um cliente por vez)
```

- **Estagnados recentes**: leads que passaram os 7 dias com o gerente sem decisão.
- **Descartados recentes**: leads descartados como reengajáveis (descarte definitivo fica fora).
- **Listas de leads**: as campanhas da Oferta Ativa como já funcionam hoje.
- Estagnados e descartados são **listas vivas**: cada lead que estagna (depois dos 7 dias) ou é descartado entra sozinho, sem ninguém criar lista. Quem é aproveitado sai na hora.
- Nas três portas vale a mesma regra: **nunca entra lead com visita registrada ou negócio criado**.
- Os descartados entram após um período de espera (ex.: 7 dias depois do descarte), para não ligar no dia seguinte a quem disse que não queria.

## Como o corretor usa: duas opções para escolher
**Opção A: um cliente por vez (recomendada)**
- Depois de escolher a porta e o empreendimento (ou Aleatório), vem 1 lead por vez, reservado só para ele por alguns minutos.
- Ele liga ou chama no WhatsApp e registra o resultado: Aproveitar (vai para o pipeline dele) / Não atendeu (volta para a lista e só pode ser puxado de novo depois de um tempo) / Sem interesse (descartar).
- Vantagem: ninguém escolhe só os "melhores", e é justo para todos.

**Opção B: pegar um pacote de X leads**
- O corretor reserva até X leads (ex.: 5) por dia e tem 48h para trabalhar.
- O que não trabalhar volta para o Bolsão.
- Risco: acumular leads parados de novo.

## O que o corretor novo vê (sem histórico anterior)
- Vê: nome, telefone, empreendimento de interesse, origem (Meta, Site...) e há quanto tempo o lead entrou.
- Não vê: o corretor anterior, anotações, atividades antigas, tarefas nem motivo de estagnação.
- Mensagem na tela: "Cliente que não teve sequência. Ele é seu se você aproveitar."
- Depois de aproveitar, o lead começa com histórico limpo para ele. O histórico antigo continua guardado e só gestão e diretoria veem.

## Limites para evitar abuso (a definir)
- Máximo de aproveitamentos por dia por corretor.
- Lead aproveitado e de novo estagnado volta direto para o Bolsão? Ou para o gerente?
- Dar pontos no placar pelo aproveitamento do Bolsão?

## O que não muda
Roleta, Fila CEO (Lake Baikal continua fora), cadência Sem Contato, regras de VGV e de descarte.

## Próximos passos (seguindo o padrão Uhome)
1. Você escolhe Opção A ou B e responde os limites.
2. Eu faço o **mockup** da aba Bolsão e da mudança na página Leads Estagnados (contador "vai para o Bolsão em X dias").
3. Plano técnico detalhado para validar, depois construção em fases:
   - Fase 1: prazo de 7 dias do gerente e saída automática para o Bolsão.
   - Fase 2: aba Bolsão com puxar/aproveitar.
   - Fase 3: ocultar o histórico para o novo dono.

## Detalhes técnicos (resumo)
- Bolsão = leads com `estagnado = true`, `estagnado_em` há mais de 7 dias, `negocio_id` vazio e sem nenhuma visita; filtrado no servidor (página de estagnados do gerente passa a excluí-los).
- Puxar/aproveitar por funções no servidor com trava por lead (mesmo padrão da Oferta Ativa), reaproveitando o fluxo de reativação de lead.
- Ocultar histórico: marcar a data de "reaproveitado em" e esconder registros anteriores a ela para o corretor dono.

## Regras confirmadas por você
- Lead aproveitado que estagnar de novo: volta para o gerente, 7 dias, e depois de novo para o Bolsão.
- Bolsão **não** tem placar próprio. Se o corretor marcar visita com um lead do Bolsão, ela conta normalmente no placar de visitas do dia (o da TV).
- **Sem limite** de aproveitamentos por corretor.

## Telas afetadas e como ficam em sintonia
Regra-mãe: **um lead só pode estar em um lugar ativo por vez.** Quando um lead é aproveitado, sai de todos os outros na hora.

- **Pipeline de Leads (ativo)**: lead aproveitado entra no pipeline do corretor em "Novo Lead", com aceite já feito, usando o mesmo fluxo de reativação que a Oferta Ativa já usa (que já checa telefone duplicado com outro lead ativo). Se o telefone já estiver ativo com outro corretor, o lead não pode ser aproveitado.
- **Leads Estagnados (gerente)**: mostra só os 7 dias de posse, com contador "vai para o Bolsão em X dias". Depois disso o gerente não vê mais.
- **Oferta Ativa**: ganha as 3 portas na entrada. As listas/campanhas atuais continuam iguais. A limpeza automática da Oferta Ativa (que hoje tira da base fria quem existe no pipeline, inclusive descartados) segue valendo para as **listas**; Bolsão e Descartados são portas separadas, então não há conflito.
- **Central de Reengajamento (WhatsApp)**: hoje dispara para descartados reengajáveis. Para não ter corretor ligando e WhatsApp disparando para o mesmo lead ao mesmo tempo: lead reservado ou aproveitado no Bolsão fica fora do disparo; e lead que respondeu um disparo de reengajamento (vai para a Fila CEO) sai do Bolsão. Lead que está numa fila de disparo pendente não aparece no Bolsão até o disparo terminar.
- **Base Única de Leads**: só leitura do que acontece. O lead aproveitado aparece como "em atendimento no CRM", como já acontece com quem está no pipeline, e sai das próximas campanhas da Oferta Ativa.
- **Roleta e Fila CEO**: não mudam. Produtos obrigatórios da Fila CEO (Lake Baikal) **não entram** no Bolsão nem em Descartados recentes.
- **Placar da TV**: nada novo; a visita marcada já conta como qualquer outra.
- **Cadência Sem Contato / descarte automático em 24h**: continuam iguais; o que eles marcam como estagnado ou descartado é o que alimenta as portas.

## Pontos que vou conferir antes do plano técnico
Cada robô que hoje mexe em estagnados e descartados (cadência Sem Contato, descarte automático, varredura de descartados, disparo de reengajamento, entrada de leads novos do Meta/Site que reativa lead antigo) será revisado um por um para garantir que respeita a regra "um lugar ativo por vez".
