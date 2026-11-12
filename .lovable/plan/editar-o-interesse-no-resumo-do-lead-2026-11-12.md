# Editar o "Interesse" no Resumo do Lead

## O que o corretor vai poder fazer
Na ficha do lead, em "Resumo do lead", ao lado de **Interesse** aparece um lápis. Ao tocar:
- **Escolher da lista** de empreendimentos ativos (mesma lista oficial usada no CRM, com busca).
- **Digitar manualmente** um nome, quando o produto não está na lista.
- Botões **Salvar** e **Cancelar**. Ao salvar, o resumo atualiza na hora e fica registrado na linha do tempo: "Interesse alterado de Casa Tua para X por [corretor]".

Funciona igual no computador e no celular (no celular abre como painel embaixo).

## O que NÃO muda
- Etapa do lead, corretor responsável e Roleta não mudam.
- Origem e campanha original do anúncio continuam visíveis no histórico.

## Fases
1. **Desenho (mockup)** do lápis e do seletor, para sua aprovação antes de qualquer código.
2. Construção após aprovação do desenho.
3. Validação ao vivo com lead de teste, computador e celular 390px, conferindo que o interesse novo não volta para o antigo ao recarregar.

## Detalhes técnicos
- O produto do lead é recalculado por gatilho a partir de `campanha`/`formulario`/`anuncio`; por isso o salvamento grava `empreendimento` e `campanha` juntos (e `empreendimento_canonico_id` quando escolhido da lista; nulo quando manual), senão o valor antigo volta.
- Gravação por uma função de servidor com checagem de acesso ao lead (`can_access_lead`) e registro em `pipeline_historico`/atividade.
- UI em `ResumoLeadLateral.tsx` com componente novo pequeno (popover/sheet), sem mexer no restante da ficha.
