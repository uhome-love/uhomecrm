Objetivo: estabilizar a página /imoveis de ponta a ponta e fechar o fluxo completo de vitrine até funcionar de forma confiável no preview.

Diagnóstico confirmado
- O erro principal da vitrine hoje está no frontend: a seleção da página está salvando `item.id` (UUID da linha no banco do site) em vez de `item.codigo` (código do imóvel que a bridge espera).
- A prova está no request real capturado: `create_vitrine` recebeu 3 UUIDs e retornou `missing_codes` para os 3 itens, embora a vitrine tenha sido criada.
- Há inconsistência interna no mesmo fluxo:
  - card da listagem seleciona por `item.id`
  - drawer seleciona por `codigo`
  - barra da vitrine assume que tudo está no mesmo conjunto
- Existe também um bug paralelo no preview:
  - warning de React sobre `ref` em `PhotoLightbox`, vindo do `PropertyPreviewDrawer`
- E existe um bug estrutural no consumo da vitrine pública:
  - o snapshot salvo pela bridge não garante um identificador estável por imóvel
  - `VitrinePage` converte `item.id` para número e cai em `0` quando o snapshot só tem `codigo`
  - isso tende a quebrar keys, favoritos, comparação e analytics da vitrine pública mesmo depois que a criação voltar a funcionar

Plano de correção

1. Unificar os identificadores da página Imóveis
- Trocar a seleção da vitrine para usar sempre `codigo` como chave de negócio.
- Ajustar:
  - `ImoveisPage.tsx`
  - `SitePropertyCard.tsx`
  - `PropertyPreviewDrawer.tsx`
- Resultado esperado:
  - selecionar pelo card e pelo drawer afeta o mesmo item
  - contador de selecionados fica consistente
  - `Gerar Vitrine` envia códigos válidos, não UUIDs

2. Blindar o hook de criação da vitrine
- Fortalecer `useCreateVitrine.ts` para validar e normalizar os códigos antes do invoke.
- Remover duplicados e bloquear payloads inválidos cedo, com erro claro em tela.
- Se necessário, registrar no console exatamente quais identificadores estão sendo enviados para facilitar futuros diagnósticos.

3. Tornar a edge function resiliente a payload legado
- Ajustar `supabase/functions/vitrine-bridge/index.ts` para não depender cegamente do frontend.
- Adicionar normalização server-side dos identificadores recebidos, tentando resolver entradas inválidas antes de montar o snapshot.
- Melhorar logs e mensagens de erro para diferenciar:
  - código inexistente
  - identificador inválido
  - falha de snapshot
  - falha de profile/site
- Assim, mesmo se algum ponto da UI voltar a mandar IDs errados, a bridge não quebra silenciosamente.

4. Corrigir o preview do imóvel e a ficha técnica
- Revisar `PropertyPreviewDrawer.tsx` e `BrokerTechnicalSheet.tsx` para garantir que a busca de responsável/origem use o identificador correto e trate ausência de código sem spinner infinito.
- Melhorar estados de loading/erro:
  - carregando
  - não encontrado
  - indisponível para imóveis sem vínculo Jetimob
- Manter a ficha técnica funcional sem travar o drawer.

5. Corrigir o warning do `PhotoLightbox`
- Refatorar `src/components/imoveis/PhotoLightbox.tsx` para suportar `ref` corretamente com `forwardRef` ou remover o caminho que faz o Radix/React tentar anexar ref num function component puro.
- Objetivo: eliminar o warning do console e evitar comportamento estranho no drawer.

6. Corrigir o modelo da vitrine pública para IDs estáveis
- Ajustar `VitrinePage.tsx` e os tipos de showcase para não depender de `Number(item.id) || 0`.
- Passar a preservar um identificador estável por imóvel, priorizando algo como:
  - `codigo`
  - `id` existente
  - fallback determinístico
- Atualizar os componentes públicos que usam `item.id`:
  - `PropertySelectionLayout.tsx`
  - `PropertyCard.tsx`
  - `SafePropertyCard.tsx`
  - `PropertyDetailModal.tsx`
  - `CompareModal.tsx`
  - `ShowcaseMap.tsx`
  - analytics relacionados
- Resultado esperado:
  - sem keys duplicadas
  - favoritos/comparação funcionam
  - tracking não colapsa tudo no imóvel `0`

7. Revisar o fluxo completo da página Imóveis
- Fazer uma passada de estabilidade nos pontos mais sensíveis da tela:
  - abertura do drawer
  - loading do mapa
  - seleção para vitrine
  - geração de link
  - copy/WhatsApp
  - consistência entre desktop e mobile bar
- Corrigir qualquer regressão evidente encontrada durante o teste real do fluxo.

Validação que vou executar depois da aprovação
- Desktop:
  1. abrir /imoveis
  2. abrir preview de imóvel
  3. confirmar que “Responsável / Origem” e ficha técnica carregam
  4. selecionar imóveis tanto pelo card quanto pelo drawer
  5. gerar vitrine
  6. confirmar que a resposta não volta com `missing_codes` para imóveis válidos
  7. abrir o link público da vitrine
  8. confirmar que os imóveis renderizam corretamente e com identificadores distintos
  9. validar copiar link, compartilhar no WhatsApp e listagem em “Minhas Vitrines”
- Mobile:
  1. conferir barra inferior
  2. gerar vitrine com seleção ativa
  3. validar que o comportamento é equivalente ao desktop

Detalhes técnicos
- Arquivos principais envolvidos:
  - `src/pages/ImoveisPage.tsx`
  - `src/components/imoveis/SitePropertyCard.tsx`
  - `src/components/imoveis/PropertyPreviewDrawer.tsx`
  - `src/components/imoveis/BrokerTechnicalSheet.tsx`
  - `src/components/imoveis/PhotoLightbox.tsx`
  - `src/hooks/useCreateVitrine.ts`
  - `src/pages/VitrinePage.tsx`
  - `src/components/showcase/*`
  - `supabase/functions/vitrine-bridge/index.ts`
- Não pretendo mexer no client gerado de backend.
- Vou preservar a arquitetura atual, corrigindo o contrato entre UI, bridge e página pública em vez de reescrever tudo.

Resultado esperado final
- Seleção da vitrine funciona de forma consistente.
- A bridge recebe códigos corretos e gera vitrines com imóveis reais.
- A página pública da vitrine renderiza os imóveis corretamente.
- Preview/ficha técnica/origem deixam de travar.
- O fluxo inteiro da página Imóveis fica testado e validado no preview.
