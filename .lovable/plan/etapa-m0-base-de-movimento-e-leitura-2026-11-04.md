# Etapa M0 — Base de movimento e leitura

Onda A concluída. Próxima etapa da ordem aprovada: A → **M0** → B → M1 → C → M2 → M3 → Rodada 2.

M0 não mexe em nenhum dado, número ou regra do CRM. Só muda como as telas se movem e como os textos pequenos são lidos.

## O que muda para quem usa

1. **Movimentos com o mesmo ritmo em todo o CRM**
   Quatro velocidades padrão: rápida (botões), curta (menus), média (janelas) e longa (troca de página). Hoje cada tela usa um tempo diferente.

2. **Respeito ao "Reduzir movimento" do celular/computador**
   Quem desliga animações no aparelho passa a ver o CRM inteiro parado, não só alguns pedaços.

3. **Cartão só "sobe" com o mouse se der para clicar nele**
   Cartões de número (totais, indicadores) ficam parados. Cartões clicáveis (lead, imóvel, aula) continuam reagindo.

4. **Piscar só onde importa**
   Fica apenas em "ao vivo" e "atrasado". Tira o piscar decorativo das demais telas.

5. **Letra mínima de 11 px**
   Selos e textos de apoio menores que isso passam para 11 px, começando pelo cartão do lead no Pipeline e pela Minha Rotina.

## Fora desta etapa
- Nenhuma mudança de cor, marca (#4969FF e Inter mantidos), layout ou conteúdo.
- Enfeites de Natal mantêm a animação deles, mas também param com "Reduzir movimento".

## Como valido antes de dizer que está pronto
- Antes de construir: desenho comparando antes/depois do cartão do Pipeline e da Minha Rotina para sua aprovação.
- Depois: abrir CEO, Pipeline, Minha Rotina e Placar em 1280 e 1920, claro e escuro, e no celular; conferir que nenhum número mudou e que nada ficou cortado com a letra maior.
- Teste com "Reduzir movimento" ligado.

## Detalhes técnicos
- Tokens novos em `src/index.css` (`--motion-fast/short/medium/long` = 100/160/240/400 ms e curvas de entrada/saída/movimento) e mapeados no `tailwind.config.ts`.
- Regra global `@media (prefers-reduced-motion: reduce)` zerando animações e transições, inclusive `src/natal/`.
- `KpiCard` sem efeito de hover; hover de elevação só em cartões com `onClick`/link.
- `animate-pulse` removido de usos decorativos; mantido em indicadores ao vivo/atraso e esqueletos de carregamento.
- Trocar `text-[9px]`/`text-[10px]` por `text-[11px]` em `CardMinimal.tsx` e componentes da Minha Rotina; demais páginas entram na Onda C.
