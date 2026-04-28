## Objetivo

Tornar a tela de seleção de listas do Call (Oferta Ativa) **a melhor experiência possível** para fazer o corretor querer ligar — organização impecável por **Segmento → Produto**, higienização em 1 clique de leads "sem interesse / não atende", e integração das listas de **Descartados Recentes** por produto.

---

## 1. Nova organização visual das listas

Hoje o corretor vê as listas em 3 abas planas (Campanhas / Listas / Personalizadas), com nomes confusos ("Facebook Lead Ads: Uhome - Lév Gravataí", "Botanique - Me Day", "Diversos") e tudo no mesmo nível.

**Nova estrutura hierárquica** na aba "Campanhas" (que vira **"Por Produto"**):

```text
🏆 ALTÍSSIMO PADRÃO              (5 produtos · 1.240 na fila)
   ├─ 🏢 Boa Vista Country Club  → 145 na fila  · 32 aprov  · ▶ Iniciar
   ├─ 🏢 Lake Eyre               → 89 na fila   · 12 aprov  · ▶ Iniciar
   └─ 🏢 Seen Menino Deus        → ...

💎 MÉDIO-ALTO PADRÃO             (6 produtos · 890 na fila)
   ├─ 🏢 Casa Tua                → ...
   ├─ 🏢 Orygem                  → ...
   └─ ...

📈 INVESTIMENTO                  (6 produtos · 520 na fila)
   └─ ...

🏠 MCMV / ATÉ 500K               (3 produtos · 310 na fila)
   └─ ...

🔄 DESCARTADOS RECENTES          (por produto · 2.256 leads)
   ├─ 🏢 Casa Tua                → 234 leads descartados reengajáveis
   ├─ 🏢 Orygem                  → 187 leads
   └─ 🏢 Outros                  → 89 leads

📦 OUTROS / SEM SEGMENTO         (colapsado por padrão)
```

- **Segmento** = vem da tabela `roleta_campanhas.segmento_id` → join com `roleta_segmentos.nome`. Para produtos que não estão mapeados em `roleta_campanhas`, cai em "Outros".
- Cada **Produto** é um card com: nº na fila, aproveitados, total, % progresso, e botão **Iniciar** que dispara a sessão com TODAS as listas/campanhas daquele produto agregadas (igual ao `startCampaign` atual).
- Segmentos colapsáveis (memória da preferência no localStorage). Por padrão: abertos os que têm leads na fila, fechados os esgotados.

### Aba "Listas" continua existindo
Para quem prefere a visão plana atual (admin/debug). Renomeada para **"Listas brutas"**.

### Aba "Personalizadas" mantida sem mudanças.

---

## 2. Integração dos Descartados Recentes por produto

Hoje o `sweep-descartados` cria UMA lista mensal só (`"Leads não aproveitados - Abril 2026"`, empreendimento `"Diversos"`), o que joga tudo num balaião.

**Mudança no `sweep-descartados`**: ao processar leads em descarte reengajável, agruparemos por `pipeline_leads.empreendimento` e criaremos/atualizaremos UMA lista por produto/mês:

- `Descartados - Casa Tua - Abril 2026`
- `Descartados - Orygem - Abril 2026`
- ...
- `Descartados - Outros - Abril 2026` (para os sem empreendimento definido)

Cada lista herda `empreendimento` correto (Casa Tua, Orygem...) e `campanha = "Descartados Pipeline"`. Isso faz com que apareçam automaticamente na nova organização **dentro do segmento certo**, em uma seção visual diferenciada (banner roxo "🔄 Reengajamento") dentro do produto.

**Migração one-shot**: rodar um script que pega a lista única atual ("Leads não aproveitados - Abril 2026") e re-distribui os leads dela para listas por produto, baseado em `oferta_ativa_leads.empreendimento`. A lista antiga é arquivada.

---

## 3. Higienização em 1 clique (limpeza completa)

Botão **"🧹 Higienizar lista"** em cada produto/lista, que abre um painel rápido:

```
🧹 Higienizar "Casa Tua"

Selecione o que remover da fila:
☑ Sem interesse confirmado          (24 leads)
☑ Número inválido / não atende      (18 leads · 4+ tentativas sem sucesso)
☑ Já convertidos em outro lugar     (3 leads)
☐ Sem contato há +60 dias            (45 leads · cooldown longo)
☐ Já é negócio ativo no pipeline     (7 leads)

[ Cancelar ]   [ Higienizar 45 leads ]
```

Cada checkbox roda uma query distinta sobre `oferta_ativa_leads`:
- **Sem interesse**: `motivo_descarte ILIKE '%sem interesse%'` ou tentativas com `resultado='sem_interesse'` em `oferta_ativa_tentativas`.
- **Número inválido**: `tentativas_count >= 4` E última tentativa `resultado IN ('nao_atende','numero_invalido','caixa_postal')`.
- **Já convertidos**: cruza com `pipeline_leads` por telefone normalizado e checa se há venda associada.
- **Sem contato +60d**: `ultima_tentativa < now() - 60 days`.
- **Já é negócio**: telefone normalizado bate com `pipeline_leads` em stage tipo `negocio`.

Marca os leads com `status='descartado'` + `motivo_descarte` apropriado (não deleta — fica para auditoria). Atualiza contadores e dá um toast com o que foi removido.

**Higienização global**: botão no topo "🧹 Higienizar TODAS as listas" (admin/gestor only) que aplica os mesmos filtros em batch.

---

## 4. Refinamento visual

Mantém o estilo arena (escuro, glow), mas:

- **Header de segmento** com cor própria (ouro p/ Altíssimo, roxo p/ Médio-Alto, verde p/ Investimento, azul p/ MCMV).
- **Cards de produto** mais limpos: remove o "📋 / 📂 / ⚡" decorativo, deixa só o nome em destaque + 3 números (na fila / aprov / total) + barra de progresso fina.
- **Pílula de "Saúde da lista"** ao lado do nome:
  - 🟢 Saudável (% aproveitamento >= 30%)
  - 🟡 Mediana (10-30%)
  - 🔴 Fria (<10% — sugere higienizar)
- **Última higienização** mostrada no card ("Higienizada há 3 dias"). Se nunca, botão pulsa suave.
- **Ordenação inteligente**: dentro do segmento, produtos ordenados por "leads na fila desc" (mais atrativo primeiro).

---

## Mudanças técnicas

### Arquivos editados
- `src/components/oferta-ativa/CorretorListSelection.tsx` — nova hierarquia Segmento → Produto, headers coloridos, ordenação.
- `src/components/oferta-ativa/ListaHigienizarDialog.tsx` *(novo)* — modal de higienização com checkboxes e preview de contagem.
- `src/components/oferta-ativa/CampaignManager.tsx` — adicionar coluna "segmento" na visão admin + botão higienizar.
- `src/hooks/useOfertaAtiva.ts` — novo helper `useListasPorSegmento()` que faz join com `roleta_campanhas` + `roleta_segmentos`, e helpers `previewHigienizacao()` / `executarHigienizacao()`.

### Backend
- **Migração de schema**: adicionar `oferta_ativa_listas.ultima_higienizacao_at timestamptz` e `oferta_ativa_listas.segmento_id uuid` (FK → roleta_segmentos, nullable; populado por trigger ou backfill via `roleta_campanhas.empreendimento`).
- **Migração de dados** (one-shot): popular `segmento_id` para listas existentes via match em `roleta_campanhas.empreendimento` (case-insensitive).
- **Edge Function `sweep-descartados`** — refatorar para criar uma lista por produto/mês em vez de uma única "Diversos".
- **Edge Function `oa-higienizar-lista`** *(nova)* — recebe `lista_id` + `regras[]` e marca leads como descartados em batch; retorna contagem.
- **Migração one-shot** dos leads atuais da lista mensal "Diversos" → splitar por `empreendimento` em listas por produto, depois arquivar a antiga.

### Manter intacto
- Wizard de listas personalizadas, modo de discagem (DialingModeWithScript), ranking, fluxo de aceite — nada do core de discagem é alterado.
- Aba "Personalizadas" e "Listas brutas" continuam.

---

## Resultado esperado

O corretor abre o Call e vê IMEDIATAMENTE: "Eu sou de Médio-Alto Padrão → tenho 890 leads quentinhos divididos em 6 produtos, com Casa Tua liderando com 234". Sem rolar lista de 67 nomes embaralhados. E quando uma lista esfria, ele higieniza em 2 cliques antes de ligar — sem queimar tempo em número que não atende.