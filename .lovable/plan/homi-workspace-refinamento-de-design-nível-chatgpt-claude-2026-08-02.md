# HOMI Workspace — refinamento de design (nível ChatGPT / Claude)

Objetivo: elevar a página `/homi` de "funcional" para "produto de IA premium", sem mexer em nenhuma regra de negócio, ferramenta ou dado. Só camada visual, tipografia, ritmo e microinterações.

## Diagnóstico da tela atual

- Densidade uniforme: header, lista e composer têm o mesmo peso visual — nada guia o olho.
- Mensagens do HOMI são texto cru em `prose` pequeno, sem hierarquia (título, bullets e números pesam igual).
- Composer é uma linha de 3 controles soltos (clipe + textarea + enviar), sem sensação de "caixa de comando".
- Estado vazio genérico: mascote + 4 chips iguais, sem promessa clara do que o HOMI faz.
- Sidebar de conversas é uma lista plana, sem agrupamento por tempo nem hierarquia de leitura.
- Cartões de resultado (Fase 3/7) já são bons, mas cada um tem sua própria borda/cor — falta uma linguagem única.
- Loading é um spinner; falta a sensação de "pensando" que os produtos de IA de referência têm.

## O que vou construir

### 1. Superfície e ritmo
- Fundo da conversa levemente diferenciado do chrome (sidebar/composer), criando profundidade sem caixas.
- Largura de leitura consistente (medida de ~72 caracteres) e respiro maior entre turnos.
- Header do chat mais leve: título da conversa em peso médio, ações em ícones fantasma, borda sutil que só aparece quando a conversa rola (sombra de scroll).

### 2. Mensagens
- Assistente sem balão: texto direto sobre a superfície, com tipografia editorial (títulos, listas e números com hierarquia real via `prose` customizado).
- Usuário mantém bolha, com par de tokens de alto contraste (`primary` / `primary-foreground`) e cantos assimétricos.
- Avatar do HOMI só no primeiro turno de cada bloco, alinhado com o texto.
- Ações por mensagem no hover: copiar, refazer, "aprofundar" — no padrão dos produtos de referência.

### 3. Estado "pensando"
- Substituir o spinner por shimmer de texto ("Lendo seus números...", "Montando a mensagem...") com o rótulo variando conforme a ferramenta em execução.
- Skeleton leve enquanto o primeiro cartão de resultado carrega.

### 4. Composer (caixa de comando)
- Uma caixa única arredondada com sombra e foco em anel, agrupando anexo, texto e envio dentro dela.
- Textarea com auto-grow suave e placeholder curto no mobile.
- Botão de envio como ícone circular fixo, nunca esticado; anexos aparecem como chips dentro da própria caixa.
- Dica discreta "Enter envia · Shift+Enter quebra linha" (desktop).

### 5. Estado vazio
- Bloco de boas-vindas com hierarquia: saudação grande, uma linha de promessa, briefing do dia em destaque.
- Chips de exemplo viram cards de ação com ícone + título + subtítulo, agrupados por intenção (Meu dia · Escrever · Buscar · Números). Para liderança, o grupo "Números" mostra time / meta / raio-x.

### 6. Sidebar de conversas
- Agrupamento por tempo (Hoje · Últimos 7 dias · Antes) com rótulos discretos.
- Item ativo com indicador lateral em vez de bloco cheio; ações (renomear/arquivar) só no hover ou no menu.
- Botão "Nova conversa" fixo no topo, estilo de ação primária calma.

### 7. Linguagem única de cartões
- Um wrapper comum para todos os cartões de resultado: mesma borda, raio, cabeçalho com ícone + título + selo de fonte, e área de conteúdo.
- Cor só como acento (barra/ícone), não como fundo inteiro — mantém o padrão semântico já usado (âmbar = atenção, vermelho = risco, verde = no ritmo).

### 8. Mobile impecável
- Alvos de toque de 44px, composer fixo com safe-area, sheet de conversas e Painel Vivo com handle e cantos arredondados.
- Cartões com scroll horizontal quando têm tabela (ranking do time), sem quebrar layout.

### 9. Microinterações
- Entrada de mensagem com fade+slide curto, cartões com scale-in escalonado, hover-scale nos cards de exemplo — usando as animações já existentes no projeto (`animate-fade-in`, `scale-in`, `hover-scale`), sem biblioteca nova.

### 10. Mascote HOMI em 3D refinado
- Partir da arte oficial atual (`public/images/homi-mascot-official.png`) e requalificá-la, mantendo 100% a identidade: mesmo personagem azul com capuz em formato de casinha e chaminé, visor escuro, olhos e sorriso ciano, monograma de casa no peito, mesma pose e proporções.
- O que melhora: render 3D com material mais rico (plástico soft-touch com leve subsurface), iluminação de estúdio em três pontos, reflexo suave no visor, emissão real (glow) nos olhos e no sorriso, bordas mais limpas em alta resolução, sombra de contato sutil e fundo transparente.
- Três variantes geradas a partir da mesma arte:
  - `homi-3d-full.png` — corpo inteiro, para o estado vazio e telas de destaque.
  - `homi-3d-bust.png` — busto/cabeça, para o avatar ao lado das respostas.
  - `homi-3d-icon.png` — recorte compacto, para botões contextuais e favicon/PWA.
- Onde entra: estado vazio do `/homi`, avatar das mensagens do assistente, `HomiPageButton`/`HomiHeaderButton` e sidebar. Os arquivos atuais ficam no repositório como fallback até a validação visual.
- Ao lado do avatar, um anel de "respiração" sutil enquanto o HOMI pensa (mesma animação de shimmer), sem GIF nem vídeo.

## Detalhes técnicos

- Arquivos tocados: `src/pages/HomiWorkspace.tsx`, `src/components/homi/workspace/{MessageList,ThreadSidebar,PainelVivo,BriefingCard}.tsx`, um novo `src/components/homi/workspace/{Composer,ThinkingIndicator,HomiCard}.tsx`, e ajuste de classes nos cartões das fases 3 e 7.
- Novas imagens em `public/images/` geradas por edição da arte oficial existente (não é um personagem novo), em PNG com transparência e servidas em tamanho adequado para não pesar no mobile.
- Zero mudança em edge functions, ferramentas do HOMI, hooks de dados ou banco.
- Somente tokens semânticos do design system (`background`, `card`, `muted`, `primary`, `border`); nenhuma cor fixa tipo `text-white` ou hex.
- Sem dependências novas; markdown continua em `react-markdown` com classes `prose` customizadas.
- Validação ao vivo no preview (desktop + mobile) com conversa real antes de reportar pronto.


## Execução em 4 fases

1. Fase A — mascote 3D refinado (as 3 variantes) para você aprovar visualmente antes do resto.
2. Fase B — conversa: superfície, mensagens, "pensando", composer.
3. Fase C — entrada e navegação: estado vazio com cards de ação, sidebar agrupada, Painel Vivo.
4. Fase D — cartões: wrapper único, acentos e polimento mobile/microinterações.
