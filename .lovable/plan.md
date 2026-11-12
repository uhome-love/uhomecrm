# Ligar pelo discador + sugestão de tarefa após registrar atividade

## 1. Botão "Ligar" no celular abre o discador
Hoje: no celular, "Ligar" abre direto a janela com script e "Atendeu / Não atendeu", sem discar.

Novo fluxo (só celular):
1. Corretor toca em "Ligar" → abre o discador do telefone com o número do cliente.
2. Ao mesmo tempo o CRM guarda "ligação em andamento" para aquele lead.
3. Quando o corretor volta para o app, abre automaticamente a janela "Como foi a ligação?" (Atendeu / Não atendeu → registrar → próximo passo), igual à de hoje.
4. O script continua acessível dentro dessa janela (recolhido), para quem quiser consultar.
5. Se voltar sem ligar, ele pode fechar a janela normalmente (nada é registrado sozinho).

No computador nada muda (continua abrindo a janela com o script).

## 2. Pop-up "Criar tarefa?" após registrar atividade
Na ficha do lead, depois de registrar uma atividade com texto no campo livre:
- Aparece pop-up: "Quer criar uma tarefa para esse cliente?" com botões **Criar tarefa** e **Agora não**.
- "Criar tarefa" abre o formulário de tarefa já existente, com a observação registrada sugerida no texto.
- "Agora não" fecha. Não aparece se o lead já tiver tarefa pendente futura (para não incomodar).

Nenhuma regra de pontuação, etapa, Roleta ou saúde do CRM muda.

## Ordem (conforme padrão)
1. Mockup das duas telas (celular) para aprovação.
2. Construção em 2 fases (ligação, depois pop-up).
3. Validação no celular 390px e computador, com lead de teste, cancelando sem salvar.

## Detalhes técnicos
- PipelineLeadDetail: os 3 pontos que chamam `setIsCallOpen(true)` passam por `iniciarLigacao()`; em mobile (`useIsMobile`) faz `window.location.href = tel:`, grava `sessionStorage` {leadId, ts} e escuta `visibilitychange`/`focus`; ao voltar (até 2h) abre `CallFocusOverlay` direto na etapa de resultado (nova prop `iniciarEmResultado`, script em acordeão).
- Pós-registro: `RegistroRapido` e `RegistrarAtividadeModal` (no drawer) chamam `onRegistrado(texto)`; o drawer mostra `AlertDialog` e abre o fluxo de nova tarefa existente, consultando tarefas pendentes do lead para suprimir.
