# HOMI Copiloto — Fase 2: mais simples e usual

Objetivo: deixar o Homi leve de abrir, com busca de imóvel que realmente encontra e já entrega mensagem pronta com link, e todos os fluxos com o mínimo de digitação.

## 1. Abrir só com saudação (sem briefing automático)
- Remover o efeito de briefing automático em `HomiContext` (hoje ele dispara `ver_pendencias` sozinho ao abrir).
- A tela inicial passa a mostrar apenas a saudação ("Fala, Adriana! Como posso ajudar?") + botões de atalho já existentes.
- Manter o atalho "⏰ Atrasados" na barra rápida para quem quiser o resumo do dia sob demanda (1 toque), mas nunca automático.

## 2. Busca de imóvel facilitada (conhecer o catálogo e acertar)
Problema atual: "3 dorms passo d'areia" não retorna nada porque a busca exige tudo junto e não tolera variações.
- Botão "🔎 Imóvel" passa a abrir um **formulário de busca** (composer), igual aos de Tarefa/Visita, com campos simples: bairro/empreendimento (texto), dormitórios (chips 1/2/3/4+) e valor máximo. Digitar em linguagem natural continua funcionando.
- Melhorar a ferramenta `buscar_imovel` na edge:
  - Quebrar o termo em palavras e buscar cada token em `bairro`, `empreendimento`, `titulo` (tolerante a "passo dareia" / "passo d'areia").
  - Se a busca estrita não achar nada, fazer uma segunda passada mais ampla (só o token mais forte) e marcar como "resultados aproximados" em vez de "nenhum imóvel".
  - Incluir `slug` no retorno para montar links.
- No prompt do copiloto: ao pedir imóvel, chamar `buscar_imovel` direto (sem ficar perguntando bairro/dorms/valor campo a campo).

## 3. Link pronto + mensagem pronta pra enviar
- No cartão de cada imóvel (`ImoveisCard`), adicionar ações:
  - **Copiar mensagem**: monta texto pronto (título, bairro, preço, link) e copia.
  - **WhatsApp**: abre `wa.me` com a mensagem já preenchida pra escolher o contato.
- O link usa o padrão oficial personalizado do corretor: `https://uhome.com.br/c/{slug_do_corretor}/imovel/{slug}` (via `useBrokerSlug` + `gerarSlugUhome`), o mesmo da página do imóvel.
- Opção "Enviar pro lead" quando a busca partiu de um lead: gera a mensagem já com o nome do lead.

## 4. Facilitar todos os fluxos (menos digitação)
- WhatsApp de follow-up: o botão "💬 Whats" nas pendências/lead já rascunha a mensagem; garantir que o resultado venha com botões **Copiar** e **Abrir no WhatsApp** (não só texto).
- Tarefa/Visita: manter composers abrindo na hora (1 toque), com lead pré-selecionado quando vier de uma pendência.
- Revisar rótulos e tamanhos no mobile (safe-area, toque ≥ 40px).

## 5. Validar função por função (ponta a ponta, como corretor)
Testar logado como corretora e conferir persistência/uX:
- Abertura: só saudação, sem briefing automático.
- Atrasados/pendências: lista + ações (Concluir, Nova tarefa, Whats, Abrir lead).
- Buscar imóvel: por bairro, por dorms, por valor, e caso "sem match exato" (retorno aproximado). Copiar mensagem e abrir WhatsApp com link válido.
- Criar tarefa e criar visita: confirmação → grava em `pipeline_tarefas` / `visitas` + timeline `pipeline_atividades`.
- Resumo de lead e anotação: exibe cartão / grava com confirmação.

## Detalhes técnicos
- Arquivos: `src/contexts/HomiContext.tsx` (remover briefing auto), `src/components/homi/HomiPanel.tsx` (botão Imóvel abre composer), `src/components/homi/HomiActionCard.tsx` (composer de busca + ações Copiar/WhatsApp no `ImoveisCard`, link via `useBrokerSlug`/`gerarSlugUhome`), `supabase/functions/homi-chat/homi-tools.ts` (busca tolerante + `slug`), `supabase/functions/homi-chat/index.ts` (ajuste do prompt).
- Sem migração de banco. Busca client/edge respeita RLS do corretor.
- Deploy da edge `homi-chat` após as mudanças.

Uma dúvida rápida: a mensagem pronta deve **abrir o WhatsApp** (você escolhe o contato) ou **copiar para a área de transferência**? Posso deixar os dois botões — confirme se prefere assim.
