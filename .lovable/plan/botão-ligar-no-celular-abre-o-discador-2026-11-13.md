# Botão Ligar no celular abre o discador

## O que o vídeo mostra
A janela que abriu mostra o **script completo aberto**, com "Script · Registrar · Próximo passo". Esse é o comportamento **antigo**. Na versão nova, no celular, o script vem recolhido e só aparece "Como foi a ligação?" depois de voltar do discador.

Ou seja: o celular está rodando a versão anterior do CRM. A mudança está pronta no preview, mas ainda **não foi publicada** em uhomesales.com (ou o app instalado ainda guarda a versão antiga).

## O que vou fazer
1. **Reforço para o app instalado no iPhone**: trocar o jeito de abrir o discador por um link de telefone real, clicado por dentro (o iPhone às vezes ignora o comando atual quando o CRM está instalado na tela inicial).
2. **Se o discador não abrir**, não mostrar a janela de resultado sozinha após 4 segundos (hoje ela aparece mesmo sem a ligação acontecer). Ela só aparece ao voltar do discador.
3. Testar no preview com celular de 390px e no computador (no computador continua abrindo o script, como hoje).
4. Pedir para você **publicar** e, no celular, fechar e abrir o app de novo para pegar a versão nova.

## Detalhes técnicos
- `PipelineLeadDetail.tsx` › `iniciarLigacao`: criar `<a href="tel:...">` temporário e chamar `.click()` em vez de `window.location.href`; remover o fallback de 4s que abre o overlay quando `saiu=false` (manter apenas limpeza do ref após ~60s).
- Atalho de teclado "l" e demais botões já passam por `iniciarLigacao`.
- Sem mudanças no banco.
