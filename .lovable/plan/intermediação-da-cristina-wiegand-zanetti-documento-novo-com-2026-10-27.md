# Intermediação da Cristina Wiegand Zanetti: documento novo com assinatura do Junior

## Situação atual
- A intermediação ativa da Cristina (Essence A45, ZemoBank, R$ 28.696,28) já tem o Junior Padilha como gerente, com 15%, e já está ligada à venda e ao cliente certos.
- O documento salvo dessa intermediação foi gerado antes da correção e não tem a linha de assinatura do gerente.

## O que vou fazer
1. Gerar o documento de novo a partir dos dados já salvos dessa intermediação. Valores, percentuais, parcelas, forma de pagamento e testemunhas ficam iguais. Entra só a linha "GERENTE: JUNIOR PADILHA".
2. Substituir o arquivo na própria intermediação ativa. Assim a venda, o Financeiro e o "A receber" continuam ligados a ela, sem duplicar nada. O arquivo antigo fica guardado, em vez de ser apagado.
3. Conferir o documento novo página por página: quadro de divisão com o Junior, linha de assinatura e valores.
4. Entregar aqui o arquivo .docx corrigido.

## Detalhes técnicos
- Reaproveitar o `payload` de `intermediacoes` 9ced6a07 e gerar o .docx com o mesmo código da edge `gerar-intermediacao`, já corrigido. Enviar o arquivo para o storage em um caminho novo e atualizar `arquivo_path` da mesma linha, com registro em `audit_log`.
- Sem migration, sem nova linha em `intermediacoes` e sem mudança em `negocios_recebimentos`.
- Salvar uma cópia em `/mnt/documents/intermediacao-cristina-zanetti-essence-a45_v2.docx`.
