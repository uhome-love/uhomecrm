# Modal do Lead — Faxina + Aba História (a jornada do lead)

**Data:** 2026-08-11
**Autor:** Lucas + Claude
**Status:** Aprovado (design) — pronto pra plano de implementação
**Mockup de referência:** `scratchpad/modal-lead-redesign.html` (artifact c6c0ce19)

---

## 1. Problema

O modal do lead (`PipelineLeadDetail.tsx`, 1.138 linhas) sofre de dois males:

1. **Coluna esquerda bagunçada** — 9 blocos empilhados, com o "o que faço agora" repetido em 3 lugares (caixa Próxima ação, botão ⚡ Registrar, grade de ações) e 4 cards de status/contexto antes das ações. Muita rolagem, pouca hierarquia.

2. **Timeline sem história** — o Histórico é um log de eventos onde contato humano e andaime automático têm o mesmo peso. Pior: hoje **quase não existe registro humano** — a timeline é dominada por "Tarefa criada 🤖", "Tarefa cancelada 🤖", "Movido para etapa". O corretor abre o lead e **se perde**: não há história porque ninguém é obrigado a registrar o que aconteceu.

**Causa-raiz:** falta de captura. Sem observação obrigatória nas atividades, o CRM fica pobre — só verbos ("ligou", "mandou WhatsApp"), sem enredo ("o que o cliente disse").

## 2. Visão

Cada lead tem uma **história contada**: entrou (qual anúncio/formulário) → 1º contato → qualificação → follow-ups → visita agendada → visita realizada + feedback → virou negócio. Cada passo carrega uma **observação** (o que rolou). Essa história:
- Dá contexto imediato pro corretor (e pro que herda o lead).
- Deixa o gerente auditar de verdade.
- **Destrava o HOMI** — só com a jornada estruturada ele sugere o próximo passo, prioriza a Agenda e escreve a mensagem certa.

## 3. Escopo — 3 peças

### Peça 1 — Coluna esquerda: de 9 blocos → 4 zonas
Ordem nova:
1. **Síntese (briefing)** — 1 frase gerada por regra (etapa + última atividade + resultado). Ex.: *"Visitou ontem, gostou, vai pensar — ligar hoje pra destravar a proposta."* Sem IA nova; é template.
2. **AGORA** — zona única de ação: próximo passo + **⚡ Registrar atividade** (único) + ações compactas (Ligar/WhatsApp/Anotar/Mais). Elimina os 3 pontos redundantes de "registrar".
3. **Saúde** — tira única (cadência + estagnação + tentativas), no lugar de 2 cards separados.
4. **Contexto recolhível** — "Sobre o lead" (Qualificação + Perfil), "Empreendimento + Materiais", "Observações". Fechados por padrão.

### Peça 2 — Aba História (a narrativa)
Abas de topo do painel direito: **📖 História · 📌 Lembretes · 📊 Visitas · 💼 Negócio**.
(Mantém Lembretes e Visitas e Negócio como estão hoje; renomeia/reformula "Histórico" → "História".)

Dentro da História, um toggle **📖 Narrativa | ⚙ Sistema**:
- **Narrativa** (padrão) = só marcos com substância, **recente no topo**:
  - 🎯 Entrou pelo anúncio (origem + respostas do formulário)
  - 📞 Contatos com sucesso (1º contato, follow-ups) + observação
  - 🔎 Mudança de etapa relevante (ex.: "Avançou pra Qualificação") + atividade/observação
  - 📅 Visita agendada
  - 📍 Visita realizada + **feedback** (destaque)
  - 💼 Virou negócio / marcos de proposta
- **Sistema** = o andaime operacional (tarefas e lembretes criados/cancelados por automação, movimentações técnicas). Fica **dentro** da História, um toque de distância — não polui a narrativa, mas continua auditável.

**Classificação Narrativa × Sistema** (a lógica de merge já existe em `LeadHistoricoTab.tsx`, que junta atividades + anotações + tarefas + histórico):
- **Narrativa:** atividades humanas (ligação/whatsapp/email com sucesso), anotações, feedback de visita, mudanças de etapa feitas por pessoa, marcos de negócio.
- **Sistema:** tarefas/lembretes com `origem` de automação (`isAutomacao()` já existe: `sistema`, `visita_auto`, `qualificacao_*`, `auto_*`), tarefa criada/cancelada, movimentações automáticas.

### Peça 3 — Captura obrigatória (a regra de ouro)
**Observação é padrão em toda atividade com sucesso/contato efetivo.**
- ✅ **Obrigatória** quando houve contato/sucesso: ligação *atendida*, WhatsApp *enviado*, email *enviado*, visita *realizada* (feedback), atividade de qualificação/negociação. Mínimo de caracteres (sugestão: 10–15), senão não fecha.
- ⚪ **Opcional** em tentativa sem contato: "não atendeu", "caixa postal", "número errado" — não força enredo onde não há.

Implementação: validação em `RegistrarAtividadeModal.tsx` (já tem `tipo`, `resultado`, `descricao`) — quando `resultado` indica sucesso, `descricao` vira required com min-chars. E no fechamento de visita (marcar "realizada") exige o feedback.

## 4. O que NÃO muda (lógica preservada)
- Não mexe no modelo de dados de leads/atividades/tarefas — só adiciona validação e reorganiza a apresentação.
- Não remove nenhuma informação: tudo que hoje aparece continua acessível (contexto recolhível, sub-aba Sistema).
- Abas Lembretes / Visitas / Negócio seguem funcionando como estão.
- Cadências e automações continuam iguais — só deixam de dominar a timeline visual.

## 5. Arquivos afetados (mapa)
- `src/components/pipeline/PipelineLeadDetail.tsx` — reorganizar coluna esquerda (asideNode) em 4 zonas; renomear aba Histórico → História.
- `src/components/pipeline/LeadHistoricoTab.tsx` — separar Narrativa × Sistema (toggle); ordenar recente no topo; classificar eventos.
- `src/components/pipeline/drawer/DrawerTimelineGroup.tsx` — estilos de marco (destaque do feedback, observação como citação).
- `src/components/pipeline/RegistrarAtividadeModal.tsx` — observação obrigatória condicional (por resultado).
- Fechamento de visita (form de "realizada") — feedback obrigatório. (Localizar: `DrawerVisitsTab` / `OpportunityVisitasTab` / task-completion.)
- Novo helper de **síntese/briefing** (template por etapa + última atividade + resultado).

## 6. Fases (escopo-mínimo primeiro)
1. **Fase A — Coluna esquerda** (baixo risco, puro visual): 9 → 4 zonas + síntese. Valida no localhost.
2. **Fase B — Aba História** (médio): renomear, toggle Narrativa/Sistema, classificação, recente-no-topo, observação como citação e feedback em destaque.
3. **Fase C — Observação obrigatória** (sensível, mexe no fluxo do time): validação condicional no Registrar + feedback obrigatório na visita. Casar com o plano de fricção (`2026-08-09-nova-gestao-friccao-design.md`) — obriga só onde o dado é crítico.

Publicar cada fase no Lovable só após validação visual no servidor interno (fetch+merge antes, nunca force-push).

## 7. Riscos
- **Componente sensível** (usado por todo o time). Mitigar: fases pequenas, validar no localhost antes de subir.
- **Fricção da obrigatoriedade** — mínimo de caracteres pode irritar se muito alto. Começar baixo (10–15) e só nas atividades com sucesso.
- **Coexistência com Lovable** (edições paralelas). Sempre `git fetch origin` + merge antes de publicar.

## 8. Ganhos
- Corretor entende o lead em ~5 segundos (hoje se perde).
- Gerente/CEO passam a ter contexto real por lead (auditoria de verdade).
- **HOMI** ganha combustível: jornada estruturada → sugestões, priorização de Agenda, mensagens.
- CRM deixa de ser "lista de verbos" e vira memória viva do relacionamento.
