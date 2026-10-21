# Oferta Ativa (Estagnados/Descartados): corretor não consegue sair do "Aleatório"

## O que o Anderson viu
Ele tinha escolhido Lake Eyre, tocou em "Aleatório (todos)" e o Lake Eyre "sumiu" da tela. Não encontrou como voltar a escolher.

## Causa provável (confirmar no passo 1)
- Tocar em "Aleatório" limpa a escolha, e isso está certo.
- Lake Eyre tem menos de 10 clientes, então fica escondido dentro de "Outros empreendimentos", que vem **fechado**. Quando a escolha some, o empreendimento some junto da vista.
- No celular, o "Outros empreendimentos" fica no fim da tela, perto da barra "Começar a ligar" e da barra de botões de baixo, o que pode cobrir esse botão.
- Não há um botão "Voltar" claro para trocar entre Estagnados, Descartados e Listas.

## O que vamos fazer
1. **Reproduzir** no tamanho de iPhone com a conta de um corretor, sem puxar nem registrar cliente: escolher um empreendimento pequeno, tocar em Aleatório e tentar voltar.
2. **Empreendimentos pequenos visíveis**: "Outros empreendimentos" passa a vir aberto no celular (ou mostra os primeiros direto), e a busca continua no topo.
3. **Escolha sempre visível**: os empreendimentos escolhidos aparecem em destaque logo abaixo do "Aleatório", com um "x" para tirar. Tocar num empreendimento tira o "Aleatório" na hora.
4. **Nada coberto**: espaço no fim da tela para a barra "Começar a ligar" e a barra de baixo não cobrirem nenhum botão.
5. **Lembrar a última escolha** no aparelho, por porta (Estagnados e Descartados separados), como já acontece nas Listas.
6. **Botão "Trocar"** visível para voltar às 3 portas.

## O que NÃO muda
- Quem entra no Bolsão, um cliente por vez, Aproveitar / Não atendeu / Sem interesse, contagens e regras do servidor.
- Listas da Oferta Ativa, Pipeline, Roleta, Fila CEO.

## Validação
- No preview em tamanho de iPhone e computador: escolher, ir para Aleatório, voltar a escolher Lake Eyre, buscar, trocar de porta. Sem tocar em "Começar a ligar" com cliente real.

## Detalhes técnicos
- Só tela: `EmpreendimentoSeletor.tsx` (grupo aberto por padrão no mobile via `useIsMobile`, faixa de selecionados com remover), `BolsaoDiscador.tsx` (localStorage `oa_bolsao_emps_<porta>`, padding inferior para a barra fixa) e o local que renderiza as portas em `CorretorCall.tsx` (botão Trocar, se ainda não existir).
- Sem banco, sem edge function.
