# Diagnóstico atual
O problema mais provável não está nas tarefas da Andressa Madril nem nos dados do backend.

Os sinais apontam para **estado local corrompido no navegador dela**:
- no app instalado funciona;
- no navegador do computador dela não funciona;
- no seu computador, abrindo a conta dela, funciona;
- o código atual mantém parte da UI com dados persistidos, então o pipeline pode continuar visível enquanto consultas novas de tarefas/imóveis falham ou voltam vazias;
- já existem sinais anteriores de sessão inválida/JWT quebrado em navegador, compatíveis com esse “limbo”.

# Plano
## 1. Blindar a autenticação contra sessão inválida
Atualizar o fluxo de autenticação para que, quando o navegador entrar em estado inválido (JWT ruim, `403`, `missing sub`, `bad_jwt`), o app:
- não permaneça “logado de aparência”;
- limpe a sessão local de forma controlada;
- redirecione para login com mensagem clara.

## 2. Expor o estado de identidade quebrada para a UI
Ajustar o hook central de usuário para marcar explicitamente quando há sessão/local state inconsistente, evitando telas vazias sem explicação.

## 3. Mostrar recuperação orientada na interface
Adicionar aviso curto no app com ação direta para recuperação:
- refazer login;
- limpar estado local do dispositivo;
- usar o fluxo de recuperação já existente.

## 4. Validar os pontos afetados
Testar especificamente os fluxos que hoje ficam “meio carregados”:
- Central de tarefas;
- Pipeline de leads;
- página de imóveis.

O objetivo é garantir que, com sessão quebrada, o usuário veja um erro orientado/relogin — e não listas zeradas ou pipeline desatualizado.

# Detalhes técnicos
- **Arquivos mais prováveis:** `src/hooks/useAuth.tsx`, `src/hooks/useAuthUser.ts`, `src/components/system/BackendHealthBanner.tsx`
- **Comportamento atual identificado:** `useAuth` tenta recuperar sessão de forma graciosa e pode manter estado anterior; `usePipeline` usa persistência/cache; `MinhasTarefas` e os blocos de tarefas dependem de consultas novas a `pipeline_tarefas`
- **Sem necessidade de migration** ou mudança de regra de acesso neste passo
- **Sem alterar dados** da Andressa

# Resultado esperado
Depois dessa proteção:
- o caso dela deixa de ficar invisível/silencioso;
- o navegador problemático passa a pedir relogin/recuperação corretamente;
- tarefas, imóveis e status do pipeline voltam a aparecer após a sessão ser refeita.