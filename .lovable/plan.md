# Fase 3 — Aba "Performance" nos painéis do CEO, da diretora e dos gerentes

## O que muda para você
Os três painéis (CEO, Diretora e Gerente) ganham duas abas no topo:

```text
[ Visão geral ]  [ Performance da Roleta ]
```

- **Visão geral**: o painel de hoje, sem mudança nenhuma.
- **Performance da Roleta**: a tela nova da Fase 3.

Cada pessoa vê só o que pode ver:
- **CEO e diretora**: todas as equipes, com filtro por equipe.
- **Gerente**: só a própria equipe.

## O que tem dentro da aba Performance
1. **Agora (ao vivo)**: quantos corretores estão aptos ou bloqueados para a Roleta. Para cada bloqueado aparece o motivo: CRM abaixo de 80%, menos de 2 visitas ou descartes.
2. **Saúde do CRM por equipe**: a porcentagem da equipe e as bolinhas verde, amarela e vermelha, com os mesmos números do Pipeline.
3. **Visitas da semana por equipe**: a semana passada e a semana atual, comparadas com a meta de 2 por corretor.
4. **Fechamento semanal**: o quadro da Fase 1 (Apto, Em evolução e Plano de retomada, com o 1:1 pendente), que sai da página Gestão e passa para esta aba.
5. **Relatório semanal em PDF**: botão "Baixar PDF" da semana escolhida. Toda segunda, depois do fechamento, chega no sino um aviso de que o relatório da semana está pronto.

## Ordem de trabalho
1. Desenho (mockup) da aba para você aprovar antes de qualquer código.
2. Construir a aba, com as mesmas regras e números da Minha Rotina e do fechamento semanal.
3. Testar com as visões de CEO, diretora e gerente, sem alterar nenhum lead.

## Fica de fora
- O envio do relatório por e-mail fica para depois, como combinado.
- Nenhuma regra da Roleta muda: a aba só mostra as informações.

## Detalhes técnicos
- Tabs (shadcn) em `CeoDashboard.tsx`, `DiretoraDashboard.tsx` e `GerenteCockpit.tsx`. O conteúdo atual vai para a aba "Visão geral", sem alterações.
- Componente novo compartilhado `src/components/performance/PerformanceRoletaTab.tsx`, dividido em subcomponentes com menos de 300 linhas cada. `CeoDashboard.tsx` (1152 linhas) só recebe o wrapper das abas.
- As fontes de dados são as que já existem: `roleta_apto_janela`/`roleta_motivo_bloqueio`, `crm_saude_corretor`, `roleta_visitas_realizadas_periodo` e `roleta_fechamento_semanal`. O escopo de cada pessoa vem de `team_members` e das RLS que já existem.
- O PDF é gerado no próprio navegador a partir da semana escolhida. O aviso no sino é criado por `roleta_fechar_semana` (via `criar_notificacao`) para o gestor e os admins.
- `FechamentoSemanalCard` sai de `GerenteCockpit` e passa para a nova aba.
