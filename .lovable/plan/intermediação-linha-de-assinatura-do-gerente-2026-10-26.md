# Intermediação: linha de assinatura do gerente

## O que encontrei
- O documento da Cristina mostra a comissão do gerente no quadro, mas, na parte das assinaturas, aparecem só o contratante, o corretor, a diretoria e a Uhome.
- A causa é que o gerador do documento cria uma linha de assinatura para cada contratante e cada corretor, mas não faz isso para os gerentes. O valor do gerente entra no documento, mas a linha para ele assinar não é criada.

## O que muda
1. Cada gerente com comissão na intermediação ganha a própria linha de assinatura, **"GERENTE: NOME"**, logo depois dos corretores e antes da diretoria. Se houver 2 gerentes, aparecem as 2 linhas.
2. Intermediação sem gerente continua igual.
3. Valores, percentuais, forma de pagamento e regras continuam iguais.
4. Intermediação da Cristina: gero de novo o documento com a linha do Junior. Antes, confiro se o Junior está salvo como gerente nessa intermediação. A versão atual fica guardada no histórico como substituída, sem apagar nada.

## Validação
- Gerar uma intermediação de cliente de teste com 1 gerente e outra com 2 gerentes. Baixar o documento, conferir as linhas de assinatura e o quadro, e depois apagar os testes.
- Conferir o documento novo da Cristina antes de entregar.

## Detalhes técnicos
- `supabase/functions/gerar-intermediacao/index.ts`, no bloco de assinaturas (cerca da linha 379): acrescentar `b.gerentes.forEach(g => { assinatura(); assinaturaLabel(`GERENTE: ${g.nome.toUpperCase()}`) })`. Depois, fazer o deploy da função.
- Sem migration.
