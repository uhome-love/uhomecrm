# HOMI · Card de imóvel com vaga visível + preview do imóvel

Hoje o card de resultado da busca do HOMI mostra só: foto pequena, bairro, dormitórios, área e preço. Quando a Luiza pede "com vaga", o corretor não consegue conferir no card se o imóvel tem vaga, nem ver fotos — precisa sair do HOMI e procurar o imóvel na página de Imóveis. Isso quebra o fluxo.

## O que muda

### 1. Card mostra os atributos que o corretor pediu
Linha de selos abaixo do título, com ícones: dormitórios, suítes, vagas, área. Vaga passa a ser sempre visível (`1 vaga`, `2 vagas`, ou `sem vaga` em cinza quando o imóvel não tem).

Além disso, um selo verde "✓ atende ao pedido" nos atributos que casam com o critério da busca (ex.: se pediu vaga e o imóvel tem, o selo de vaga fica verde). Quando o HOMI teve que relaxar algum critério, o atributo relaxado aparece em âmbar — assim o corretor vê na hora o que não bateu.

### 2. Clicar no card abre o imóvel dentro do HOMI
Reaproveitar o drawer premium que já existe na página de Imóveis (`PropertyPreviewDrawer`): fotos em galeria/lightbox, ficha técnica do corretor, valores, condomínio/IPTU, endereço, responsável e botões de compartilhar.

- Clicar na foto ou no título do card abre o drawer.
- Navegação prev/next dentro do drawer percorre os imóveis daquele resultado da busca.
- Botão "Abrir página" leva ao imóvel em nova aba (`/imovel/:codigo`), para quem prefere tela cheia.
- Os botões atuais (Copiar mensagem / WhatsApp) continuam iguais no card.

### 3. Busca devolve os dados necessários
A ferramenta `buscar_imovel` passa a devolver também `id`, `suites`, `condominio`, `mobiliado`, mais fotos (não só a primeira) e quais critérios foram atendidos/relaxados por imóvel. Sem isso o drawer não consegue abrir nem os selos ficam corretos.

## Detalhes técnicos

- `supabase/functions/homi-chat/homi-tools.ts` → `buscar_imovel`:
  - `SELECT` já traz `id, suites, vagas, fotos`; incluir `condominio`, `mobiliado`, `slug` e manter `id` no `mapRows` (hoje o `id` é descartado).
  - `fotos`: devolver array (até ~8) em vez de só `thumb`.
  - Anexar a cada imóvel `match: { vagas: boolean, dormitorios: boolean, valor: boolean, mobiliado: boolean }` calculado contra os argumentos da busca, e propagar `relaxados` (já existe) no `result`.
- `src/components/homi/HomiActionCard.tsx`:
  - `ImovelRow`: nova faixa de selos (`Car`, `BedDouble`, `Bath`, `Maximize2`) com estado neutro / verde (atende) / âmbar (relaxado); foto e título viram área clicável.
  - `ImoveisCard`: passa a controlar o índice selecionado e renderiza `PropertyPreviewDrawer` uma única vez, com `onPrev`/`onNext` sobre a lista do resultado.
  - `PropertyPreviewDrawer` já busca por conta própria os dados extras a partir do item; passar o objeto do imóvel com `id` e `codigo`. Props obrigatórias que não se aplicam no HOMI (`selectMode`, favoritos) recebem valores neutros.
- Sem alteração de banco, RLS ou migrations. `properties` já é lido pelo cliente do usuário na busca.

## Fora de escopo

- Enviar o imóvel direto para um lead / registrar interesse a partir do card (pode virar uma fase 2).
- Mudanças na relevância da busca em si (já ajustada na etapa anterior).

---

# HOMI · Respostas curtas e decidíveis

O segundo problema: no popup (modo CEO/gestor) o HOMI responde em bloco gigante — "Gargalo Principal / Gargalos Secundários / Quick Win / Plano de 7 Dias / Ação Imediata..." — e o corretor precisa ler uma parede de texto para decidir o que fazer. Isso vem do prompt: hoje o HOMI é **obrigado** a sempre entregar diagnóstico em 4 níveis + 2 gargalos secundários + plano de 7 dias, e o formato de gestor/CEO exige 5 seções fixas (A a E).

## O que muda

1. **Resposta padrão curta.** O HOMI passa a responder como um assistente moderno: 3–6 linhas, direto ao ponto, com no máximo 3 bullets de ação. Uma frase de leitura da situação + o que fazer agora.
2. **Diagnóstico completo vira opcional.** O plano de 7 dias / ranking / diagnóstico em 4 níveis só aparece quando o usuário pedir ("faz um diagnóstico", "plano da semana", "relatório") ou quando ele clicar no botão "Aprofundar" que aparece no fim da resposta curta.
3. **Sem repetir o que já está em cartão.** Regra reforçada: quando a resposta vem de uma ferramenta (imóveis, tarefas, visitas), o texto é 1 frase — os dados já estão nos cartões.
4. **Sem enfeite.** Nada de títulos em negrito para cada parágrafo, listas com sub-listas, ou repetição do que o usuário perguntou. Tom de conversa, não de relatório.

## Detalhes técnicos

- `supabase/functions/uhome-ia-core/index.ts`:
  - "MODELO DE DIAGNÓSTICO" passa a ser condicional: aplicar apenas quando o pedido for de diagnóstico/plano/relatório.
  - `GERENTE_FORMAT` e `CEO_FORMAT`: substituir as 5 seções obrigatórias por um formato curto padrão (situação em 1 frase + até 3 ações) e manter o formato longo em um bloco `FORMATO APROFUNDADO`, usado só sob pedido explícito.
  - Nova regra de saída: limite alvo de ~80 palavras na resposta padrão; markdown mínimo.
- `supabase/functions/homi-chat/index.ts`: já pede 1–2 frases após ferramentas; reforçar o limite também nas respostas sem ferramenta.
- `src/components/homi/HomiPanel.tsx`: botão/atalho "Aprofundar" abaixo da última resposta, que reenvia o contexto pedindo o diagnóstico completo.

Nenhuma mudança de banco. Só prompts e um atalho na UI.
