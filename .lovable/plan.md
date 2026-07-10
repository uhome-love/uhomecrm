# Placar do Dia — Anúncio no meio da tela + sons distintos

Ajuste apenas de frontend em `src/pages/PlacarDoDia.tsx`. O backend (`rpc_placar_do_dia`) já devolve `id`, `status`, `corretor_nome`, `nome_cliente` e `empreendimento` de cada visita, então dá para detectar tudo no cliente. Nenhuma migração.

## Problema atual
1. **Não aparece anúncio no meio da tela.** Hoje, quando uma visita entra, só surge um pequeno "+1 🎯" flutuando dentro do card da equipe. Não existe o banner grande no centro ("FULANO MARCOU VISITA" / "FULANO REALIZOU VISITA") que foi aprovado no mockup.
2. **Som igual para marcada e realizada.** A detecção dispara `tocarSom` de forma genérica e acaba tocando sempre parecido; o usuário não percebe diferença entre marcação e realização.

## O que será feito

### 1. Banner de anúncio no centro da tela
- Novo overlay em tela cheia (posição fixa, centralizado, `zIndex` acima de tudo, sem bloquear o placar por trás com fundo semitransparente).
- Conteúdo grande, no estilo do placar (Bebas Neue), com a cor da equipe do corretor:
  - **Marcada:** `🎯 VISITA MARCADA` + `FULANO` (primeiro nome do corretor) + linha secundária com o cliente/empreendimento quando houver.
  - **Realizada:** `✅ VISITA REALIZADA` + `FULANO` + linha secundária, com visual mais festivo (glow mais forte).
- Animação de entrada/saída (escala + fade), fica ~4 segundos e some sozinho.
- Fila de anúncios: se vários eventos chegarem no mesmo poll (15s), exibe um de cada vez em sequência, sem sobrepor.

### 2. Detecção com nome e tipo
- A detecção de transição de status (que já existe via `prevStatusPorId`) passa a montar uma lista de eventos `{ nome, tipo, cliente, empreendimento, corEquipe }`:
  - visita nova (id não visto antes) → evento `marcada`.
  - visita existente que muda para `realizada` → evento `realizada`.
- Esses eventos alimentam tanto a fila do banner quanto o som — garantindo que cada anúncio toque o som do seu próprio tipo.
- Mantém a proteção de primeiro carregamento (não dispara banner/som ao abrir a página).

### 3. Sons distintos garantidos
- Cada anúncio, ao ser exibido, chama `tocarSom(tipo)` com o tipo daquele evento (não mais um único disparo por poll).
- Reforço da diferença sonora entre os dois:
  - **Marcada:** jingle curto e leve (sine, acorde ascendente curto).
  - **Realizada:** sequência mais longa, brilhante e mais alta (triangle, mais notas), claramente diferente.

## Detalhes técnicos
- Estado novo `announcement` (item atual) + `announcementQueue` (ref) para enfileirar; um `useEffect` consome a fila, mostra por ~4s, toca o som do tipo e passa ao próximo.
- No loop de detecção, além de `prevStatusPorId`, empurrar os eventos detectados para a fila em vez de só setar `tocouMarcada/tocouRealizada`.
- O "+1 🎯" e o flash/glow do card são mantidos como estão.
- Nenhuma alteração em rotas, RPC ou dados.
