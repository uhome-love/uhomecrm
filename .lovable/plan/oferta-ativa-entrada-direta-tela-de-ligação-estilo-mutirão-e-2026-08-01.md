# Oferta Ativa — entrada direta, tela de ligação estilo Mutirão e menu limpo

Três mudanças, todas no corretor:

1. Acabar com a tela escura "Modo Batalha" na Oferta Ativa — o corretor entra e já vê meta, campanha, script e o botão de ligar.
2. Deixar a tela de ligação da Oferta Ativa igual à do Mutirão ao vivo (mesmo layout, mesmos blocos, mesmos botões).
3. Tirar "⚡ Mutirão ao vivo" do menu lateral — ele só aparece quando houver mutirão ativo.

---

## 1. Entrada direta (sem tela escura)

Hoje `/corretor/call` abre uma tela imersiva escura ("✦ MODO BATALHA ✦ / Sua Missão de Hoje / COMEÇAR AGORA") e só depois mostra a entrada com as campanhas. Além disso existe um modal de onboarding que repete meta + script.

Novo comportamento:

- Remover totalmente a tela de warm-up escura e o modal de onboarding.
- Ao abrir a Oferta Ativa, o corretor cai direto numa única tela clara com, de cima para baixo:
  - **Barra de missão** (compacta): Ligações / Aproveitados / Visitas com meta editável no lápis, e pontos do dia.
  - **Campanha do dia**: nome do empreendimento, observação do CEO, leads na fila, aproveitados, prazo de expiração, e o botão grande **Ligar agora**.
  - **Script da ligação**: bloco recolhível já com o script/template da campanha visível em 1 clique.
  - **Outras campanhas liberadas** (linhas simples) e o link discreto "Ver todas as listas".
- Sem campanha liberada: estado vazio curto explicando que a liderança ainda não liberou lista.
- Se existir apenas uma campanha liberada, o botão "Ligar agora" fica em foco automático — um clique e o discador abre; nada de etapas intermediárias.

## 2. Tela de ligação igual à do Mutirão ao vivo

A tela de ligação da Oferta Ativa (`DialingModeWithScript`) mantém toda a lógica atual (fila, lock, registro de tentativa, visita, HOMI, pendências), mas ganha o mesmo formato visual do Mutirão:

- **Header fixo** no padrão do Mutirão: ponto vermelho "ao vivo", nome da campanha, contagem de leads restantes, botão Filtros/Trocar lista e "Finalizar e sair".
- **Grid 2 colunas** (`1fr` + coluna lateral ~380px), igual ao `CorretorScreen`:
  - Esquerda: card do lead no padrão do `LeadCard` do Mutirão (dados, telefone com clique-para-ligar, WhatsApp, badges de segmento/empreendimento/tempo) + script recolhível logo abaixo.
  - Direita: abas **🏆 Ranking · 🎯 Meta · 🕘 Histórico** e, abaixo, o feed de resultados recentes.
- **Botões de resultado** com a mesma ordem, cores e atalhos do Mutirão: Não atendeu · Sem interesse · Aproveitado · Visita agendada · Pular.
- No mobile, a coluna lateral vira abas abaixo do card do lead.

Nada de pontuação nova: a Oferta Ativa continua com as regras dela; só o visual e a disposição são unificados.

## 3. Mutirão ao vivo fora do menu

- Remover o item "⚡ Mutirão ao vivo" dos quatro perfis do menu lateral.
- O item volta a aparecer **automaticamente** enquanto existir uma sessão de mutirão ao vivo (ou agendada para hoje) — todos os perfis com acesso veem, com o ponto vermelho pulsando.
- Para o CEO/admin, o acesso permanente fica dentro de `/oferta-ativa`, num botão "⚡ Mutirão ao vivo" no cabeçalho da página, que leva a `/oferta-ativa-ao-vivo` (inclusive na aba de configuração para abrir a sessão de sexta).
- A rota `/oferta-ativa-ao-vivo` continua existindo e funcionando por link direto.

---

## Detalhes técnicos

- `src/pages/CorretorCall.tsx`: apagar a fase `warmup` (ImmersiveScreen, avatar, níveis, ranking rival, botão COMEÇAR AGORA) e o `useQuery("call-warmup")`; a página passa a renderizar direto `CorretorEntrada` dentro do layout normal. Arquivo cai de ~680 para ~150 linhas.
- `src/components/oferta-ativa/CorretorEntrada.tsx`: absorve a barra de meta editável (via `useCorretorProgress.saveGoals`) e o `ScriptPanel` recolhível; `OnboardingOfertaAtivaModal.tsx` é excluído.
- `src/components/oferta-ativa/DialingModeWithScript.tsx`: extrair o shell visual para o padrão do Mutirão (novo `DialerHeader` + grid 2 colunas + `DialerSidePanels` com Ranking/Meta/Histórico já existentes em `oferta-ativa/`), mantendo hooks e handlers atuais. Como o arquivo tem 1.366 linhas, a reorganização aproveita para separar header, painel lateral e barra de resultados em componentes próprios (<300 linhas cada).
- `src/components/layout/Sidebar.tsx`: remover as 4 entradas fixas e inserir o item condicionalmente a partir de um hook `useMutiraoAtivo()` (consulta `oferta_ativa_sessoes` com `status = 'ao_vivo'` na janela atual, refetch a cada 60s — mesma consulta já usada em `useMutiraoSession`).
- Sem migração de banco: nenhuma tabela, coluna ou policy muda.

## Validação

- Preview: `/corretor/call` abre direto na entrada clara, com meta editável, campanha e script; um clique abre o discador no layout do Mutirão.
- Menu lateral sem "Mutirão ao vivo" enquanto não houver sessão ao vivo; com sessão ativa o item reaparece.
- Discador testado com lead de teste, sempre cancelando ao final, sem alterar dados reais.
