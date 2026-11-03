# Campanhas de Natal no Meta: Essence Canoas e Casa Tua Porto Alegre

## O que encontrei hoje
- **Casa Tua Porto Alegre:** está cadastrado e ativo, com vários apelidos de campanhas antigas (v3, v4, Junho...). Ainda **não existe** o apelido "Casa Tua Porto Alegre — Natal". Hoje o lead até pode cair certo pela palavra "Casa Tua", mas há risco de virar Casa Tua Canoas ou ficar sem produto.
- **Essence Canoas:** **não existe** como empreendimento ativo. Só há o "Essence Condomínio Clube", criado por uma venda, inativo e fora de Roleta, Foco e anúncios. Leads dessa campanha hoje chegariam **sem produto** e não aparecem no Foco.
- Nenhum lead das duas campanhas de Natal chegou ainda.

## O que vou fazer (fase única, com conferência ao final)
1. **Essence Canoas:** cadastrar como empreendimento oficial ativo (Canoas), ou reaproveitar o "Essence Condomínio Clube" ativando-o — decisão sua abaixo.
2. **Apelidos das campanhas:** ligar "Essence Canoas - Natal" ao Essence e "Casa Tua Porto Alegre — Natal" (com travessão e com hífen) ao Casa Tua Porto Alegre, para campanha, conjunto e formulário.
3. **Roleta:** incluir Essence no mapeamento de campanhas da Roleta (mesmo segmento que você indicar); conferir que Casa Tua Porto Alegre segue mapeado.
4. **Fila CEO:** conferir se algum dos dois deve ir só para a Fila CEO (como Golden Lake). Por padrão, não mudo.
5. **Foco Corretores:** confirmar que os dois aparecem para ativar no Foco e no match de empreendimentos.
6. **Outros lugares:** seletores de empreendimento (pipeline, visitas, vitrine, Dados de Anúncios), Materiais e gasto diário do Meta.
7. **Teste:** lead fictício de cada campanha passando pela entrada do Meta → produto correto no lead → Roleta/Fila → depois apago o lead.

## Preciso de você
- Essence: ativar o "Essence Condomínio Clube" existente ou criar um novo "Essence Canoas"?
- Algum dos dois vai só para Fila CEO, ou entra na Roleta normal?

## Detalhes técnicos
- Tabelas: `empreendimentos_canonicos`, `empreendimento_aliases` (tipos campanha/conjunto/formulario/empreendimento_texto), `roleta_campanhas`, `roleta_config.fila_ceo_obrigatoria_canonicos`.
- Só inserção de dados (sem mudança de estrutura). Gatilho de produto recalcula pelo campo `campanha`.
