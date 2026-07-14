## Diagnóstico confirmado

Você está certo: a base selecionada tinha volume para continuar.

Na campanha mais recente:
- As listas selecionadas tinham **2.149 linhas brutas**.
- Depois de filtros legítimos de segurança, ainda sobrariam cerca de **745–763 números elegíveis**.
- Porém o motor criou uma fila/run com apenas **73 alvos** e concluiu com **48 enviados + 25 ignorados por telefone inválido**.

Ou seja: não foi simplesmente “acabou a fila”. Existe uma falha de contrato entre o cálculo/preview e o motor real de disparo. O preview e a função de envio não estão chegando no mesmo público final, e o motor encerra como se tivesse processado tudo.

## Correção proposta

1. **Unificar o cálculo de público do preview e do disparo**
   - Fazer a função de disparo usar a mesma lógica de paginação, deduplicação, telefone válido, frequência, pipeline ativo e template já enviado usada no preview.
   - Eliminar divergência onde o preview mostra centenas, mas o envio cria fila pequena.

2. **Persistir auditoria completa do funil no run**
   - Gravar no `audience_payload`/motivo do run:
     - total bruto nas listas;
     - removidos por duplicidade;
     - removidos por telefone inválido;
     - removidos por marketing recente;
     - removidos por pipeline ativo;
     - removidos por template já enviado;
     - total real enfileirado.
   - Assim, quando parar, a página mostra exatamente por quê.

3. **Corrigir o encerramento enganoso**
   - Se a base esperada era maior e a fila criada ficou muito menor, não finalizar como “concluído” simples.
   - Exibir: “Processou X de Y; Y foi reduzido por filtros A/B/C” ou “erro de construção de fila”.

4. **Fortalecer a fila para bases grandes**
   - Garantir paginação completa acima de 1.000 registros.
   - Criar a fila inteira antes de iniciar o envio.
   - Manter micro-lotes automáticos, mas com verificação: se ainda há `pending`, continuar; se a continuação falhar, o banner/retomada reativa o mesmo run.

5. **Corrigir retomada e status local**
   - Tratar continuação de run manual como autorizada, mesmo com `reengajamento_config.enabled=false`, sem depender de estado ambíguo.
   - Não permitir que um run com pendentes fique invisível ou pare sem motivo.

6. **Ajustar a página de Reengajamento**
   - Depois de iniciar, mostrar “fila criada com N números” em vez de só “disparo iniciado”.
   - No histórico, mostrar o funil do disparo e o motivo real da parada.
   - Se a base tiver 700 elegíveis e só 73 entrarem na fila, a UI deve acusar divergência imediatamente.

7. **Validação**
   - Testar com a mesma seleção de listas do run recente.
   - Confirmar que a fila criada fica próxima dos ~745 elegíveis esperados, não 73.
   - Confirmar que o disparo continua em micro-lotes até esgotar fila, pausar por qualidade Meta ou ser parado manualmente.