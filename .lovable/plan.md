Objetivo
Estabilizar a página /imoveis inteira, corrigindo o crash atual do drawer, revisando mapa/busca/vitrine/dados internos, e depois validar o fluxo completo no preview até a tela ficar confiável para uso do corretor.

Diagnóstico confirmado
1. Bug crítico atual
- Ao abrir o preview de um imóvel, a página quebra no drawer.
- Erro real confirmado no preview/console:
  "Objects are not valid as a React child (found: object with keys {id_tipologia, sigla_tipologia, nome_tipologia})"
- Origem identificada: `BrokerTechnicalSheet.tsx` renderiza `tipologia` diretamente em `<Row value={tipologia} />`, mas em alguns imóveis `tipologia` vem como objeto, não como string.

2. Performance da página
- A página está funcional, mas lenta para primeira pintura.
- Métricas capturadas no preview:
  - FCP ~9.3s
  - DOMContentLoaded ~9.2s
  - Full load ~9.3s
- Gargalos mais evidentes:
  - `mapbox-gl.js` ~534KB e ~2.6s de carregamento
  - muitas requests paralelas de perfil/slug/estado do usuário
  - mapa e listagem carregam juntos no primeiro render
- CPU profile não mostrou um loop pesado isolado no app; o peso parece ser mais de carregamento inicial + Mapbox + múltiplas queries concorrentes.

3. Mapa / busca por mapa
- O mapa carrega e os controles aparecem.
- "Desenhar área" abre corretamente e mostra feedback visual.
- "Buscar ao mover" liga corretamente no UI.
- Ainda falta validação funcional completa de:
  - arrastar mapa e confirmar refresh por bounds
  - clicar em cluster/pin e abrir preview corretamente
  - comportamento do botão "Buscar nessa região" após movimento
- A automação conseguiu confirmar presença dos controles, mas o crash do drawer interrompe a validação fim a fim.

4. Vitrine
- O envio de códigos da vitrine já foi corrigido antes e os logs mostram os códigos certos sendo enviados.
- A bridge foi validada e já consegue criar vitrine com imóveis resolvidos quando recebe snapshot/códigos corretos.
- Ainda falta retestar o fluxo completo pela UI após corrigir o drawer, para garantir:
  - seleção no card
  - seleção no drawer
  - geração de link
  - abertura do link público
  - listagem em “Minhas Vitrines” sem regressão

5. Dados internos / corretor / imobiliária responsável
- A seção existe e a modelagem está boa, mas hoje não é robusta o suficiente para payloads heterogêneos do Jetimob.
- Risco já confirmado: campos estruturados podem vir como objeto e derrubar a renderização.
- Isso provavelmente pode afetar não só `tipologia`, mas também outros campos semelhantes em payloads diferentes.

Plano de correção
1. Blindar `BrokerTechnicalSheet` contra payloads heterogêneos
- Normalizar `tipologia` antes de renderizar.
- Aplicar o mesmo tratamento para qualquer campo que possa vir como:
  - string
  - número
  - boolean
  - objeto com `nome`, `descricao`, `sigla`, etc.
  - array de objetos
- Criar helpers locais de exibição segura, por exemplo:
  - `safeText(value)`
  - `safeBadgeText(value)`
  - `safeListLabel(value)`
- Garantir que nenhum `<Row>` receba objeto cru.

2. Tornar o drawer resiliente
- Manter o drawer aberto mesmo se algum bloco interno falhar.
- Isolar melhor a ficha técnica para que erro em um campo não derrube toda a página.
- Ajustar estados de loading/erro em:
  - responsável/origem
  - corretor responsável
  - imobiliária responsável
  - proprietário
- Resultado esperado: ausência de campo nunca quebra UI; no máximo mostra “indisponível”.

3. Revisar mapa e busca por bounds de ponta a ponta
- Validar e corrigir o contrato entre:
  - `SearchMapBox`
  - `ImoveisPage`
  - `fetchMapPinsRemote`
  - `fetchSiteImoveisRemote`
- Testar e ajustar:
  - clique em cluster
  - clique em pin
  - preview aberto pelo mapa
  - arrastar mapa + “Buscar nessa região”
  - “Buscar ao mover”
  - desenho de área e limpeza do desenho
- Verificar se o fallback de pins por bairro não gera inconsistência com a lista.

4. Reduzir latência percebida da página
- Priorizar o conteúdo útil antes do mapa pesado.
- Possíveis ajustes a implementar:
  - lazy load do mapa/Mapbox após primeiro paint
  - adiar montagem do mapa até a área estar visível
  - reduzir consultas duplicadas de `slug_ref` e dados auxiliares por card/drawer
  - revisar se hooks como `useBrokerSlug` estão disparando fetchs repetidos em massa
- Objetivo: melhorar velocidade percebida sem reescrever a página.

5. Revalidar vitrine pela UI
- Após estabilizar drawer e mapa, retestar o fluxo completo:
  - entrar em modo vitrine
  - selecionar imóveis na grade
  - gerar vitrine
  - copiar link
  - abrir link público
  - checar se snapshot renderiza todos os imóveis
- Se necessário, ajustar mensagens de sucesso/erro para deixar claro quando a criação foi parcial.

6. Conferir dados que o corretor precisa enxergar
- Garantir no drawer:
  - origem do imóvel
  - status Jetimob
  - corretor responsável
  - classificação “próprio/parceiro”
  - imobiliária responsável
  - observações internas
  - proprietário apenas para perfil autorizado
- Revisar formatação para não exibir JSON cru ao usuário.

Validação final que vou executar após aprovação
1. Desktop
- abrir /imoveis
- medir carregamento percebido
- abrir drawer sem crash
- expandir ficha técnica
- validar responsável/origem/corretor/imobiliária
- clicar em pin do mapa
- mover mapa e buscar por região
- desenhar área e buscar
- gerar vitrine e abrir link público

2. Mobile
- abrir /imoveis em viewport móvel
- validar mapa/lista/barra inferior
- abrir drawer
- testar seleção e vitrine
- confirmar que dados internos continuam acessíveis sem quebrar layout

Sugestões de funcionalidades novas
1. Painel de confiabilidade do imóvel
- selo visual no card/drawer mostrando qualidade do cadastro:
  - fotos ok
  - coordenadas ok
  - corretor ok
  - origem ok
  - dados internos completos
- ajuda o corretor a priorizar imóveis mais vendáveis.

2. Modo “mapa inteligente para corretor”
- destacar no mapa imóveis:
  - próprios Uhome
  - parceiros
  - anúncio novo
  - com melhor comissão/peso comercial
- isso transforma o mapa em ferramenta comercial, não só busca.

3. Vitrine com contexto comercial rápido
- ao selecionar imóvel para vitrine, mostrar mini-resumo:
  - faixa de preço
  - tipo de imóvel
  - bairros cobertos
  - quantos são próprios vs parceiros
- melhora muito o controle antes de gerar o link.

4. Insights do imóvel no drawer
- bloco curto tipo “oportunidade comercial” com sinais como:
  - recém-publicado
  - sem corretor local
  - parceiro
  - faixa de preço atrativa
  - bairro com alta oferta
- útil para priorização pelo corretor.

5. Camada de mapa por estratégia
- filtros rápidos no mapa:
  - só próprios
  - só parceiros
  - só novos
  - só com tour/vídeo
  - só com financiamento
- isso tende a aumentar a usabilidade mais do que adicionar mais filtros no topo.

Detalhes técnicos
- Arquivos mais prováveis da correção:
  - `src/components/imoveis/BrokerTechnicalSheet.tsx`
  - `src/components/imoveis/PropertyPreviewDrawer.tsx`
  - `src/components/imoveis/SearchMapBox.tsx`
  - `src/pages/ImoveisPage.tsx`
  - `src/hooks/useBrokerSlug.ts`
  - `src/services/siteImoveisRemote.ts`
  - `src/utils/imoveisFormat.ts`
- Não há necessidade inicial de migration de banco.
- A prioridade imediata é corrigir o crash do drawer, depois fechar a auditoria funcional completa do mapa e da vitrine.

Resultado esperado final
- A página /imoveis deixa de quebrar ao abrir preview.
- O corretor consegue ver dados internos com segurança.
- O mapa fica confiável para busca por região.
- A vitrine funciona de ponta a ponta pela UI.
- A página fica perceptivelmente mais rápida e estável.