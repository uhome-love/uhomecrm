# Adriana Kaiser não consegue se credenciar na roleta e não aparece em "Bloqueados"

## O que está confirmado no banco

- A Adriana Kaiser **está bloqueada de verdade**: 101 descartes no mês contra o teto de 100
  (configuração `limite_descartes_mes` = 100). O motivo que o servidor devolve para ela é
  "Teto de descartes do mês atingido — a roleta fica suspensa até o gestor liberar", nas três janelas
  (manhã, tarde e noturna). Não há desbloqueio manual registrado neste mês.
- Ela não está sozinha: reproduzindo exatamente a mesma contagem, hoje há **3 corretores acima do teto** —
  Thalia de Oliveira (102), Douglas Costa (101) e Adriana Kaiser (101). O Marcos Aurelio aparece logo abaixo, com 89.
- A função oficial do painel (`roleta_bloqueados_descarte`) existe, está com as permissões corretas
  e, pela lógica dela, devolveria esses 3 nomes. Ou seja: **o backend está certo; quem erra é a tela**.

## Por que a aba aparece vazia (a confirmar como primeiro passo)

Duas causas possíveis, e a correção cobre as duas:

1. **A correção do painel não está publicada.** A aba "Bloqueados" foi reescrita para usar a função do servidor,
   mas se o ambiente que você está olhando ainda roda a versão anterior, ele continua contando no navegador
   com corte de 1.000 registros — e some justamente com quem está pouco acima do teto (101 de 100).
2. **Erro silencioso engolido pela tela.** Hoje, se a chamada ao servidor falhar (por exemplo por permissão),
   a aba mostra "Nenhum corretor bloqueado este mês" em vez de avisar que deu erro. Um bloqueio real fica
   indistinguível de uma falha técnica.

## O que vou fazer

1. Confirmar ao vivo, no ambiente que você usa, se a aba está chamando a função nova ou a contagem antiga.
2. Fazer a aba distinguir três estados: carregando, **erro** (com o motivo e um botão "Tentar de novo") e
   vazio de verdade. Nunca mais mostrar "ninguém bloqueado" quando a consulta falhou.
3. Publicar a versão corrigida, para que a aba "Bloqueados" liste Thalia, Douglas e Adriana com a contagem real.
4. Validar ao vivo em /roleta → Operação → Bloqueados, sem desbloquear ninguém sem sua ordem.

## Detalhes técnicos

- `src/components/roleta/CorretoresBloqueadosPanel.tsx`: expor `isError`/`error` do `useQuery` da RPC
  `roleta_bloqueados_descarte`, renderizar bloco de erro com `refetch()`, e manter o estado vazio só quando
  a chamada retorna com sucesso e sem linhas.
- Sem migration: `roleta_bloqueados_descarte` (SECURITY DEFINER, gate admin/gestor/diretor) já está correta,
  usa `pipeline_stages.tipo = 'descarte'`, mês corrente por `stage_changed_at`, resolve `corretor_id` tanto por
  `profiles.user_id` quanto por `profiles.id`, e lê o teto de `roleta_config`.
- Nenhuma mudança na regra de bloqueio/desbloqueio nem em `roleta_motivo_bloqueio` / `get_elegibilidade_roleta`.

## Decisão sua

O bloqueio da Adriana é legítimo (101/100). Se quiser liberá-la para a roleta ainda hoje, é o botão
"Desbloquear" na aba (grava em `roleta_desbloqueios` do mês) — faço assim que a lista voltar a aparecer,
só com a sua ordem.
