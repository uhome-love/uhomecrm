## Status pós-deploy

O último deploy resolveu a maior parte do problema: o bundle publicado não usa mais `hunbxqzhvuemgntklyzb.supabase.co` para Auth/REST/Functions. No teste pós-login em `https://uhomesales.com/ceo` foram observadas 42 chamadas para `https://api.uhomesales.com`, incluindo `/auth/v1/token`, REST e Functions.

Restou uma chamada direta ao domínio antigo em Storage/avatar:
`https://hunbxqzhvuemgntklyzb.supabase.co/storage/v1/object/public/avatars/.../avatar.png`

## Objetivo desta etapa

Eliminar 100% do tráfego para `*.supabase.co` no navegador, deixar o boot de auth resiliente a sessões corrompidas e validar Realtime exclusivamente pelo domínio próprio.

## Escopo

### 1. Normalizar URLs públicas de Storage/avatar
- Todas as URLs `https://hunbxqzhvuemgntklyzb.supabase.co/storage/v1/object/public/...` devem ser servidas via `https://api.uhomesales.com/storage/v1/object/public/...`.
- Inclui:
  - geração de URLs novas (uploads, avatares, materiais, vitrines)
  - leitura de URLs antigas já gravadas no banco
  - qualquer template, tag `<img>`, OG image, link compartilhado
- Estratégia:
  - helper único `toPublicStorageUrl(path)` que devolve sempre o domínio próprio
  - sanitização em runtime quando o valor vier do banco com domínio antigo
  - migração de dados em tabelas que armazenam URL absoluta para reescrever o host

### 2. Endurecer o boot de autenticação
- Em qualquer um destes casos, limpar imediatamente a sessão local e devolver o usuário para a tela de login, sem loading infinito:
  - resposta `403 invalid claim: missing sub claim`
  - JWT em storage sem `sub`
  - falha em `refreshSession`
  - erro inesperado em `/auth/v1/user`
- Garantir que o `purgeCorruptedAuthStorage` seja chamado antes de qualquer redirect.
- Garantir que `loading` nunca fique travado em `true` quando ocorrer erro fatal de auth.
- Mostrar toast claro e oferecer “Corrigir acesso neste dispositivo”.

### 3. Validar Realtime
- Em tela que use WebSocket (ex.: WhatsApp Inbox), confirmar que a conexão é somente `wss://realtime.uhomesales.com/realtime/v1`.
- Nenhuma conexão WebSocket pode ir para `*.supabase.co`.

## Critério de aceite

No domínio publicado, com DevTools aberto:
- Nenhuma chamada para `*.supabase.co`
- Auth/REST/Functions/Storage passam por `api.uhomesales.com`
- Realtime passa por `realtime.uhomesales.com`

Cenários a validar nas duas redes (On Net e Claro), limpando sessão local antes do teste na Claro:
- login
- reload já logado
- WhatsApp Inbox com mensagens em tempo real
- upload de avatar e leitura de avatares antigos

## Detalhes técnicos

```text
Camada           Antes                                   Agora
Auth             *.supabase.co/auth/v1                   api.uhomesales.com/auth/v1
REST             *.supabase.co/rest/v1                   api.uhomesales.com/rest/v1
Functions        *.supabase.co/functions/v1              api.uhomesales.com/functions/v1
Storage (URLs)   *.supabase.co/storage/v1/object/...     api.uhomesales.com/storage/v1/object/...
Realtime         wss://*.supabase.co/realtime/v1         wss://realtime.uhomesales.com/realtime/v1
```

### Mudanças previstas no código
- `src/lib/storageUrl.ts` (novo): `toPublicStorageUrl(rawUrlOrPath: string): string`
- substituir todos os usos de `getPublicUrl` e URLs absolutas de avatar/storage para passar pelo helper
- componentes de avatar e qualquer `<img src=...>` que aceite URL do banco devem aplicar o helper
- `useAuth.tsx`:
  - tratar `missing sub claim` como erro fatal imediato
  - garantir `setLoading(false)` em todos os caminhos de erro
  - chamar `purgeCorruptedAuthStorage` antes de qualquer estado final sem usuário
- `customClient.ts`:
  - manter override de `realtime.endPoint` para o domínio próprio
  - confirmar que `storage.from(...).getPublicUrl(...)` devolve URL no domínio próprio

### Migração de dados
- varrer colunas que armazenam URL absoluta de Storage e reescrever host para `api.uhomesales.com`
- candidatas conhecidas: `profiles.avatar_url`, materiais, vitrines, qualquer coluna de mídia
- migração idempotente, segura para rodar mais de uma vez

### Validação automatizada de regressão
- adicionar verificação de runtime que loga em telemetria qualquer URL que ainda contenha `hunbxqzhvuemgntklyzb.supabase.co` ao montar avatar/imagem, para detectar pontos cegos remanescentes

### Rollback
- helper de URL é puro: rollback é trocar uma constante
- ajuste de auth é defensivo: rollback é remover a checagem fatal e voltar ao comportamento anterior
- migração de dados é compatível com o domínio antigo (Cloudflare resolve ambos), então é segura

Se aprovar, eu sigo com a implementação na ordem: helper de Storage e troca dos pontos de uso, hardening do boot de auth, migração de dados, e por último a verificação no WhatsApp Inbox + relatório final do Network nas duas redes.