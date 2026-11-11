# Linha do tempo · destaque nos marcos, sem exagero (só visual)

Sem migration, sem mudar o que é gravado. Só LeadHistoricoTab.tsx e src/lib/timelineNarrativa.ts.

## 1. Cor do círculo (tokens do tema, claro e escuro)
A função que escolhe o ícone passa a devolver também o tom e se o item é marco:

| Tom | Itens | Símbolo |
|---|---|---|
| Azul (primary) | Lead entrou | 🎯 |
| | Avançou de etapa | seta atual |
| | Visita agendada | 📅 |
| Verde (success) | Visita realizada | 📍 |
| | Ganho | 🏆 |
| Laranja (warning) | Voltou de etapa | ícone de volta |
| | Não compareceu | ícone atual |
| | "X dias sem registro" | igual hoje |
| Vermelho (danger) | Descarte | ❌ |
| | Caiu | ícone, sem emoji |
| Cinza (igual hoje) | Ligação, WhatsApp, e-mail, presencial, nota, contrato/proposta/documentação atualizados, tarefas | ícone atual |

Emoji só nesses 5: 🎯 📅 📍 🏆 ❌.

## 2. Peso
- Marcos: título em negrito. A caixa de baixo continua cinza.
- Rotina: título em peso normal (hoje todos estão em negrito). Fora isso, igual hoje.
- Ganho: caixa com fundo verde bem suave e borda verde fina, título "🏆 Venda assinada" e o valor do negócio, quando a ficha já tiver esse valor.
- Automático (só em "Tudo"): uma linha só, menor, sem caixa, autor "Automático".

## 3. Texto legível (só na exibição)
- "Valor: 1100000" → "R$ 1,1 mi"; até R$ 999 mil → "R$ 735 mil".
- Códigos: "em_confeccao" → "Em confecção", "gerado" → "Gerado", "EM vistoria" → "Em vistoria". O _ vira espaço e as maiúsculas ficam certas; os acentos comuns ficam num pequeno dicionário.
- Formulário do Meta: "casa_3_dorms_-_130m2" → "Casa 3 dorms · 130 m²". Se não reconhecer, só tira os _.
- Contrato atualizado: se o produto e a unidade forem iguais ("Avulso · Unidade: avulso"), aparece só uma vez.

## Detalhes técnicos
- Em timelineNarrativa.ts:
  - `iconeDoMarco` passa a retornar `{ icone, emoji?, tom, marco }`.
  - Novas funções puras: `valorCurto`, `codigoLegivel`, `respostaFormLegivel` e `limparDescricaoContrato`, com testes unitários.
- O LeadHistoricoTab usa esse retorno para montar as classes com tokens (`bg-primary/10 text-primary`, `bg-success-500/15 text-success-700 dark:text-success-500`, warning e danger no mesmo padrão).

## Testes (desktop, celular 390 px, claro e escuro, sem salvar)
- **Eraldo:** só o Ganho com caixa verde e 🏆; contratos em cinza, legíveis e com R$.
- **Leonardo:** "Voltou para Aquecimento" com círculo laranja e visita realizada com 📍 verde; WhatsApp e notas em cinza.
- **Danielle:** 🎯 azul na entrada e formulário legível.

## Fora deste plano (apenas aviso)
A visita do Eraldo aparece como "Para 10 nov", mas está marcada para 11/11. Proponho corrigir em seguida, só se você aprovar.
