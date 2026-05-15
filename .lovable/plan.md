# Objetivo
Corrigir de forma definitiva o problema em que o CRM funciona em dados móveis e falha no Wi‑Fi, eliminando dependências frágeis de DNS/proxy no fluxo normal e deixando uma arquitetura única, validada e observável.

# Diagnóstico fechado
- O problema original é compatível com falha/intermitência de resolução do domínio próprio em alguns provedores Wi‑Fi, especialmente por cache negativo de DNS após NXDOMAIN. Isso é um comportamento padronizado de DNS (RFC 2308), então não é algo que o app consiga “forçar” a expirar no dispositivo do usuário.
- Hoje o app está misto:
  - Login, REST principal e Realtime já conseguem usar o host direto quando a flag está em `true`.
  - Mas ainda existem pontos relevantes hardcoded em `api.uhomesales.com`, inclusive telemetria de rede e reescrita de URLs públicas de storage.
- Também existe uma arquitetura de failover `api.uhomesales.com -> api-backup.uhomesales.com`, porém isso só é confiável se ambos os domínios próprios estiverem universalmente resolvendo em todos os provedores. Se o problema é DNS do domínio próprio, manter o caminho crítico dependendo dele continua frágil.
- Os testes lidos agora mostram:
  - `api.uhomesales.com` responde do ambiente atual.
  - `api-backup.uhomesales.com` responde do ambiente atual.
  - `realtime.uhomesales.com` e `realtime-backup.uhomesales.com` respondem.
  - O backend direto também está saudável.
- Os logs de auth mostram outro sintoma paralelo no preview (`/user 403 invalid claim: missing sub claim`), mas isso não explica o padrão “4G funciona / Wi‑Fi não”. O vetor mais forte para esse problema específico continua sendo a camada de nome/proxy.

# Solução proposta
## Fase 1 — Unificar o caminho crítico de autenticação e dados
Remover do fluxo crítico qualquer dependência de `api.uhomesales.com`/`realtime.uhomesales.com` enquanto estivermos estabilizando a operação.

Implementação:
- Definir uma única estratégia canônica para runtime:
  - REST/Auth/Revalidation: host direto do backend.
  - Realtime: host direto do backend.
  - Edge Functions: host direto do backend.
- Parar de usar domínio próprio em pontos acessórios que hoje ainda podem disparar falhas no Wi‑Fi:
  - `src/lib/networkTelemetry.ts`
  - `src/lib/storageUrl.ts`
  - qualquer helper/runtime que ainda reescreva para `api.uhomesales.com`
- Preservar a regra permanente já definida: não alterar as flags sem autorização explícita.

Resultado esperado:
- Zero request para `api.uhomesales.com` no uso normal do app.
- Login e carregamento de dados usando o mesmo caminho em Wi‑Fi e dados móveis.

## Fase 2 — Remover a ambiguidade arquitetural
Hoje coexistem duas estratégias conflitantes: bypass direto e proxy/failover próprio.

Implementação:
- Desligar logicamente o failover de domínio próprio no runtime enquanto o caminho oficial for direto.
- Manter apenas a observabilidade e retries de rede, sem reescrever request para hosts próprios.
- Ajustar comentários, constantes e nomes para refletir a arquitetura real, evitando futuras regressões “pela metade”.

Resultado esperado:
- Sem comportamento híbrido.
- Menor chance de alguém reintroduzir proxy próprio no meio do auth sem perceber.

## Fase 3 — Blindar assets e endpoints secundários
Mesmo com login ok, páginas podem falhar parcialmente se imagens/storage/telemetria continuarem dependendo do domínio que falha no Wi‑Fi.

Implementação:
- Fazer storage público seguir o mesmo host canônico do runtime.
- Fazer telemetria usar o mesmo host canônico.
- Revisar pontos hardcoded restantes do domínio próprio usados pelo app em produção.

Resultado esperado:
- App carrega dados e mídia com o mesmo padrão de conectividade.
- Menos “entra mas quebra depois”.

## Fase 4 — Validação objetiva
Depois da implementação, validar com checklist real de rede:
- Login por email/senha.
- Refresh de sessão.
- Busca de dados após login.
- Navegação entre telas principais.
- Assets/imagens vindos de storage.
- Realtime básico.
- Garantir que não existam requests para `api.uhomesales.com` no fluxo normal.

# Arquivos prováveis a ajustar
- `src/integrations/supabase/customClient.ts`
- `src/lib/edgeBaseUrl.ts`
- `src/lib/fetchCircuitBreaker.ts`
- `src/lib/proxyEndpoints.ts`
- `src/lib/networkTelemetry.ts`
- `src/lib/storageUrl.ts`
- possivelmente `src/pages/admin/TelemetriaRede.tsx` apenas para o diagnóstico administrativo continuar coerente

# Decisão arquitetural recomendada
A correção definitiva é: parar de depender do domínio próprio no runtime do CRM até que ele seja comprovadamente estável em todos os provedores alvo. DNS com cache negativo não se resolve do lado do app. Se queremos “sem falhas, sem temporário”, o fluxo crítico deve usar o endpoint que não depende dessa propagação.

# Riscos controlados
- O app pode continuar funcionando com o domínio próprio em alguns ambientes, mas isso não é o critério; o critério é eliminar o caso Wi‑Fi quebrado.
- Se o domínio próprio precisar voltar no futuro, isso deve ser feito em uma migração explícita, ponta a ponta, com validação por provedores reais e sem arquitetura híbrida.

# Entregável final
- Runtime unificado em host direto.
- Zero dependência do domínio próprio no fluxo normal.
- Sem bypass parcial.
- Sem failover inconsistente.
- Fluxo de login e dados consistente em Wi‑Fi e dados móveis.

# Detalhes técnicos
```text
Hoje:
Auth/REST/Reatime/Edge = parcialmente direto
Storage/telemetria/outros = ainda domínio próprio
Failover = ainda tenta domínio próprio/backup

Depois:
Tudo do runtime crítico = host direto único
Retries = mantidos
Observabilidade = mantida
Proxy próprio = fora do caminho crítico
```
