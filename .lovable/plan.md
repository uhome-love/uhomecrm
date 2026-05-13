# Plano de correção completa

## Problema principal
O erro de `failed to fetch` está **generalizado** e não é só login: ele combina **quebra de funções do banco**, **sessões presas em domínio/token antigo** e **cache/PWA servindo cliente defasado**. O efeito final é exatamente o que você descreveu: nada entra, nada carrega, tarefas/pipeline falham e parece que o CRM parou inteiro.

## O que será corrigido

### 1) Corrigir a raiz no banco
Há funções e rotinas referenciando colunas incompatíveis com o schema atual, o que está quebrando processos centrais:
- `pipeline_leads.aceite_at` não existe; a coluna real é `aceito_em`
- há referências inválidas a `oferta_ativa_leads.segmento_id`
- há erros recorrentes envolvendo `auth_user_id`
- há inserts em `pipeline_leads` sem `stage_id`, gerando falha de criação

**Ação:**
- localizar todas as funções/views/rotinas afetadas
- criar migration corrigindo os nomes de colunas e joins conforme o schema real
- ajustar o fluxo de criação de lead para nunca inserir `pipeline_leads` sem `stage_id`
- validar manualmente as RPCs críticas após a migration

### 2) Destravar o fetch generalizado no cliente
Hoje o frontend já tenta retry em falhas de rede no auth, mas ainda falta tratar o caso em que o navegador está preso com sessão/token inválido ou build antigo.

**Ação:**
- reforçar `useAuth.tsx` para detectar sessão inválida/JWT inválido e limpar sessão local de forma segura
- evitar loop infinito de carregamento quando `getSession()` ou `/user` falharem repetidamente
- cair para recuperação controlada: limpar sessão corrompida, redirecionar para login e permitir reentrada limpa

### 3) Forçar atualização real do PWA/cache
Existe service worker ativo e `version.json` ainda está em `v=2`. Se parte dos usuários ficou com build velho/cache velho, eles continuam batendo em cliente desatualizado e podem manter o erro indefinidamente.

**Ação:**
- subir `version.json` para forçar refresh global do app
- revisar `sw.js` para garantir atualização agressiva do shell quando houver nova versão
- revisar `main.tsx` para assegurar takeover imediato do novo service worker
- reduzir a chance de clientes continuarem presos no app antigo

### 4) Fechar a rota do domínio antigo / sessões antigas
Os logs mostram erro `missing sub claim` vindo do domínio antigo `uhomeia.lovable.app`, enquanto o domínio atual saudável é `uhomesales.com`.

**Ação:**
- tratar explicitamente sessão inválida originada de cliente velho
- garantir que o app não continue tentando operar com token legado
- se necessário, adicionar proteção para limpar estado local quando detectar ambiente/token incompatível

### 5) Validar ponta a ponta
Depois das correções, a validação será completa e focada no incidente:
- login funcionando novamente
- CRM abrindo sem tela travada
- tarefas carregando
- pipeline carregando
- sessão recuperando corretamente após refresh
- clientes com cache antigo sendo atualizados corretamente
- checagem de logs para confirmar que os erros críticos pararam

## Resultado esperado
Após isso, o CRM volta a:
- entrar normalmente para os corretores
- carregar tarefas e pipeline
- parar de exibir `failed to fetch` em massa
- se recuperar sozinho de cliente/cache/sessão corrompidos sem depender de limpar cache manualmente

## Detalhes técnicos
- **Banco:** migration para corrigir funções quebradas e inserts inválidos
- **Frontend:** endurecer `src/hooks/useAuth.tsx`
- **PWA:** atualizar `public/version.json`, revisar `public/sw.js` e `src/main.tsx`
- **Validação:** logs + teste real de login/carregamento

Se você aprovar, eu executo essa correção completa agora.