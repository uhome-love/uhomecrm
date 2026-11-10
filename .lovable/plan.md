# Menu lateral: reorganização por uso real

## O que os números mostram (últimos 30 dias)

Mais usadas:
- Pipeline: 9.587 aberturas, 35 pessoas
- Painel do corretor: 8.229
- Visitas: 2.453
- Tarefas: 2.019
- Agenda: 1.791 (caindo cerca de 60% no mês)
- Oferta Ativa: 1.380
- Aceite: 1.275
- Painel CEO: 1.041
- Notificações: 566

Uso médio (100 a 250 aberturas): Imóveis, Leads estagnados, Campanha Natal, Relatórios, Vendas, Lia, Intermediação, Presença, Roleta, Busca de leads, Foco.

Quase sem uso (menos de 80 aberturas): HOMI, Materiais, Simulador, Usuários, Minhas vitrines, Reengajamento, Financeiro (22, uso esperado por ser só da direção), Academia, Base única, Central de Marketing, Recrutamento (1).

## Problemas do menu atual
- "Início" mistura Dashboard, Campanha, Agenda, Tarefas e Relatórios.
- Agenda e Tarefas ficam lado a lado com função parecida, o que confunde.
- Cada perfil usa nomes de grupos diferentes ("Início", "Principal", "Comercial", "Leads").
- "Ferramentas" do admin tem 8 itens soltos, misturando Oferta Ativa e Base de leads com Simulador.
- "Gestão Financeira" é um grupo inteiro para 1 item.
- Ícones repetidos: alvo em Roleta e Foco; pessoas em Usuários, Recrutamento e Candidatos.
- "Recrutamento" e "Candidatos" são duas entradas para o mesmo assunto.

## Proposta (admin / CEO)

```text
(sem título)   Dashboard · Pipeline · Agenda · Tarefas · Visitas
VENDAS         Oferta Ativa · Leads estagnados · Roleta · Busca de leads
NEGÓCIOS       Vendas · Intermediação · Financeiro
TIME           Equipe (Usuários + Presença + Foco) · Recrutamento (Candidatos junto) · Relatórios
MARKETING      Central de Marketing · Reengajamento · Lia · Base única
APOIO          Imóveis · Materiais · Academia · HOMI · Simulador   (grupo recolhido por padrão)
Campanha       Natal 2026 fica em destaque no topo, só até 31/12
```

## Diretora
Mesmo menu do CEO, mas sem Roleta e Base única. Placar do Dia, HOMI Gerente e Templates entram em Apoio.

## Gerente

```text
(sem título)   Dashboard · Pipeline · Agenda · Tarefas · Visitas
VENDAS         Oferta Ativa · Leads estagnados · Busca de leads
NEGÓCIOS       Vendas · Intermediação
TIME           Meu time (Presença + Foco) · Meus candidatos · Relatórios
APOIO          Imóveis · Materiais · Academia · HOMI · HOMI Gerente · Simulador   (recolhido)
```

## Corretor (mesma lógica, mais curto)

```text
(sem título)   Início · Pipeline · Agenda · Tarefas · Visitas · Oferta Ativa
NEGÓCIOS       Vendas · Meus resultados
APOIO          Imóveis · Materiais · Minhas vitrines · Simulador · HOMI · Academia (recolhido)
```
Notificações saem do menu, porque já existe o sino no topo.

## Padronização
- Os mesmos nomes de grupo para todos os perfis: Vendas, Negócios, Time, Marketing, Apoio. Cada perfil vê só o que pode acessar.
- Um ícone diferente para cada item.
- Os itens mais usados ficam fixos no topo, sem título de grupo.
- Grupos raros ficam recolhidos e lembram se você abriu ou fechou.

## Agenda
A Agenda continua no menu, logo acima de Tarefas. Depois decidimos se ela sai.

## Acabamento visual (junto com a reorganização)
- Item ativo com uma barra fina à esquerda e fundo suave, mais discreto que o bloco azul atual.
- Itens mais baixos e textos levemente menores: cabe o menu inteiro sem rolar em telas de notebook.
- Títulos de grupo menores e mais claros, com menos linhas divisórias.
- Contadores pequenos ao lado de Tarefas e Visitas, mostrando quantas vencem hoje.
- Botão para recolher o menu deixando só os ícones, com o nome aparecendo ao passar o mouse.
- Campanha Natal vira um cartão pequeno e colorido no topo, separado da navegação.

## Ordem de trabalho
1. Desenho do menu novo (computador e celular) para aprovação.
2. Construção só do menu: nenhuma página, regra ou permissão muda.
3. Conferência ao vivo em cada perfil (admin, diretora, gerente, corretor) e no celular.

## Detalhes técnicos
- A mudança fica só em `src/components/layout/Sidebar.tsx` e na navegação do celular. Rotas e permissões ficam como estão.
- Juntar páginas (Equipe, Recrutamento) significa um item no menu que abre a página atual com abas. Nenhuma página é apagada.
