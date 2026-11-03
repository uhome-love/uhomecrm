# Menu: item "Campanha Natal 2026"

## O que encontrei
- **Nome duplicado:** o item mostra "Campanha Natal 2026" e ainda um selo dourado "Natal" ao lado, que corta o nome ("Campanha Nata...").
- **Some para gerente, diretora e CEO:** o item só entra no primeiro grupo do menu quando ele se chama "Principal", que é o caso do corretor. No menu de gerente, diretora e CEO, o primeiro grupo se chama "Início", então o item nunca é colocado. A página em si já está liberada para esses perfis.

## O que vou fazer
1. Tirar o selo "Natal" e deixar só o nome **"Campanha Natal 2026"** com o ícone de presente (dourado), sem cortar.
2. Colocar o item no **primeiro grupo do menu de todos os perfis** ("Principal" ou "Início"), logo abaixo do primeiro item. RH continua sem ver.
3. Conferir na tela o menu do CEO (sua conta) e o de um corretor. Para gerente e diretora, conferir que o primeiro grupo também recebe o item.

## Detalhes técnicos
- `src/natal/central/menuNatal.tsx`: usar o primeiro grupo em vez de comparar `title === "Principal"`; remover `badge`.
- `src/components/layout/Sidebar.tsx`: aplicar cor dourada ao ícone do item `/campanha-natal` no lugar do selo.
