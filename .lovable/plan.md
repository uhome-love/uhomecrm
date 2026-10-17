# Corrigir selo "Sem credencial · sábado" de quem está credenciado

## O que acontece
O Anderson está credenciado e aprovado na Roleta noturna de hoje (aprovado às 19h29). Ele recebe leads normalmente: "Ativo na Roleta" está certo.
O selo cinza "Sem credencial · sábado" está errado. No sábado, ele só procura credenciamento do tipo "dia todo" e ignora manhã, tarde e noturna.

## Correção (só no texto do selo)
- No sábado, mostrar "Presente · sábado" se o corretor tiver qualquer credenciamento aprovado no dia (manhã, tarde, noturna ou dia todo).
- Domingo e dias de semana continuam iguais.
- Nada muda na Roleta, na distribuição, nas regras ou no credenciamento.

## Validação
Abrir a tela de um corretor de teste no preview e conferir o selo, sem credenciar ninguém.

## Detalhes técnicos
`src/components/corretor/PresencaDoCorretorPill.tsx`: no ramo `regime === "sabado"`, trocar `credAprovadoDiaTodo` por `creds.some(c => c.status === "aprovado")`.
