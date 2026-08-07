# Deixar o template `casatuacanoas_novidade` 100% pronto no Reengajamento

## O que vou fazer

1. **Subir a arte do Casa Tua Canoas** (a imagem que você anexou) para o bucket público de imagens de campanha, no mesmo lugar das outras artes de reengajamento, com o nome `casatuacanoas-novidade.jpg`.
2. **Mapear o template à imagem**: ao escolher `casatuacanoas_novidade` na Central de Reengajamento, a imagem do header já vem preenchida sozinha (hoje ela vem vazia e você teria que colar a URL na mão).
3. **Rotular o empreendimento certo**: hoje qualquer template com "casatua" é rotulado como "Casa Tua" (Porto Alegre) na Fila do CEO. Vou fazer os templates de Canoas serem rotulados como **Casa Tua Canoas**, sem mudar o comportamento dos templates antigos de POA.
4. **Validar antes de liberar**:
   - conferir na Meta se `casatuacanoas_novidade` está **APPROVED** e se tem botões (Sim/Não) — se não estiver aprovado, aviso e não libero;
   - conferir que o template não está na lista de bloqueados e que a Central não está em pausa;
   - abrir o preview em /central-nutricao, selecionar o template e confirmar que a imagem aparece no preview e o botão de disparo fica habilitado.

Não vou disparar nada — quem aperta o botão é você.

## Ponto que preciso confirmar

O lead que responder **SIM** nesse template deve ir para a Fila do CEO já marcado como **Casa Tua Canoas** (é a regra atual: SIM → Fila do CEO). Só confirmo que é isso mesmo, e não roteamento direto para os corretores alocados em Canoas.

## Detalhes técnicos

- Upload em `campaign-images/reengajamento/casatuacanoas-novidade.jpg` (bucket público já existente).
- `src/components/central-nutricao/DisparoCustomizadoCard.tsx`: nova entrada em `TEMPLATE_HEADER_IMAGES` para `casatuacanoas_novidade`.
- `src/lib/reengajamentoEmpreendimento.ts`: regra de `casatuacanoas`/`casa tua canoas` **antes** da regra genérica de `casatua`, retornando "Casa Tua Canoas".
- Validação da Meta via `meta-templates-list` (somente leitura) e leitura de `reengajamento_config` / `blocked_templates`.
- Sem migration de schema e sem alteração de edge function.
