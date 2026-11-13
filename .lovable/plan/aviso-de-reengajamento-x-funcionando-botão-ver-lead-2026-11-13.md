# Aviso de reengajamento: X funcionando + botão "Ver lead"

## O que acontece hoje
A tela de aviso foi feita para sair só pelos botões Ligar e WhatsApp. O X fica escondido e, quando aparece no celular, não faz nada. Por isso o corretor fica preso.

## O que muda
- **X funcionando:** fecha o aviso e marca como visto. O lead continua igual: mesmo corretor, mesma etapa.
- **Novo botão "Ver lead":** fecha o aviso e abre a ficha do lead, sem ligar e sem abrir o WhatsApp.
- **Ligar agora** e **WhatsApp** continuam funcionando como hoje.
- Se houver mais de um aviso, ao fechar um aparece o próximo.
- O X e o "Ver lead" valem no celular e no computador.

## Validação
Com um aviso de teste no meu próprio usuário, conferir no celular (390px) e no computador que o X fecha e que o "Ver lead" abre a ficha. Depois apagar o aviso de teste.

## Detalhes técnicos
- `ReengajamentoInteresseBloqueio.tsx`:
  - Remover `[&>button]:hidden`.
  - `onOpenChange(false)` chama `marcarLido()`, com o mesmo update de `lida` já usado.
  - `confirmar` passa a aceitar `"ver"`, que só navega para a ficha.
  - Esc e o toque fora do aviso continuam bloqueados.
- Atualizar a regra no AGENTS.md: o aviso libera pelo X, por Ver lead, Ligar ou WhatsApp.
