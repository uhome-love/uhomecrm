# Polimento: painel do corretor + Oferta Ativa com contador e roteiro editável

## 1. Painel inicial (Minha Rotina)
- **Banner de boas-vindas**: trocar o azul-noite pelo azul do logo UhomeSales (degradê da marca), mantendo gorro, chips e textos brancos legíveis.
- **Homi de Natal**: reduzir e encaixar dentro do banner (hoje ele vaza para cima e para baixo).
- **Minha Missão de Natal (fechada)**: virar uma faixa de uma linha só — chave + título + "R$ 270 mil de R$ 1,5 mi (17%)" + barra + "40 dias" + "Minha meta" + "Ver detalhes". Abrir continua mostrando tudo igual a hoje.

## 2. Oferta Ativa — tudo em uma tela
- Diminuir o espaço vazio entre as abas superiores e a barra da Oferta Ativa.
- Cliente e roteiro com a **mesma altura** (os dois cartões esticam juntos); roteiro rola por dentro se for longo.
- Ligar agora e WhatsApp lado a lado (já feito; manter).
- Meta: tudo visível sem rolar em 1346×770.

## 3. Ligação com contador
```text
[ Ligar agora ]  -> abre o discador do celular
      v
[ 00:42  Em ligação com Sergio ]  [ Finalizar ligação ]
      v  (ao tocar Finalizar OU ao voltar do discador)
+------- Como foi a ligação? -------+
| Não atendeu | Sem interesse       |
| Aproveitar  | Visita marcada      |
|        Número errado (só Listas)  |
+-----------------------------------+
```
- Contador começa ao tocar "Ligar agora"; "Ligar agora" vira "Finalizar ligação" com o tempo correndo.
- Ao finalizar (ou voltar do discador no celular), abre a janela de resultado com os 4 botões. "Visita marcada" segue para data/hora como hoje.
- Fechar a janela sem escolher volta para o cliente (nada é gravado). Os botões de resultado continuam também no cartão, para quem não usar o contador.
- O tempo da ligação vai junto na observação da tentativa (ex.: "Ligação de 1min42s"), sem mudar números do ranking.

## 4. Roteiro editável
- Botão "Editar" no roteiro: o corretor escreve o próprio texto, pode usar {nome} e {empreendimento}.
- Fica salvo para aquele corretor e aquele empreendimento (neste aparelho), com botão "Voltar ao padrão".
- Não altera o roteiro oficial da equipe.

## Teste ponta a ponta
- Clientes fictícios em lista de teste: cada botão da janela (Não atendeu, Sem interesse, Aproveitar, Visita marcada, Número errado), fechar sem escolher, contador, editar/restaurar roteiro.
- Conferir no banco cada gravação e apagar tudo ao final.
- Tamanhos: 1346×770, 1920, tablet e celular; painel inicial claro/escuro.

## Detalhes técnicos
- `GreetingBar`/bloco do `CorretorDashboard` (classe `natal-noite`) → `gradient-brand`; Homi `h-[...]` contido com `overflow-hidden`.
- `MissaoNatalCard` modo fechado em `flex` única linha (`md:`), empilha no celular.
- `TelaLigacao`: estado `chamada {inicio}`; `ResultadoDialog` novo reutilizando `ResultadoBarra`; grid `items-stretch`, `RoteiroPainel` `h-full` com área rolável; reduzir `py` da página em `OfertaAtivaCorretor`.
- Duração enviada pelo campo de observação já existente em `registrar` (sem mudança no servidor).
- Roteiro pessoal em `localStorage` chave `oa-roteiro:{userId}:{empreendimento}`.
