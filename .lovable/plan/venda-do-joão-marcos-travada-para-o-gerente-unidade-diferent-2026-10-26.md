# Venda do João Marcos travada para o gerente (unidade diferente)

## O que o vídeo mostra
O gerente está no endereço oficial (uhomesales.com). Lá a tela "Confirmar venda" ainda mostra o aviso vermelho "Unidade oficial da intermediação: Apto 1402" e deixa o botão "Confirmar venda" apagado. Ao digitar com espaço, também abre os detalhes do cliente.

## Por que acontece
As duas correções de ontem (unidade/nome diferentes viram só aviso amarelo e o espaço não abre mais o cliente) estão prontas na versão de teste e no servidor, mas **o site oficial ainda não foi publicado** com elas. Por isso o gerente continua vendo a tela antiga.

## O que fazer
1. Publicar o app (botão Publicar), sem nenhuma mudança nova de código.
2. O gerente recarrega a página (ou fecha e abre o navegador) e tenta de novo a venda do João Marcos.
3. Conferir comigo no oficial que o aviso fica amarelo e o botão libera; nada é confirmado por mim em cliente real.

## Detalhes técnicos
- `ConfirmarVendaForm.tsx` atual não contém mais o bloqueio por unidade; `confirmar_venda` no banco já registra a divergência como aviso. Só falta o deploy do frontend.
