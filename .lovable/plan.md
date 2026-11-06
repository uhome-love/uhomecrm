# Tela de login conforme o arquivo da marca (marca-2)

## Como vai ficar

**Computador**
- Lado esquerdo: painel claro (azul bem suave) com a casa/U da marca ao fundo.
  - Cartão "Recado da semana" no topo: data, título "Quanto mais visitas, mais vendas.", texto curto e assinatura "Lucas Sarmento · CEO da Uhome".
  - Embaixo, grande: "Cada lead, **uma chave.**"
  - Homi no canto com balão: "Bom dia! Entre que eu te ajudo a organizar o dia." (Bom dia/Boa tarde/Boa noite pelo horário de Brasília).
- Lado direito: logo HomeSales "com Homi IA", título "Que bom te ver de novo", frase "Entre para ver seus leads, visitas e tarefas de hoje.", e-mail, senha (com olho), "Esqueci minha senha", botão "Entrar no CRM", "Acesso restrito à equipe Uhome" e "Está preso na tela de login? Corrigir acesso neste dispositivo".

**Celular**
- Faixa clara no topo com logo e o Homi; formulário abaixo; cartão compacto "Recado da semana · Lucas"; rodapé com acesso restrito e corrigir acesso.

**Natal (até 31/12)**
- Mesmo layout, com gorro no logo, Homi de gorro, selo "Missão de Natal · até 18/12" no cartão e balão "Bora fechar o ano com chave de ouro?".

## O que não muda
- Entrar, recuperar senha e "Corrigir acesso" continuam funcionando igual.
- Sem botão de cadastro. Sem mudança em banco ou permissões.

## Decisão: o recado da semana
Nesta fase o recado fica com texto fixo (o do desenho). Para trocar toda semana pelo próprio CRM é preciso uma fase separada.

## Técnico
- Reescrever `src/components/auth/AuthBrandPanel.tsx` (painel claro, cartão do recado, slogan, Homi + balão) e ajustar `src/pages/Auth.tsx` (textos, ícones nos campos, olho da senha, rodapé, versão celular).
- Logo via `components/brand`; Homi de Natal via `public/natal/homi_noel.png`, gated por `isNatal()` (wrapper pequeno em `src/natal/`).
- Cores só por tokens do design system em `src/index.css` (painel claro novo como token).
- Validação ao vivo no preview: computador 1440px, celular 390px, temas claro/escuro; tentativa de senha errada mostra o erro.
