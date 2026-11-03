# Ajuste visual do Natal: gorro e luzes

## O que muda
1. **Gorro no logo**: hoje ele fica pequeno e solto no canto de cima à esquerda, fora do círculo. Ele vai ficar maior, encaixado em cima do círculo do logo e levemente inclinado para a direita, como um gorro de verdade, tanto na barra lateral aberta quanto na fechada. O logo do topo da página continua sem gorro.
2. **Luzes no topo**: some a faixa azul-marinho chapada. O fio de luzes passa a ficar direto sobre o fundo claro da página, mais fino, sem cobrir nada e sem bloco escuro.
3. **Neve**: fica como está.

Antes de mexer no CRM, faço uma imagem mostrando o antes e o depois para você aprovar.

## Detalhes técnicos
- `src/natal/natal.css`: tirar o fundo navy de `.natal-luzes`, deixar o fundo transparente e diminuir a altura para cerca de 22px.
- `src/components/layout/Sidebar.tsx`: mudar as classes do `GorroNatal` para ficar centralizado em cima do logo (ex.: `left-1/2 -top-3 w-8 rotate-[18deg]`) nos dois modos.
- Validação: conferir na tela de teste com a data de Natal, com a barra lateral aberta e fechada.
