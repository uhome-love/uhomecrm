# Deixar o template `awa_reengajamento_v1` pronto para disparo

## O que já verifiquei (estado atual)

- A Central de Reengajamento está **destravada**: `paused = false`, `paused_until_release = false`, sem motivo de pausa.
- O template **não está na lista de bloqueados** (hoje só `casatua_maio` e `reativacao_opcoes_perfil_v2`).
- Na Meta o template aparece como **Ativo — Qualidade pendente** (normal para template novo), com imagem de header, corpo com a variável `{{1}}` (nome) e os dois botões Sim/Não.

Faltam duas amarrações no CRM:

1. A arte não está mapeada ao template — ao selecionar `awa_reengajamento_v1` a URL da imagem de header vem **vazia**, e você teria que colar na mão.
2. Não existe regra de empreendimento para "awa" — quem responder **SIM** cairia na Fila do CEO **sem o rótulo do produto**.

## O que vou fazer

1. **Subir a arte** (a imagem anexada) para o bucket público de imagens de campanha como `campaign-images/reengajamento/awa-reengajamento-v1.jpg`.
2. **Mapear template → imagem**: ao escolher `awa_reengajamento_v1` na Central, o header já vem preenchido sozinho.
3. **Cadastrar o empreendimento canônico "AWA"** (construtora ABF) na lista de empreendimentos, para poder ser usado em filtros, alocação e rótulos.
4. **Rotular o produto no reengajamento**: templates com "awa" passam a ser rotulados como **AWA** na Fila do CEO. Quem responder SIM segue o fluxo padrão (SIM → Fila do CEO, já com o produto AWA).
5. **Validar ao vivo** no preview `/central-nutricao`: selecionar o template, conferir que a imagem aparece no preview, que não há aviso de bloqueio/pausa e que o botão de disparo fica habilitado — **sem disparar nada**.

## Detalhes técnicos

- Upload em bucket público `campaign-images`, pasta `reengajamento`.
- `src/components/central-nutricao/DisparoCustomizadoCard.tsx`: nova entrada em `TEMPLATE_HEADER_IMAGES` para `awa_reengajamento_v1`.
- `src/lib/reengajamentoEmpreendimento.ts`: nova regra `awa` → "AWA" (match por palavra, para não colidir com outros nomes que contenham "awa").
- `src/lib/empreendimentos.ts`: incluir "AWA" na lista (ordem alfabética).
- Insert de 1 linha em `public.empreendimentos_canonicos` (nome "AWA", ativo) — DML, sem migration de schema.
- Sem alteração de edge function e sem mudança no motor de disparo.
