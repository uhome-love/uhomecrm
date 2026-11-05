# Nova tela de login (visual moderno aprovado)

## O que muda
- Computador: formulário à esquerda (logo UhomeSales, etiqueta "CRM da equipe Uhome", "Bem-vindo de volta", e-mail, senha, "Entrar no CRM") e painel azul-noite à direita com prévia decorativa do Pipeline, Homi com balão e "Cada lead, uma chave."
- Celular: faixa azul no topo com logo branco e slogan; formulário logo abaixo.
- Cores e letras do CRM (azul de ação, azul-noite da marca, ciano do Homi, Montserrat/Inter, cantos de 12px).

## O que NÃO muda
- Entrar, mensagens de erro, aviso "Demorando demais?" e link "Corrigir acesso neste dispositivo" continuam funcionando igual.
- Sem cadastro público (continua bloqueado).
- "Manter conectado" fica de fora: o CRM já mantém a pessoa conectada; um botão sem efeito real confundiria.
- "Esqueci minha senha" mantém o comportamento atual (não abre recuperação ainda — pode virar fase própria).
- Decoração de Natal no login não entra nesta fase.

## Conferência
- Abrir o login no computador e no celular, testar senha errada (mensagem aparece) e entrada com conta de teste.

## Detalhes técnicos
- Reescrever só a apresentação de `src/pages/Auth.tsx`, dividindo em `src/components/auth/` (painel da marca e formulário) para ficar abaixo de 300 linhas; lógica de `handleSubmit`/`handleHardRecovery` preservada.
- Usar tokens do design system (`--primary`, `--brand`, `homi-*`) e o logo via `components/brand`; sem cores fixas nos componentes, exceto o fundo do painel definido como token novo no `index.css`.
