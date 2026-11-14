# Auditoria das visitas — semana (09–15/11) e hoje (14/11)

## 1. Contadores do Painel CEO: corretos
| | Semana | Hoje |
|---|---|---|
| Total | 128 | 52 |
| A realizar | 9 | 3 |
| Realizadas | 60 | 22 |
| No show | 59 | 27 |
| Novos agendamentos | 117 | 16 |

- Total confere (a realizar + realizadas + no show). Nenhuma duplicidade, nenhuma cancelada contada, nenhuma "realizada" no futuro.
- Mesmo telefone com nomes diferentes na semana: nenhum caso.
- Roleta conta 58 na semana (2 clientes visitaram 2 vezes); painel conta 60 visitas. As duas regras estão certas.
- "Novos agendamentos" = marcadas no período (mesmo para o próprio dia); por isso muitas já aparecem realizadas.

## 2. Visitas de hoje: busca por visitas falsas
Conferi as 52 visitas uma a uma: lead existe, tem telefone, tem histórico de contato, horário de criação x horário da visita, relato do resultado.

**Nenhum sinal claro de fraude.** Todas têm lead real, telefone e resultado registrado. Mas 4 das 22 realizadas foram **lançadas depois do horário da visita** e merecem conferência do gerente:

| Corretor | Cliente | Visita | Lançada | Observação |
|---|---|---|---|---|
| Matheus Pasin | Aida Ana Fabrin | 18:20 | 20:02 (realizada 1 min depois) | lead do Facebook de 11/10 |
| Rafaela Campos | Gabriel Marques | 14:01 | 17:53 (realizada no mesmo minuto) | lead do Instagram de 02/11 |
| Pedro Jorge | Laisa (network Pedro) | 09:00 | 11:05 (realizada 1 min depois) | lead criado pelo corretor ontem, DDD 63 |
| Eduardo Santos | Andreia de Fraga | 15:30 | lead e visita criados hoje 13:47 | lead manual, só 2 contatos |

Pode ser só esquecimento de marcar antes, mas são exatamente o padrão de uma visita "inventada" para contar na Roleta.

Outros pontos: 27 no show hoje (alto). Billy John tem 2 visitas das 10h criadas à tarde, ainda sem resultado.

## 3. Proposta (só após aprovação, com mockup antes)
- **A. Selo "Lançada depois"** na visita realizada que foi criada depois do horário marcado, visível para gerente/CEO na Agenda de Visitas e na ficha. Não bloqueia nada e continua contando.
- **B. Relatório semanal** para o CEO com essas visitas por corretor (quantas lançadas depois, quantas com lead criado no mesmo dia).
- **C. Texto mais claro** em "Novos agendamentos" ("Marcadas no período", com quantas são futuras).
- **D. Proteção:** contador passar a ler a versão sem duplicados (mesmo número hoje).

## Técnico
- Fonte do painel: RPC `get_visitas_kpis` (tabela `visitas`, exclui cancelada/backfill/tipo≠lead). D = trocar por `visitas_unicas`, mesma assinatura e escopo.
- A/B: regra derivada `created_at(BRT) > data_visita+hora_visita` ou `lead.created_at::date = data_visita`; só apresentação + um campo no retorno, sem mexer em contagem nem na Roleta.
