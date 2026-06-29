# Ajuste visual da navegação de grupos — Central de Roleta

## Problema
Na Central de Roleta, os grupos **Operação · Leads · Inteligência · Config** aparecem amontoados à esquerda, parecendo texto solto em vez de um controle de navegação claro. As sub-abas logo abaixo aumentam a sensação de bagunça.

## Solução (apenas frontend, 1 arquivo)
Arquivo: `src/components/roleta/ceo/CentralRoletaCeo.tsx`

1. **Segmented control mais nítido**: dar ao grupo de abas um visual de "pills" bem definidas — fundo do container mais evidente, cada item com largura/padding consistentes, item ativo com contraste claro (card + sombra) e inativos com hover perceptível. Garantir respiro entre os botões.

2. **Separar visualmente os dois níveis**: adicionar uma divisória sutil / espaçamento entre a linha de grupos (Operação/Leads/Inteligência/Config) e a linha de sub-abas (Roleta ao vivo / Leads pendentes / Bloqueados), para não ficarem coladas e "tudo junto".

3. **Sub-abas como linha secundária**: deixar a linha de sub-abas com peso visual menor (estilo "underline"/texto secundário) para reforçar a hierarquia grupo → sub-aba.

4. **Responsivo**: manter `flex-wrap`/scroll horizontal no mobile sem quebrar.

## Fora de escopo
Sem mudanças em banco, RLS, edge functions ou lógica de navegação — apenas estilo/layout dos controles existentes.