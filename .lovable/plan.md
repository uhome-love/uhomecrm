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
(sem título)   Dashboard · Pipeline · Visitas · Tarefas
VENDAS         Oferta Ativa · Leads estagnados · Roleta · Busca de leads
NEGÓCIOS       Vendas · Intermediação · Financeiro
TIME           Equipe (Usuários + Presença + Foco) · Recrutamento (Candidatos junto) · Relatórios
MARKETING      Central de Marketing · Reengajamento · Lia · Base única
APOIO          Imóveis · Materiais · Academia · HOMI · Simulador   (grupo recolhido por padrão)
Campanha       Natal 2026 fica em destaque no topo, só até 31/12
```

## Corretor (mesma lógica, mais curto)

```text
(sem título)   Início · Pipeline · Visitas · Tarefas · Oferta Ativa
NEGÓCIOS       Vendas · Meus resultados
APOIO          Imóveis · Materiais · Minhas vitrines · Simulador · HOMI · Academia (recolhido)
```
Notificações saem do menu, porque já existe o sino no topo.

## Padronização
- Os mesmos nomes de grupo para todos os perfis: Vendas, Negócios, Time, Marketing, Apoio. Cada perfil vê só o que pode acessar.
- Um ícone diferente para cada item.
- Os 4 itens mais usados ficam fixos no topo, sem título de grupo.
- Grupos raros ficam recolhidos e lembram se você abriu ou fechou.

## Decisão pendente sobre a Agenda
A proposta tira a Agenda do menu e deixa Tarefas como o lugar único. As prioridades da Agenda passam a ficar como um bloco no painel inicial. O endereço antigo continua funcionando.

## Ordem de trabalho
1. Desenho do menu novo (computador e celular) para aprovação.
2. Construção só do menu: nenhuma página, regra ou permissão muda.
3. Conferência ao vivo em cada perfil (admin, diretora, gerente, corretor) e no celular.

## Detalhes técnicos
- A mudança fica só em `src/components/layout/Sidebar.tsx` e na navegação do celular. Rotas e permissões ficam como estão.
- Juntar páginas (Equipe, Recrutamento) significa um item no menu que abre a página atual com abas. Nenhuma página é apagada.
