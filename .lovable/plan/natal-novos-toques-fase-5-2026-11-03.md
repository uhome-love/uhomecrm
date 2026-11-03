# Natal — novos toques (Fase 5)

Tudo dentro da pasta de Natal, some sozinho depois de 26/12. Nada muda em vendas, pipeline ou regras.

## 1. Comemoração na venda
- Quando uma venda é confirmada (ganho salvo com sucesso), aparece uma tela dourada por alguns segundos para toda a empresa: foto do corretor, empreendimento, "+1 chave", confete e sininho.
- Também aparece no sino de notificações: "🎁 Fulano fechou venda no Empreendimento X".
- Valor da venda NÃO aparece (só nome, foto e empreendimento).
- Respeita o botão de desligar efeitos de cada aparelho.

## 2. Mural das Vendas na página Campanha Natal 2026
- Nova seção "Mural das Vendas" na Visão geral (e aba própria em "Comece aqui").
- Cada venda da campanha (01/11 a 18/12) vira um cartão: rosto do corretor (gorro de Natal na foto), nome, equipe, empreendimento e data. Parceria mostra os dois rostos.
- Mais recentes primeiro; destaque dourado na venda do dia.
- Fonte: mesmas vendas ganhas que já contam no VGV (sem duplicar, distrato fora).

## 3. Enfeites que faltam
- Criar no mesmo estilo 3D do gorro/Homi: presente, sino, bola e estrela (fundo transparente).
- Usar nos lugares onde hoje há emoji: prêmios, urna, placar da TV (bolas no fundo), comemoração da venda.

## 4. Tela de carregamento de Natal
- Enquanto o CRM abre: Homi de Noel segurando a chave, luzes e "Carregando…" em dourado. Fora do período volta ao normal.

## Ordem (uma por vez, validando cada)
1. Desenho (mockup) das 4 peças para sua aprovação.
2. Enfeites + tela de carregamento.
3. Mural das Vendas.
4. Comemoração na venda (testada com lead fictício e desfeita).

## Detalhes técnicos
- Imagens novas em `public/natal/`; componentes em `src/natal/`.
- Comemoração: escuta em tempo real de novos ganhos em `negocios` (somente leitura) + notificação via mecanismo existente, deduplicada por negócio.
- Mural: leitura das vendas ativas da campanha com foto de `profiles`; visível para todos os perfis (sem valores).
- Sem migration de regra de negócio; se precisar de leitura agregada para corretor ver vendas de outros, uma função só-leitura sem valores.
