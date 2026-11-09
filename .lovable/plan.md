# Oferta Ativa nova: um único módulo de ligações, moderno e simples

## O problema hoje
- O banner azul gigante da "Arena" ocupa metade da tela e continua fixo em cima enquanto o corretor liga.
- Existem três telas de ligação diferentes: Listas (tela cheia, bagunçada, com muitos blocos), Descartados (cartão simples) e Estagnados (diferente das duas).
- A Oferta Ativa antiga e a Arena competem; o corretor não sabe onde começar.
- O ranking da direita está bom e fica.

## O que vamos construir
Um único módulo **"Oferta Ativa"** (substitui a Arena e a tela antiga de ligação), com 2 telas:

### Tela 1 – Entrada (antes de ligar)
- **Meta do dia preenchível**: o corretor digita quantas ligações quer fazer hoje (mínimo sugerido 30, nunca abaixo do mínimo 30/3/1). Barra de progresso pequena.
- **Escolha onde ligar**: 3 cartões grandes e iguais – Listas de leads (escolhe a campanha), Descartados (escolhe o empreendimento), Estagnados (escolhe o empreendimento). Mostra quantos clientes há em cada.
- Ranking de ligações à direita (Hoje/Semana), como está hoje.
- Nada de banner grande: só um título e o placar compacto em uma linha.

### Tela 2 – Ligação (foco total, igual para as 3 origens)
Topo: uma linha fina com "← Sair", origem, placar compacto (12/30 ligações · 1/3 aproveitados · 0/1 visita) e "Pular".
- **Coluna esquerda – Cliente**: nome, telefone grande, empreendimento de interesse, origem e há quanto tempo entrou, último contato/motivo do descarte (quando houver). Botões **Ligar** (verde, grande) e **WhatsApp**.
- **Centro – Script**: roteiro do empreendimento já carregado (sem precisar selecionar), objeções rápidas em chips abaixo e "Pedir ajuda ao HOMI" recolhido.
- **Resultado (fixo no rodapé do cartão)**: Não atendeu · Sem interesse · Com interesse/Aproveitar · Visita marcada · Número errado, mais Pular e Sair. Ao registrar, vai automático para o próximo cliente com uma animação curta e o placar sobe.
- **Direita – Ranking** compacto.
- Ficha rápida, histórico e e-mail ficam numa gaveta "Mais detalhes" (fora do caminho).

### Celular
- Tela de ligação em uma coluna: cliente + botão Ligar grande no topo, script rolável no meio, **barra de resultados fixa embaixo** com botões grandes (polegar). Ranking vira uma aba/gaveta.
- Ao voltar da chamada telefônica, a tela pede o resultado imediatamente.

### O que NÃO muda (regras preservadas)
- Contagem de ligações, aproveitados e visitas usa a mesma fonte única já validada (ranking/TV/relatórios iguais).
- Reserva de 1 cliente por vez, proteção de contato (opt-out/bloqueados), Bolsão (prazo 7 dias, regras do gerente), Aproveitar move ao Pipeline como hoje, Mutirão Ao Vivo e placar da TV continuam funcionando.
- Roleta e distribuição intocadas.

## Fases (cada uma validada com você antes da próxima)
1. **Mockup** (desktop + celular, entrada e ligação) para sua aprovação – nenhum código antes.
2. **Construção da Entrada** + remoção do banner grande; links do menu/dashboard apontam para o novo módulo (endereços antigos redirecionam).
3. **Tela de Ligação única** para as 3 origens (desktop).
4. **Celular** com barra fixa de resultados.
5. **Teste ponta a ponta** com clientes fictícios em Listas, Descartados e Estagnados (desktop e celular): cada resultado grava, avança, conta no placar/ranking/TV/relatórios; Aproveitar move ao Pipeline; visita aparece na agenda; opt-out bloqueia. Tudo de teste apagado no fim. Só entrego quando estiver impecável.

## Detalhes técnicos
- Novo módulo em `src/components/oferta-ativa-v2/` (Entrada, TelaLigacao, ClientePainel, ScriptPainel, ResultadoBarra, RankingLateral), arquivos < 300 linhas.
- Um adaptador comum por origem (`listas` → `fetch_next_lead_campaign`/tentativas; `descartados`/`estagnados` → `bolsao_puxar`/`bolsao_registrar`/`bolsao-aproveitar`) expondo a mesma interface `proximo/registrar/pular/sair`; nenhuma regra de servidor nova prevista.
- Meta pessoal salva no metas diárias já existentes (`corretor_daily_goals`), com piso 30/3/1.
- Reaproveita `RankingLigacoes`, `contatoPermitido`, scripts por empreendimento e invalidações de placar já validadas.
- `/arena-ligacoes` e `/oferta-ativa` levam ao novo módulo; componentes antigos de discagem removidos após validação.
- Registrar decisão no `AGENTS.md`.
