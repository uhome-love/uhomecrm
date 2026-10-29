# Gerente, diretora e CEO podem desfazer parceria

## Como fica na tela (desenho)
```text
Ficha do cliente > selo "Parceria c/ Rafaela"   [ Desfazer parceria ]
   ┌───────────────────────────────────────────┐
   │ Desfazer parceria com Rafaela Sandin?     │
   │ Motivo (obrigatório): [______________]    │
   │ A visita passa a contar 1 só p/ o dono.   │
   │            [Cancelar]  [Desfazer]         │
   └───────────────────────────────────────────┘
```
O botão só aparece para administrador, CEO, diretora e para o gerente da equipe de um dos corretores da parceria. O corretor continua sem poder desfazer.

## Regras
- A parceria nunca é apagada: ela fica encerrada, com data, quem encerrou e o motivo, e isso vai para o histórico do cliente.
- O gerente só pode encerrar parcerias da própria equipe, conferida pela tabela de equipes.
- As contagens da Roleta (0,5 por corretor) passam a considerar só parcerias ativas, então o efeito é imediato.

## Parte técnica
- Função segura `encerrar_parceria(p_parceria_id, p_motivo)` que confere o papel (admin/diretor ou gestor da equipe via team_members), grava encerrada_em/status, anotação e audit_log.
- As permissões de alteração e exclusão continuam só para admin; todo mundo passa pela função.
- Botão + confirmação no selo de parceria (ficha e quadro), usando useParcerias.
- Testes: gerente de outra equipe é bloqueado; corretor é bloqueado; diretora consegue.
- Validação no preview com um cliente de teste, cancelando sempre.
