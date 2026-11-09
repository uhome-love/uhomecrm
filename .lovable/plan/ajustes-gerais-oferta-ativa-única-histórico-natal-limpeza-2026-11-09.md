# Ajustes gerais + Oferta Ativa única (histórico, Natal, limpeza)

Faremos em 4 fases. Cada uma é conferida no computador **e no celular** antes da próxima (vira regra fixa daqui pra frente).

## Fase 1 — Espaço no topo e banners
- **Todas as páginas**: diminuir o espaço entre as abas superiores e o conteúdo, igual ao Pipeline (que fica ideal). Os lados continuam com a margem de hoje.
- **Banner de boas-vindas (computador)**: mais baixo (avatar menor, chips na mesma linha, Homi proporcional).
- **Banner no celular**: mais baixo e no azul da marca (hoje está azul-noite): data pequena em cima, "Bom dia, Rafaela" numa linha, frase em 2 linhas no máximo, chip do Natal e Homi menor encaixado à direita.
- Missão de Natal no celular: título + barra numa faixa mais compacta.

## Fase 2 — Tela de ligação
- Tirar "entrou há X meses" do topo e de "Mais detalhes".
- **Roteiro conectado à Campanha de Natal**: se o empreendimento do cliente está na Campanha de Natal, o roteiro usa a fala de Natal daquele produto e as objeções de Natal (mesmos textos da Central da Campanha). Fora da campanha, segue o roteiro normal. O roteiro pessoal (Editar) continua tendo prioridade.
- Selo "🎄 Natal" no roteiro quando for o de Natal.

## Fase 3 — Aba "Histórico de ligações"
Nova aba ao lado de Reservados/Aproveitados:
- Lista das ligações do corretor (últimos 30 dias): cliente, empreendimento, resultado, dia/hora, duração.
- Filtro por resultado e busca por nome/telefone.
- Botão **Aproveitar** em cada linha:
  - cliente livre → vai para o Pipeline do corretor (mesmo caminho do Aproveitar da ligação);
  - já está com outro corretor → mensagem "Este cliente já está com Fulano" e nada muda;
  - já está com ele mesmo → "Já está no seu Pipeline" com atalho para abrir.
- Respeita opt-out e "já comprei" (bloqueia).

## Fase 4 — Fonte única e limpeza
- Confirmar que relatórios, painéis, ranking e TV leem só o que a nova Oferta Ativa grava (ligações de Listas e do Bolsão). Corrigir qualquer tela que ainda conte por outra fonte.
- Remover telas antigas do corretor: **Mutirão ao Vivo**, tela antiga de ligação/discador, Arena antiga e atalhos que apontam para elas (links antigos passam a abrir a nova Oferta Ativa).
- **Mantida** apenas a área do gestor que cria/libera listas (sem ela não há o que ligar) — renomeada "Listas da Oferta Ativa".
- Histórico de pontos já gravado não é apagado.

## Teste ponta a ponta (com clientes fictícios, apagados ao final)
- Cada resultado (Não atendeu, Sem interesse, Número errado, Aproveitar, Visita marcada) em Listas, Estagnados e Descartados; conferir no banco: ligação, cliente no Pipeline, visita na agenda, placar, ranking.
- Histórico: Aproveitar livre, já com outro corretor, já comigo.
- Contador, janela de resultado, roteiro de Natal e roteiro editado.
- Telas: 1346×770, 1920, tablet e celular 390; painel inicial e páginas principais conferidas após a mudança de espaço.
- No fim, lista de melhorias visuais/uso que eu recomendar (sem aplicar sem aprovação).

## Detalhes técnicos
- `AppLayout` padding padrão `p-4 sm:p-6 lg:p-8` → `px-4 pt-3 pb-6 sm:px-6 lg:px-8 lg:pt-4`; remover `md:-mt-6` provisório da tela de ligação.
- Natal: casar `cliente.empreendimento` com produtos de `src/natal/central/conteudo.ts` (gancho + objeções); só quando `useNatal().ativo`.
- Histórico: hook lendo `oferta_ativa_tentativas` (próprio corretor) + Bolsão; nova função de servidor `oa_aproveitar_do_historico(lead)` SECURITY DEFINER que verifica dono atual no Pipeline, opt-out e reutiliza o mesmo fluxo de aproveitar (1 migration, fora do expediente — agora).
- Limpeza: remover `OfertaAtivaAoVivo`, `components/oferta-ativa-ao-vivo` (exceto o que a TV/relatórios ainda usem, migrado antes), `components/arena` antigos e `DialingModeWithScript`; redirects em `pageRegistry`/`App.tsx`; atualizar Sidebar, MobileBottomNav, GlobalSearch, atalhos. Sem DROP de tabelas.
