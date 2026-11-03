# Missão de Natal recolhida mais compacta no celular

Sim, o celular está mostrando a versão certa: a Missão vem recolhida, com o valor, a meta e o botão "Ver detalhes". No celular, porém, a faixa recolhida ainda fica alta demais, com 5 linhas, porque as informações quebram linha.

## Ajuste proposto (só aparência, só quando recolhida)
- Na linha 1 ficam a chave, "Minha Missão de Natal" e "Faltam 46 dias", lado a lado.
- Na linha 2 ficam "R$ 0 de R$ 1 mi (0%)" e a barrinha dourada.
- Na linha 3 ficam os botões "Minha meta" e "Ver detalhes", lado a lado e do mesmo tamanho.
- A frase "Campanha de 01/11 a 18/12 · atualiza sozinho…" aparece só quando aberta.
- Aberta, a Missão continua igual a hoje. O computador não muda.

## Detalhes técnicos
- `src/natal/MissaoNatalCard.tsx`: quando `!expandido`, usar um cabeçalho compacto (ícone `h-7`, título `text-sm`, chip de dias inline), esconder o subtítulo e reorganizar os botões em `grid grid-cols-2`.
- Conferir no Playwright com tela de 390px, recolhida e aberta, sem salvar meta.
