# Ficha do lead · etapas finais e nome longo (só visual)

Desktop e celular do topo continuam como aprovados. Sem migration e sem mudar como nada é gravado.

## O que descobri

### Por que o descarte da Danielle não aparece no histórico
- Hoje há dois caminhos para descartar:
  - **Pela ficha** (botão Descartar): muda a etapa **e grava** o histórico.
  - **Pelo menu "⋯" do cartão** no quadro (e no quadro de Negócios): usa outra janela de descarte que **só muda a etapa** (etapa, data e motivo) e **não grava** o histórico. Essa é a falha.
- Danielle: anotação "me bloqueou" às 17h11 de 10/ago e etapa mudada para Descarte 5 segundos depois, sem histórico. É o padrão do menu do cartão. O sistema não guarda quem clicou, então isso é dedução, não prova.
- Correção: na data. O último registro dela é "Sem Contato · 07 ago". A entrada em Descarte é de **10 ago**, então o botão vai mostrar "Em Descarte desde 10 ago".
- No dia 11/ago o arquivamento automático das 24h gravou "Descarte → Descarte". Esse registro não conta como movimento.
- Nesta rodada: só a explicação. A correção da gravação fica para depois que você aprovar.

### O que acontece hoje se clicar em "Agendar visita" num lead descartado
- Abre o formulário de visita normal. Ao salvar, cria a visita e **move o lead para Visita**: ele sai do Descarte.
- Ao sair do Descarte, a regra automática de reentrada roda: zera os prazos, cancela as tarefas pendentes antigas e encerra as parcerias.
- A marca de "arquivado" **não é retirada**. Leads como a Danielle (já arquivada) podem ficar em Visita mas continuar arquivados, ou seja, num estado misturado.
- Bolsão da Oferta Ativa: ao sair do Descarte, o lead deixa de poder ser puxado pelo Bolsão. Se outro corretor tiver reservado o lead no Bolsão no mesmo minuto, não há trava entre as duas ações e ambos podem agir.
- Não vou mudar nada disso agora. Se quiser, proponho depois bloquear ou pedir confirmação.

### Ações de reativar que já existem
- **Ganho**: já existe "Reativar lead" (leva para Qualificação). Vou mostrar esse mesmo botão no resumo.
- **Descarte**: não existe botão de reativar na ficha. Mostro só a informação.
- **Caiu**: a etapa está desligada e não tem ação. Mostro só a informação.

## O que vou fazer

1. **Último movimento termina na etapa atual** (`CaminhoDoLead.tsx`)
   - Se o último registro real do histórico não for a etapa atual, o botão mostra "Em {etapa} desde {dd mmm}", com a data de entrada na etapa. Sem "Voltou" nem "Avançou".
   - O caminho completo acrescenta essa etapa no fim, com a mesma data.
   - Registros da mesma etapa para ela mesma (como o arquivamento automático) continuam ignorados.
   - Leonardo Prado: o último registro dele já é a etapa atual, então nada muda.
2. **"Próximo passo" em Descarte, Caiu ou Ganho** (`DrawerAgora.tsx` + `PipelineLeadDetail.tsx`)
   - Esconde "Sem próximo passo", "Criar tarefa", o alerta de saúde e o Homi.
   - No lugar, um resumo em cinza:
     - "Descartado em 10 ago · Motivo: {motivo}", com a lista de motivos que já existe;
     - "Negócio caiu em {data}";
     - "Venda assinada em {data}", com a data de assinatura e, se não houver, a data de entrada na etapa.
   - Em Ganho aparece também o botão "Reativar lead" que já existe.
3. **Nome longo** (`DrawerTopo.tsx`)
   - O nome ocupa no máximo 2 linhas, com reticências.
   - Passar o mouse mostra o nome inteiro. No celular, tocar no nome abre um balão com o nome inteiro.
   - O foco inicial continua no nome.

## Testes
Danielle Knorst (Descarte), um lead em Ganho, um em Caiu (se não houver nenhum, aviso) e Leonardo Prado sem nenhuma mudança. Celular 390/360 e computador, tema claro e escuro, sem salvar nada.
