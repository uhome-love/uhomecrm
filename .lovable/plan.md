# Interesse ainda mais curto na Fila CEO

## Como fica
Antes: "Interesse do site · Apartamento +5 tipos · Auxiliadora +mais · até R$ 300 mil"
Depois: **"Interesse: Apto Auxiliadora até 300mil"**

Regras do resumo:
- Começa com "Interesse:".
- Tipo: só o 1º, abreviado (apartamento → Apto, casa condominio → Casa cond., cobertura → Cobert., sobrado, garden, casa ficam iguais). Sem "+N tipos".
- Lugar: só o 1º bairro (ou a cidade: "Porto Alegre", "Canoas"). Sem "+mais".
- Preço: "até 300mil" (tira "R$" e o espaço; "1,2 milhão" vira "1,2mi").
- Ex.: "imóvel em Porto Alegre" → "Interesse: Imóvel Porto Alegre".
- Texto completo continua aparecendo ao passar o mouse; produtos normais seguem iguais.

## Validação
Atualizar os testes com esses exemplos e abrir a Fila CEO no computador e no celular (só abrir e fechar).

## Detalhes técnicos
Ajuste só em `src/lib/resumirInteresseDeclarado.ts` e no teste dela.
