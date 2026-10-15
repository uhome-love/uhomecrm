# Disparo Lake Baikal → Fila CEO → Gabrielle atende com visão só dos leads dela

Nada muda na regra do Lake Baikal (Roleta, corretores atuais e estagnação continuam iguais). Só o fluxo deste disparo.

## O que já funciona hoje (conferido)
- Quem responde "SIM" a um disparo de reengajamento já cai na **Fila CEO**, sem passar pela Roleta.
- No botão **"Repassar manualmente"** da Fila CEO, a **Gabrielle já aparece** na seção "Gestão". Ao repassar, o lead fica com ela, já aceito, com aviso no sino.

## O que falta
Hoje a Gabrielle entra como **diretora** e o Pipeline dela mostra a empresa inteira. Ela não tem o "Modo Corretor" (pipeline e tarefas próprias), que hoje só aparece para alguns gerentes de uma lista fixa.

## O que vai mudar
1. **Menu da Gabrielle:** aparece o bloco **"Modo Corretor"** (Minha rotina, Agenda, Tarefas), sem perder a visão de diretora.
2. **Pipeline com botão "Meus leads":** no Pipeline dela, um botão no topo alterna entre "Empresa" e **"Meus leads"**. Em "Meus leads" ela vê só os clientes repassados a ela (os do Lake Baikal e outros que forem dela), com as mesmas etapas, tarefas e ações de um corretor.
3. Ela atende normalmente: registrar contato, marcar visita, tarefas — tudo dentro do cliente, igual ao corretor.

## Fluxo do dia
```text
Disparo Lake Baikal → cliente responde SIM → Fila CEO
→ você clica "Repassar manualmente" → escolhe Gabrielle
→ lead aparece em "Meus leads" da Gabrielle + aviso no sino
```

## Fases
1. Mockup do menu e do botão "Meus leads" — sua aprovação antes de mexer.
2. Construir (só tela, sem mudar regras de distribuição).
3. Validar com um lead de teste: repassar para a Gabrielle na Fila CEO, conferir que aparece só em "Meus leads" dela, depois devolver/apagar o teste.

## Detalhes técnicos
- Gabrielle: user_id `7882d73e-...`, papéis `diretor` + `gestor`, cargo `gerente`, 18 leads no nome dela hoje.
- `Sidebar.tsx`: `showCorretorMode` hoje exige `role === "gestor"` e lista `CORRETOR_MODE_GESTORES`; incluir a Gabrielle também quando o papel resolvido for `diretor`.
- Pipeline: novo toggle "Meus leads" para admin/diretor/gestor que filtra `corretor_id = auth user` (mesma lógica da visão do corretor); preferência guardada no navegador. Ajustar `PipelineScopeBadge` para mostrar "Meus leads · N".
- Sem migração, sem mudança de RLS, Roleta, Fila CEO ou do `FilaCeoRepassarDialog`.
- Confirmar antes do disparo que o template escolhido está ligado ao produto Lake Baikal (empreendimento canônico gravado na reativação).
