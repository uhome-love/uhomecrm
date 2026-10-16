# Oferta Ativa — corretor escolhe o empreendimento para ligar

## Como está hoje
- A tela de entrada do corretor mostra uma campanha em destaque e a lista das outras campanhas ativas.
- Existe o link "Ver todas as listas", que já agrupa as listas por empreendimento, mas fica escondido e não tem filtro rápido.
- Na prática o corretor não tem um "escolha o empreendimento" claro logo de cara.

## O que vamos fazer
1. **Mockup primeiro** (para sua aprovação antes de mexer): seletor de empreendimento no topo da tela de entrada da Oferta Ativa.
2. **Seletor de empreendimento** em pílulas no topo ("Todos", "Open Arvoredo", "Casa Tua", ...), mostrando só empreendimentos que têm campanha ativa com leads disponíveis, com a quantidade de leads ao lado.
3. Ao tocar num empreendimento, a tela mostra só as campanhas dele; se houver uma só, o botão "Começar a ligar" já abre direto nela.
4. A escolha fica lembrada no aparelho do corretor para a próxima vez.
5. Script e ficha rápida já seguem o empreendimento da campanha escolhida (sem mudança).

## O que NÃO muda
- Quem cria campanha continua sendo gestor/admin.
- Regras de fila, cooldown, base fria e exclusividade com o Pipeline continuam iguais.
- Lake Baikal / Fila CEO não são afetados.
- Mutirão Ao Vivo não muda (já tem filtro próprio).

## Validação
- Testar no preview com conta de corretor: trocar empreendimento, conferir campanhas e abrir a tela de ligação, sem registrar tentativa em lead real (Cancelar).

## Detalhes técnicos
- Só frontend em `CorretorEntrada.tsx` (agrupar campanhas por `empreendimento`, ignorando rótulos genéricos já tratados por `ehRotuloGenerico`); preferência em localStorage.
- Sem migration, sem mudança em edge function.
