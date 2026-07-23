Plano: 3 ajustes frontend no `/oferta-ativa-ao-vivo` (tela do corretor)

Escopo: somente frontend. Sem migrations, sem alterações no RPC `oferta_ativa_lock_next_lead`, sem edge functions.

### 1) Escopar localStorage por corretor (`src/hooks/useMutiraoSession.ts`)

Problema: as chaves `mutirao:filters` e `mutirao:onboarded` são globais por navegador, então um corretor que usa o mesmo navegador herda o estado de outro.

Ajustes:
- Importar `useCorretorIds` e usar `profileId` como sufixo das chaves.
- Substituir chaves estáticas por chaves dinâmicas: `mutirao:filters:${profileId}` e `mutirao:onboarded:${profileId}`.
- Carregar filtros/onboarding de `localStorage` somente após `profileId` ser resolvido.
- Atualizar `setFilters`, `setOnboarded` e `resetCorretor` para ler/gravar/remover a chave correta do usuário logado.
- Resultado: corretor novo (ou em navegador compartilhado) abre com onboarding visível e filtros vazios.

### 2) Reorganizar coluna direita (`src/components/oferta-ativa-ao-vivo/CorretorScreen.tsx`)

Atualmente a coluna direita mostra Ranking + Feed fixos e, abaixo, abas Meta/Histórico.

Ajustes:
- Criar uma única barra de abas com três opções: `Ranking`, `Meta`, `Histórico` (default: `Ranking`).
- Cada aba renderiza seu respectivo painel (`RankingPanel`, `MetaPanel`, `HistoricoPanel`).
- Manter o `FeedPanel` (Celebrações) sempre visível logo abaixo das abas.
- Nenhuma mudança de props ou de dados nos painéis reutilizados.

### 3) Remover o bloco "Dossiê rápido" com IA (`src/components/oferta-ativa-ao-vivo/LeadCard.tsx`)

Problema: a IA está inventando valores (ex.: "R$297.000,00") que não existem no banco.

Ajustes:
- Remover estados `dossie`, `dossieLoading` e a função `gerarDossie`.
- Remover a chamada à edge function `oferta-ativa-dossie`/`homi-copilot` usada no dossiê.
- Remover o bloco de UI "Dossiê rápido" do card.
- Manter os dados factuais: nome, telefone, empreendimento, segmento, "Descartado há Xd" e motivo de descarte.
- Remover importações de ícones/componentes que deixarem de ser usados após a remoção.

---

Validação:
- Testar login com dois corretores diferentes no mesmo navegador: cada um deve ter filtros/onboarding independentes.
- Verificar no preview que a coluna direita exibe as abas Ranking/Meta/Histórico com o Feed sempre abaixo.
- Confirmar que o card do lead não exibe mais o bloco de dossiê nem botão "Gerar com IA".