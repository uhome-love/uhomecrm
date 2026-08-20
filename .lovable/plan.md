# Arte do `awa_disparo2` não aparece na Central de Reengajamento

## O que já verifiquei

- O mapa de artes no CRM **já tem** a entrada `awa_disparo2`, apontando para
  `campaign-images/reengajamento/awa-disparo2.png`.
- Essa URL **responde 200** e a imagem está no ar (PNG de ~2,7 MB).
- Ou seja: o link existe. O que falta é o template aparecer para seleção — a Central só lista
  templates com status **APPROVED** na Meta, e o `awa_disparo2` estava "Em análise". Enquanto ele
  não é aprovado, não dá para selecioná-lo e o campo de imagem continua vazio.

## O que vou fazer

1. **Conferir o status atual do `awa_disparo2` na Meta** (aprovado ou ainda em análise) e te dizer
   exatamente qual dos dois casos é.
2. **Trocar a arte pela imagem que você acabou de enviar**, salva em JPG otimizado (abaixo de ~500 KB)
   no mesmo caminho do bucket público — o PNG atual de 2,7 MB é pesado e pode falhar/atrasar no envio
   da Meta.
3. **Atualizar o mapeamento** do template para a nova arte, para que ao selecionar `awa_disparo2` a
   URL do header já venha preenchida sozinha.
4. **Validar ao vivo** em `/central-nutricao` → aba Disparo manual: abrir o seletor de templates,
   selecionar o `awa_disparo2` (se já aprovado) e conferir que a imagem carrega no preview.
   **Sem disparar nada.**

## Detalhes técnicos

- Upload no bucket público `campaign-images`, pasta `reengajamento`, arquivo `awa-disparo2.jpg`
  (conversão/compressão local antes do upload).
- `src/components/central-nutricao/DisparoCustomizadoCard.tsx`: ajustar a entrada `awa_disparo2`
  em `TEMPLATE_HEADER_IMAGES` para a nova URL `.jpg`.
- Sem migration, sem alteração de edge function, sem mudança no motor de disparo.
- `src/lib/reengajamentoEmpreendimento.ts` não muda (a regra `awa` já rotula o lead como **AWA**).
