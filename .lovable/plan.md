# Topo do Painel CEO no celular (só visual)

Desenho aprovado: Mockup_Topo_Painel_CEO_Celular.png. Vale só para telas de celular (até 767 px). O computador não muda. Nenhum número, filtro ou regra muda.

## O que muda no celular
1. **Saudação (cartão azul):**
   - Linha 1: foto (48 px) ao lado de "Boa noite, Lucas! 🌙", com a frase em até 2 linhas na largura toda.
   - Linha 2: "🎁 Faltam 37 dias · 18/12", botão "Hoje ▾" e hora da atualização, na mesma linha (quebra só se não couber).
   - Gorro de Natal e neve continuam.
2. **Missão de Natal:** cartão mais baixo. Título e "01/11 a 18/12 · resumo da empresa" à esquerda e o botão com o valor (R$ 70,6 mi ▾) à direita, abrindo o mesmo detalhe de hoje. No celular, sai a pill "Faltam 37 dias" repetida (já aparece na saudação).
3. **Períodos:** "Hoje, Ontem, Semana, Mês, 30 dias, Personalizado" numa fileira única que desliza para o lado, sem quebrar em duas linhas.
4. Fila CEO, Roleta e o restante continuam iguais.

## Fora do escopo
Cálculos, permissões, distribuição, demais painéis (gerente/diretora usam o mesmo cartão de saudação: a mudança vale para eles também só no celular, sem mudar o conteúdo).

## Validação
Ao vivo como CEO em 360, 390 e 430 px, claro e escuro, mais 1280 px para confirmar que o computador está igual. Trocar de período e abrir a Missão sem salvar nada.

## Detalhes técnicos
- `src/components/ui/GreetingBar.tsx`: layout em duas linhas abaixo de `md` (classes responsivas), desktop intacto.
- `src/natal/MissaoNatalEmpresa.tsx`: variante compacta abaixo de `md`, escondendo a pill duplicada.
- `src/components/GlobalDateFilterBar.tsx` (variante header): `flex-nowrap overflow-x-auto` abaixo de `md`.
- Só tokens do design system; sem migration.
