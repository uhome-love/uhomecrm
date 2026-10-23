# Auditoria: parcerias da Larissa nesta semana (19 a 25/10)

## O que encontrei, cliente por cliente

| Cliente | Visita realizada | Parceria registrada? | Quem registrou e quando | Conta na Roleta |
|---|---|---|---|---|
| Jocarli Alencastro | 19/10 e 22/10, Larissa | Sim, Larissa + Matheus Pasin | Conta da Larissa, 21/10 às 14:11, botão "Visita em parceria?" | 0,5 Larissa + 0,5 Matheus (mesmo cliente na semana conta 1 vez) |
| Tayna Lohse | 21/10, Larissa | Não | — | 1 inteira para a Larissa |
| Cesar Rideky | 23/10, Larissa | **Sim, Larissa + Matheus Pasin** | **Conta da Larissa, hoje às 13:02**, botão "Visita em parceria?" | 0,5 Larissa + 0,5 Matheus |

- Total da Larissa na semana: **2,0** (0,5 + 1 + 0,5). Se o Cesar for só dela, sobe para **2,5**, e o Matheus perde 0,5.
- Em toda a empresa, só essas duas parcerias afetam a contagem da semana.

## Por que o Cesar aparece como parceria
- Hoje às 13:02 a visita do Cesar foi salva pela conta da Larissa com o botão **"Visita em parceria?" ligado e o Matheus escolhido**. Esse botão é o único lugar que grava o motivo "Visita em parceria" que aparece no registro. 15 segundos depois, a visita foi marcada como realizada.
- Provavelmente ligou o botão sem querer ao registrar o resultado da visita. O sistema não tem como saber se o Matheus participou ou não.

## Por que o cartão não mostra a parceria
- O cartão do **Pipeline de Leads** mostra a parceria.
- O cartão do **quadro de Negócios** (a tela do print, coluna "Documentação") e a **lista de visitas** não mostram. Por isso parece "só da Larissa".

## O que proponho

1. **Cesar Rideky:** se você confirmar que é só da Larissa, eu desfaço essa parceria, porque só o administrador pode fazer isso. Fica registrado no histórico que a parceria foi desfeita, com o motivo "registrada por engano, confirmado pelo CEO". A contagem passa a ser Larissa 2,5 e Matheus menos 0,5. O Jocarli continua em parceria.
2. **Mostrar a parceria nos três lugares que você pediu:**
   - **Cartão do cliente no Pipeline:** já mostra a parceria; vou conferir que aparece no computador e no celular.
   - **Cartão do negócio:** novo selo "Parceria com Matheus".
   - **Histórico de visitas:** novo selo em cada visita, na lista de visitas, na Minha Evolução e no histórico dentro do cliente.

   Assim, corretor e gestor veem na hora o que está contando como meia visita.
3. **Evitar ligar a parceria sem querer na visita:** ao salvar uma visita com o botão ligado, aparece uma confirmação "Registrar parceria com Matheus Pasin neste cliente? Cada um ficará com 0,5 visita na Roleta e só o administrador pode desfazer." Só depois de confirmar a parceria é gravada.

## Validação
- Conferir a contagem da Larissa e do Matheus antes e depois de desfazer a parceria do Cesar.
- Abrir o quadro de Negócios e a lista de visitas e conferir que o selo aparece no Jocarli e não aparece no Cesar nem na Tayna.
- Testar a confirmação com um cliente de teste, cancelando a parceria, e apagar o cliente depois.

## Detalhes técnicos
- **Parcerias:**
  - Cesar: parceria `fa57c622…`, lead `5e05cb98…`, criada às 16:02:08 UTC por `criado_por` = Larissa; visita `798074a3…` com `updated_at` às 16:02:23.
  - Jocarli: parceria `fdb0533e…`.
- **Desfazer a parceria:** mudar o `status` da parceria `fa57c622` para inativa (não apagar) e registrar em `audit_log`. A contagem já ignora parcerias inativas.
- **Selo:** `NegociosBoardInline.tsx` e os componentes da lista de visitas passam a buscar `pipeline_parcerias` ativas pelos leads exibidos (uma consulta por tela) e mostram o selo.
- **Confirmação:** em `VisitaForm.tsx`, um `AlertDialog` antes do insert, só quando `isParceria && !parceriaExistente`.
