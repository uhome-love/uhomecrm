# Thalia de Oliveira bloqueada na roleta, mas não aparece na aba "Bloqueados"

## O que está acontecendo (confirmado no banco)

- A Thalia de Oliveira **está bloqueada de verdade**: 102 descartes no mês contra um teto de 100.
  A mensagem que ela vê é "Teto de descartes do mês atingido — a roleta fica suspensa até o gestor liberar".
- Ela não aparece na sua aba "Bloqueados" por causa de dois defeitos no painel do CEO:

1. **Corte de 1.000 registros.** O painel busca um por um todos os leads descartados do mês e conta no navegador.
   Este mês já são **1.275 descartes**, e o backend devolve no máximo 1.000 linhas. Os descartes que ficam de fora
   simplesmente não são contados, então quem está pouco acima do teto (como a Thalia, 102 de 100) some da lista.
2. **Teto errado quando a configuração não é lida.** O painel assume 50 como valor de reserva enquanto a regra real é 100,
   o que pode listar gente que não está bloqueada e confundir a leitura.

Também existe uma diferença de identificador: a regra oficial considera os dois identificadores do corretor
(login e perfil), enquanto o painel considera só um — mais uma fonte de divergência entre o que o corretor vê e o que o CEO vê.

Resultado: o corretor e o gestor olham para contas diferentes. A regra que bloqueia (no servidor) está correta; a tela é que erra.

## O que vou fazer

1. Criar uma função no servidor que devolve a lista oficial de bloqueados por descarte no mês:
   nome, avatar, quantidade de descartes, teto vigente e se já houve desbloqueio manual — usando exatamente
   a mesma contagem que bloqueia o corretor (mesmos identificadores, mesmo tipo de etapa, mesmo teto da configuração).
   Acesso restrito a admin e gestor.
2. Refatorar a aba "Bloqueados" para consumir essa função, eliminando a contagem no navegador e o corte de 1.000 linhas.
3. Manter os botões "Desbloquear" e "Reverter" como estão hoje.
4. Mostrar estado vazio explícito ("Nenhum corretor bloqueado este mês") em vez de a aba ficar em branco, como está agora.
5. Validar ao vivo no preview: abrir /roleta → Operação → Bloqueados e confirmar que a Thalia aparece com 102 descartes,
   junto com os demais que estão acima do teto, sem desbloquear ninguém sem sua ordem.

## Detalhes técnicos

- Nova função `public.roleta_bloqueados_descarte()` (SECURITY DEFINER, STABLE), agregando `pipeline_leads`
  por `corretor_id` com `pipeline_stages.tipo = 'descarte'` e `stage_changed_at` dentro do mês corrente,
  resolvendo identificadores via `resolve_corretor_scope_ids` e cruzando com `roleta_desbloqueios` do mês.
  Teto lido de `roleta_config.limite_descartes_mes` (fallback 100).
- `src/components/roleta/CorretoresBloqueadosPanel.tsx`: troca as três consultas em cadeia por um único `supabase.rpc`,
  remove o `stage_id` fixo e o fallback 50, e adiciona o estado vazio.
- Sem mudança nas regras de bloqueio/desbloqueio: só a leitura do painel passa a bater com o servidor.

## Ação imediata possível

Se quiser liberar a Thalia hoje mesmo, é o botão "Desbloquear" (registro em `roleta_desbloqueios` do mês corrente) —
posso fazer isso depois que o painel voltar a listá-la, ou antes, se preferir.
