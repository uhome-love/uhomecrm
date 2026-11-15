# Interesse resumido também no cartão do lead

## Como fica
No cartão do Pipeline (computador e celular), a linha do produto passa de
"Interesse declarado: apartame..." para **"Interesse: Apto Auxiliadora até 300mil"**,
usando o mesmo resumo da Fila CEO. O texto completo aparece ao parar o mouse em cima.
Produtos normais (Casa Tua, Orygem...) continuam iguais. Ficha do lead e dados gravados não mudam.

## Validação
Abrir o Pipeline e conferir o cartão da Vitória no computador e no celular (390px), sem clicar em nada que altere o lead.

## Detalhes técnicos
`CardMinimal.tsx` linha ~493: exibir `resumirInteresseDeclarado(empreendimento)` com `title={empreendimento}`. A variável `empreendimento` usada em outros cálculos fica intacta.
