# Campanha Natal 2026 — revisão completa do visual

## Problemas encontrados
1. **Luzes cortadas no topo do banner:** a faixa tem só 20px e corta as lâmpadas pela metade.
2. **Janelas empilhadas ao abrir:** a janela "Qual é a sua meta de Natal?" abre por cima de outra janela ("Depois / Ver minhas tarefas"). Fica confuso e cobre a página.
3. **Abas misturadas:** são 8 abas soltas, sem ordem de uso. Materiais para enviar e textos para copiar ficam todos misturados.
4. **Visão geral comprida e sem hierarquia:** os títulos são pequenos, os cards de prêmio ficam apertados em 5 colunas e a urna e as regras parecem texto corrido.
5. **Cards de empreendimento:** 4 por linha deixa o gancho apertado. Os botões "Card" e "Disparo" não têm ícone e ficam desligados sem explicar por quê.
6. **Busca:** aparece e some conforme a aba, e a linha das abas pula de tamanho.
7. **Celular:** o banner ocupa muito espaço, a frase do topo some e as abas ficam cortadas sem indicar que dá para arrastar.

## O que vou entregar
- **Banner:**
  - luzes inteiras, com espaço próprio no alto;
  - banner mais baixo no celular;
  - um atalho "Minha meta" ao lado do contador de dias.
- **Janela de meta:** abre sozinha só uma vez e nunca junto com outra janela. Depois disso, só pelo botão "Minha meta".
- **Abas em 3 grupos claros:**
  - **Comece aqui:** Visão geral.
  - **Para enviar:** Empreendimentos, Cards, Disparos, Instagram, PDFs.
  - **Para copiar:** Scripts, Follow-ups.
  - Cada aba mostra quantos itens tem (ex.: "Cards 10"). No celular, a barra de abas fica presa no topo ao rolar e mostra que dá para arrastar para o lado.
- **Busca fixa** em todas as abas, filtrando pelo título dos arquivos também.
- **Visão geral reorganizada:**
  - **"Sua meta em 3 passos"** no alto: a conta das visitas.
  - **Prêmios** em cards maiores, 3 por linha, com destaque dourado.
  - **Regras** numeradas em bolinhas.
  - **Urna** com uma faixa colorida por nível.
  - **Semanas** com a atual destacada e as passadas apagadas.
- **Empreendimentos:**
  - 3 por linha no computador;
  - gancho com mais espaço;
  - botões com ícone (Copiar, WhatsApp, Baixar card, Baixar disparo), com aviso ao passar o mouse quando o arquivo ainda não subiu.
- **Cards, Disparos e Instagram:**
  - grade uniforme;
  - toque na imagem abre em tela cheia;
  - botões Baixar e Compartilhar.
- **Acabamento geral:** espaçamentos iguais, títulos de seção com o mesmo estilo e cores do tema (sem cores soltas).

## Ordem (regra do projeto)
1. Desenho (mockup) no computador e no celular para você aprovar.
2. Construir só depois da aprovação.
3. Conferir na tela, aba por aba, no computador e no celular, com conta de corretor e de admin.

## Detalhes técnicos
- Arquivos: `src/natal/central/CampanhaNatalPage.tsx`, `AbasTexto.tsx`, `AbasArquivos.tsx`, `Pecas.tsx`, `central.css`, e o gatilho da abertura automática em `MissaoNatalCard`/`MetaNatalDialog`.
- Tudo continua dentro de `src/natal/`. Nada muda nos dados, nas regras ou em outras telas.
