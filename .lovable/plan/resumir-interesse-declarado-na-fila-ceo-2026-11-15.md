# Resumir "Interesse declarado" na Fila CEO

## O que muda (só visual, nada de regra)
Na janela da Fila CEO, o título do grupo de leads do site hoje mostra o texto inteiro
("Interesse declarado: apartamento/garden/cobertura/casa/casa condom...") e estoura a largura,
criando barra de rolagem lateral.

Passa a mostrar assim:

```text
[icone] Interesse do site · Apartamento +4 tipos        1 lead
```

- Mostra só o 1º tipo de imóvel e "+N tipos" quando houver mais.
- Se tiver bairro ou faixa de preço no texto, acrescenta curto: "· Auxiliadora +4 · até R$ 300 mil".
- Texto completo aparece ao passar o mouse (computador) ou tocar (celular).
- A janela deixa de ter rolagem lateral: títulos longos sempre cortam com "...".
- Produtos normais (Casa Tua, Orygem etc.) continuam iguais.
- O lead continua com o interesse completo gravado na ficha; nada muda na distribuição.

## Validação
Abrir a Fila CEO com a Vitória no computador (1410px) e celular (390px), conferir título curto,
texto completo no toque e sem rolagem lateral. Só abrir e fechar, sem disparar.

## Detalhes técnicos
- Nova função pura `resumirInteresseDeclarado(nome)` em `src/lib/` + teste (ex.: texto da Vitória → "Apartamento +4 tipos").
- `FilaCeoDispatchModal.tsx` linha ~657: usar o resumo com `title`/tooltip do nome completo; adicionar `min-w-0` nos contêineres flex para acabar com o overflow horizontal.
