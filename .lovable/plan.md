# Fase 3 — Peças da marca no Painel CEO (só visual)

## O que muda
- Só a aparência da versão de computador do Painel CEO: cabeçalho, indicadores, Leads, Visitas, Negócios, Oferta Ativa e Dados passam a usar as peças aprovadas em "Peças da marca".
- Cores variadas em listas e funis, emojis e o tema de Natal continuam.
- Tema claro e escuro conferidos.

## O que NÃO muda
- Números, filtros, períodos, botões e ações: tudo igual.
- O celular continua com o layout já aprovado.
- Os painéis de gerente e diretora ficam para uma próxima fase.

## Ordem (uma etapa por vez, com sua conferência)
1. Desenho do novo Painel CEO para você aprovar (imagem).
2. Cabeçalho + indicadores do topo.
3. Leads e Visitas.
4. Negócios, Oferta Ativa e Dados.
5. Conferência ao vivo como CEO, nos dois temas, comparando os números antes/depois.

## Detalhes técnicos
- Trocar só a apresentação em `src/components/ceo/dashboard/Desktop*.tsx` por `src/components/ds/*`; `useCeoDashboardController` fica intacto.
- Nenhuma alteração no banco, consultas ou regras.
