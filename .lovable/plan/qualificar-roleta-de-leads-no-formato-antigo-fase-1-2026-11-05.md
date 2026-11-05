# Qualificar "Roleta de Leads" no formato antigo (fase 1)

Mantém a estrutura antiga: título da seção, linha de 5 números e linha de 3 cartões (Empreendimento, Origem, Corretor). Só esta seção nesta fase.

## O que muda
1. **Visual novo nas peças**: números e cartões com o acabamento da marca nova (mesmo lugar, mesmo tamanho). Sem a borda colorida lateral.
2. **Alturas iguais**: os 3 cartões da linha ficam com a mesma altura, com rolagem interna discreta quando a lista for longa; a "Soma" fica sempre no rodapé, alinhada nos três.
3. **Menos repetição**: sai "Leads Gerados (Mkt)" desta linha (já está no topo). No lugar entra "Fila CEO" (quantos aguardam, clique abre a distribuição).
4. **Mais informação útil** (só com números que o painel já tem):
   - % de cada origem e de cada empreendimento ao lado da quantidade.
   - Comparação com o período anterior em "Enviados p/ Roleta" quando existir.
   - No cartão de corretores: quantos corretores receberam leads e a média por corretor.

## O que NÃO muda
- Cálculos, filtros, período e o que abre ao clicar.
- Celular, demais seções e tema de Natal.

## Ordem
1. Desenho desta seção para aprovação.
2. Construir e conferir ao vivo como CEO (claro e escuro), comparando os números.
3. Depois, repetir o mesmo padrão nas próximas seções, uma por vez.

## Detalhes técnicos
- Alterar só `DesktopLeads.tsx` (e o cartão Marketing de `DesktopDados.tsx` se a repetição exigir), usando `src/components/ds`.
- Comparação só aparece se o controlador já tiver o valor anterior; nada de novas consultas.
