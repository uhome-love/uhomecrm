# Disparo convitesabado_openoutlet0910 — validar regras antes de enviar

## Regras que você descreveu (já são as regras do sistema)
1. **Lead no pipeline ativo de um corretor:** continua com ele, mesma etapa. O corretor recebe push no celular, pop-up e aviso no sininho. A linha do tempo ganha a mensagem do convite e o botão escolhido (manhã ou tarde).
2. **Lead descartado ou só na Base:** vira reengajado e vai para a Fila do CEO como **Open Bosque**.

## O que já conferi
- O modelo já é reconhecido como Open Bosque ("openoutlet" está na regra).
- Resposta que volta sem o 9 já é ligada ao disparo (correção da Ana Maria).

## O que falta
- **A arte deste modelo ainda não está ligada.** Só a do outlet antigo está. Sem a foto a Meta pode recusar o envio. Preciso do arquivo **"Conheça os Decorados Outlet.png"** (o print não serve).

## Validação (sem enviar nada)
1. Rodar uma conferência nos dados com 2 leads de teste: um com corretor ativo e um descartado. Confirmar que o primeiro fica com o corretor e gera aviso e linha do tempo, e que o segundo cai na Fila do CEO como Open Bosque. Apagar os testes no fim.
2. Depois do disparo, conferir os primeiros "Sim" reais nos dois caminhos.

## Detalhes técnicos
- Mapeamento já presente em `whatsapp-webhook/index.ts` (linha 14) e `reengajamentoEmpreendimento.ts`.
- Pendente: upload `campaign-images/reengajamento/convitesabado-openoutlet0910.jpg` (<300 KB) e entrada em `TEMPLATE_HEADER_IMAGES` (`DisparoCustomizadoCard.tsx`).
- Sem migration.
