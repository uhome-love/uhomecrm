# Plano: Corrigir `/placar-tv` para funcionar sem login

## Problema confirmado
- A rota `/placar-tv` está pública, mas a busca pela sessão ativa em `PlacarTvPage.tsx` usa `supabase.from("oferta_ativa_sessoes")` — tabela que só permite `SELECT` para usuários autenticados.
- Quando a página é aberta sem login (ou com sessão ausente), o PostgREST devolve `[]` (200 OK) por causa do RLS, e a tela mostra **"Nenhum Mutirão ao vivo agora"** mesmo havendo uma sessão `ao_vivo` no banco.
- Reproduzido no preview: a query `oferta_ativa_sessoes?status=eq.ao_vivo&inicio_at=lte...&fim_at=gte...` retorna `[]` com o ambiente deslogado, enquanto o mesmo SQL direto no banco retorna a sessão ativa.

## Diagnóstico
A página pública precisa de dados públicos. O `/placar-do-dia` já usa esse padrão: uma função `SECURITY DEFINER` (`rpc_placar_do_dia`) com `GRANT EXECUTE TO anon`. O Mutirão TV precisa do mesmo padrão para sessão, ranking e feed.

## O que será construído

### 1. Backend — RPC pública `rpc_placar_mutirao`
- Nova função `public.rpc_placar_mutirao(p_sessao_id uuid DEFAULT NULL)`:
  - `SECURITY DEFINER`, `STABLE`, `search_path = public`.
  - Se `p_sessao_id` for nulo, descobre a sessão ativa (`status='ao_vivo'`, `inicio_at <= now()`, `fim_at >= now()`).
  - Retorna `jsonb` com: `sessao`, `corretores`, `equipes`, `feed`.
  - `corretores`: só `role='corretor'` (regra já aplicada no ranking; manter aqui), com nome, avatar, equipe, pontos, ligações, aproveitamentos, visitas.
  - `equipes`: agregação por equipe.
  - `feed`: últimas 12 ligações da sessão com `resultado IN ('visita_agendada','aproveitado')`, incluindo corretor, tipo, hora, cliente e empreendimento.
- `GRANT EXECUTE ON FUNCTION public.rpc_placar_mutirao TO anon, authenticated, service_role;`.
- Nenhum dado pessoal sensível (e-mails, telefones completos) será exposto; feed só exibe o que já aparece no placar TV.

### 2. Frontend — `PlacarTvPage.tsx`
- Substituir a query direta `supabase.from("oferta_ativa_sessoes")` por `supabase.rpc("rpc_placar_mutirao")`.
- Adicionar estados distintos:
  - **Carregando**: spinner fullscreen.
  - **Erro**: tela de erro vermelha com a mensagem (não confundir com "sem sessão").
  - **Sem sessão**: manter a mensagem atual "Nenhum Mutirão ao vivo agora" quando a RPC devolver `sessao=null`.
- Passar os dados (`sessao`, `corretores`, `equipes`, `feed`) para o componente `PlacarTv`.

### 3. Frontend — `PlacarTv.tsx`
- Adicionar props opcionais `initialData` para permitir uso com dados pré-carregados pela página pública.
- Quando `initialData` estiver presente, usar os dados da RPC e fazer polling a cada 15s (igual ao Placar do Dia).
- Quando `initialData` não estiver presente (uso autenticado dentro de `/oferta-ativa-ao-vivo?view=tv`), manter o comportamento atual com `useMutiraoRanking` e realtime.
- O feed continua sendo alimentado por novos eventos; no modo público, o polling atualiza o ranking/feed sem depender de realtime anon.

### 4. Cache / Service Worker
- Bumper a versão em `public/version.json` e no Service Worker (`public/sw.js`) para garantir que PCs/TVs que já abriram o CRM recebam o novo bundle e não fiquem presos na versão quebra.

### 5. Validação
- Teste automatizado com Playwright:
  - Abrir `/placar-tv` sem autenticação e confirmar que o placar do mutirão ativo aparece.
  - Abrir `/placar-tv` autenticado e confirmar que também funciona.
  - Verificar que não aparecem Lucas/CEO/admin no ranking (apenas corretores).
  - Verificar que a tela "Nenhum Mutirão" só aparece quando não há sessão ativa.

## Arquivos envolvidos
- `supabase/migrations/...` (novo migration)
- `src/pages/PlacarTvPage.tsx`
- `src/components/oferta-ativa-ao-vivo/PlacarTv.tsx`
- `public/version.json`
- `public/sw.js`

## Riscos / mitigações
- **Segurança**: a RPC é `SECURITY DEFINER`, então roda com poder do dono, mas só expõe dados agregados do mutirão. Nenhum e-mail/telefone completo de leads será retornado.
- **Performance**: a RPC roda a cada 15s no TV; é leve (SELECT indexado em sessão + participantes + ligações).
- **Cache antigo**: resolvido com bump de versão do SW + `?_recover=1` como fallback para TVs já abertas.

## Não incluído nesta fase
- Novos recursos visuais (som, atalhos, etc.). Foco apenas em fazer o placar carregar corretamente sem login.