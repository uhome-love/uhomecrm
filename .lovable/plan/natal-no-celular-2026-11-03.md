# Natal no celular

## Hoje no celular
Já aparecem: as luzes no topo, o gorro na foto do corretor, o aviso "Faltam X dias" e o quadro "Minha Missão de Natal". Os painéis do CEO, da diretora e do gerente usam a mesma tela do computador, então já mostram o Natal.

Ainda faltam:
- o gorro no logo do topo, porque no celular não existe a barra lateral;
- o cartão azul-noite da saudação, porque no celular ela é só texto.

## O que muda (ver desenho)
1. **Logo do topo:** gorro pequeno e inclinado no logo Uhome, só no celular.
2. **Saudação do corretor no celular:** vira um cartão azul-noite com neve leve e borda dourada. Ele mostra a foto com gorro, "Boa noite, Nome", a frase do dia, o aviso dourado "🎁 Faltam X dias para 18/12" e o Homi de Noel no canto. Abaixo dele continuam a próxima visita e os atalhos redondos.
3. **Luzes:** conferir que não ficam por baixo da área do relógio/notch do iPhone.

Tudo só aparece com os efeitos de Natal ligados. Fora do período, o celular volta exatamente ao que é hoje.

## O que não muda
Números, regras, barra inferior, telas de computador.

## Detalhes técnicos
- `src/components/AppLayout.tsx`: envolver `UhomeLogo` do cabeçalho em `relative` e colocar `<GorroNatal>` visível só em `md:hidden`. Posicionar `FaixaLuzesNatal` respeitando `--sat`.
- `src/pages/CorretorDashboard.tsx`: no bloco `isMobile`, usar o cartão `natal-noite natal-borda-ouro` + `NeveSuave` + Homi quando `natal.efeitos`. Caso contrário, manter o layout atual.
- Validação no celular (390x844): conferir Minha Rotina e o painel do gerente.
