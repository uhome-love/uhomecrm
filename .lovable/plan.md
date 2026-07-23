### Correção: Placar TV — Ranking de Equipes vs Corretores

**Problema confirmado no código:**
O card da esquerda em `PlacarTv.tsx` está renderizando o **nome do primeiro corretor da equipe** como título principal (`lider?.nome`), o que cria a sensação de que o ranking da esquerda é repetido com o da direita. O subtítulo mostra "Equipe Bruno", mas o destaque visual fica no corretor.

**Objetivo:**
- **Esquerda:** ranking de equipes (título principal = nome da equipe, stats agregados da equipe, foto opcional do corretor líder como avatar secundário).
- **Direita:** ranking dos corretores (mantém como está).
- **Base:** "Últimas Conquistas" (mantém como está).

**Escopo da mudança:**
1. **Ajustar o card de equipe** em `src/components/oferta-ativa-ao-vivo/PlacarTv.tsx` (linhas ~350-400):
   - Título principal passa a ser `e.equipe` (nome da equipe) em caixa alta.
   - Subtítulo passa a mostrar a contagem de corretores ativos da equipe (ex: "7 corretores") ou o nome do líder em menor destaque.
   - Foto continua sendo do corretor líder, mas como avatar lateral, não como identidade principal do card.
   - Stats já agregados (`e.ligacoes`, `e.aproveitamentos`, `e.pontos`, `e.visitas`) continuam os mesmos.

2. **Garantir dados de equipe** (sem mudança de backend):
   - A Edge Function `oferta-ativa-ranking` já retorna o array `equipes` com `equipe`, `pontos`, `ligacoes`, `aproveitamentos`, `visitas`, `corretores`.
   - A RPC `rpc_placar_mutirao()` usada no modo público também já retorna `equipes`.
   - Nenhuma alteração em Edge Functions ou banco é necessária.

3. **Validação visual:**
   - Verificar no preview que o card da esquerda exibe "BRUNO", "GABRIEL", "JUNIOR PADILHA" (ou nomes canônicos das equipes) como título principal.
   - Verificar que o ranking da direita continua mostrando corretores (RAFAELA, ELIEZER, THALIA, etc.).
   - Verificar que "Últimas Conquistas" permanece na base.

**Arquivos envolvidos:**
- `src/components/oferta-ativa-ao-vivo/PlacarTv.tsx` (apenas a seção do card de equipe, sem tocar na coluna direita nem na faixa de conquistas).

**Riscos / mitigações:**
- Nenhuma mudança de dados ou backend; risco baixo.
- Layout já está responsivo; ajuste apenas de hierarquia textual dentro do card existente.