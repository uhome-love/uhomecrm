# Limpeza da Minha rotina (tirar repetições)

## O que está repetido hoje
- CRM aparece 4 vezes: quadro "Meta Uhome 80%", regra "CRM 77,5%", quadro "Saúde do CRM" e a linha "Atualizar 9 clientes" em Meu foco.
- Visitas aparecem 2 vezes: regra "0 visitas na semana passada" e quadro "Visitas desta semana".
- Tarefas aparecem 2 vezes: "Tarefas de hoje" em Meu foco e a faixa "Tarefas" dentro de "Sua fila de hoje", na lateral.
- Roleta aparece em 3 faixas seguidas: barra verde (presente/ativo), quadro Meta Uhome e faixa de regras.

## Como fica (de cima para baixo)

```text
+------------------------------------------------------------+
| Saudação (igual)                                           |
+------------------------------------------------------------+
| ROLETA DO TURNO (um quadro só)                             |
| ● Ativo na Roleta · noturna · S2, S1          [engrenagem] |
| ✗ CRM 77,5% (mín 80)  ✗ 0 visitas sem. passada  ✓ Descartes |
| (botão só quando há ação: "Credenciar agora" ou            |
|  "Atualizar 9 clientes")                                   |
+--------------------------------------+---------------------+
| MINHA EVOLUÇÃO (3 quadros, iguais)   | SUA FILA DE HOJE    |
| Saúde CRM | Visitas semana | Situação| 3 clientes sugeridos|
+--------------------------------------+ (sem faixa Tarefas) |
| MEU FOCO DE HOJE                     | [Abrir Agenda]      |
| Tarefas de hoje 3 de 5  [Concluir]   +---------------------+
| 17 vencidas · 5 hoje · 8 sem passo   | ATALHOS             |
| Ver todas →                          | Oferta Ativa ...    |
+--------------------------------------+---------------------+
| Gráfico 4 semanas                                          |
+------------------------------------------------------------+
```

## Mudanças
1. **Roleta num quadro só:** a barra verde, o quadro "Meta Uhome" e as regras viram um único bloco. O texto longo da Meta sai; fica só o estado da Roleta, as 3 regras com ✓/✗ e um botão quando houver algo a fazer.
2. **Meu foco de hoje:** sai a linha "Atualizar 9 clientes" (já está no quadro Saúde do CRM, que passa a ser clicável e leva aos clientes parados). Ganha as etiquetas vencidas / hoje / sem passo.
3. **Lateral:** "Sua fila de hoje" perde a faixa "Tarefas" (fica só no Meu foco). Atalhos continuam.
4. Nada muda nas regras da Roleta, credenciamento, tarefas ou banco — só a arrumação da tela.

## Validação
- Ver no preview em computador e celular; conferir que nenhum número sumiu, só deixou de repetir.

## Detalhes técnicos
- `RoletaTurnoCard` absorve o conteúdo de `RoletaStatusBar` (status/segmentos/engrenagem/credenciar) e substitui `CrmMetaAviso` por um botão de ação curto; `CorretorDashboard` deixa de renderizar `RoletaStatusBar` separado.
- `MeuFocoHoje`: remove linha `a_atualizar`; adiciona as 3 etiquetas (usa `useSemProximoPasso`).
- `MinhaEvolucaoKpis`: quadro CRM vira link para `/pipeline-leads?filtro=atrasado`.
- `AgendaResumoWidget`: remove `<MinhasTarefasHojeCard />`; o arquivo fica sem uso e pode ser apagado.
