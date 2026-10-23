# Pop-ups de "Registrar venda (Ganho)" e "Visita" mais compactos

## Situação atual
- Os dois já rolam, mas são longos: o de venda empilha cada campo numa linha (empreendimento, construtora, unidade+VGV, data, intermediação, botão gerar, comprovante, observação) e os botões Salvar/Cancelar só aparecem no fim da rolagem.
- O de visita tem 11 campos empilhados (cliente, imóvel, local, responsável, corretor, parceria, parceiro, data, horário, telefone, observações).

## O que muda (só visual, mesmas regras e campos obrigatórios)
**Registrar venda**
- Construtora vira um texto pequeno embaixo do empreendimento (não é editável mesmo).
- Unidade, VGV e Data da assinatura numa linha só no computador (no celular, 2 + 1).
- Intermediação: lista e botão "Gerar" lado a lado.
- Comprovante: botão mais baixo, mostrando o nome do arquivo quando anexado.
- Observação recolhida em "+ Adicionar observação".
- Botões Cancelar/Confirmar fixos no rodapé do pop-up, sempre visíveis.
- Espaçamento entre blocos reduzido; pop-up um pouco mais largo no computador.

**Visita**
- Data, horário e telefone na mesma linha.
- Local e responsável lado a lado; corretor e parceria lado a lado.
- Corretor parceiro só aparece quando "parceria" está ligada (já é assim, conferir).
- Observações recolhidas em "+ Adicionar observação" (abertas se já tiverem texto na edição).
- Botões Cancelar/Salvar fixos no rodapé.

## Teste
- Antes e depois, medir a altura no preview em computador (1436x785, a sua tela) e celular, abrindo os dois pop-ups num cliente de teste, com prints. Meta: venda e visita cabendo inteiros no computador sem rolar.
- Conferir que continuam bloqueando sem dados obrigatórios e que nada é salvo (sempre Cancelar; cliente de teste apagado no fim).

## Detalhes técnicos
- Arquivos: `src/components/vendas/ConfirmarVendaForm.tsx` e `src/components/visitas/VisitaForm.tsx` (este tem 876 linhas: extrair os blocos de campos para componentes menores ao mexer).
- Rodapé fixo com `sticky bottom-0 bg-background border-t` dentro da área rolável.
- Sem mudança em banco, validações ou `confirmar_venda`.
