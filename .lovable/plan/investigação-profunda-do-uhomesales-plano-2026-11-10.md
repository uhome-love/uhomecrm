# Investigação profunda do UhomeSales — plano

Seguindo a regra fixa do Lucas (desenho → plano → aprovação → construção → validação ao vivo), este pedido vira um trabalho em fases. Nada é construído antes de você aprovar cada fase.

## Fase 1 — Auditoria completa (só leitura, sem mudar nada)

Uma equipe de investigação percorre o CRM inteiro, em paralelo, por área:

1. Navegação e casca: menu lateral, topo, abas, busca, avisos, menu do celular.
2. Corretor: Minha Rotina, Pipeline, ficha do lead, Tarefas, Agenda, Visitas, Oferta Ativa.
3. Gerente: painel, equipes, presença, Foco, PDN, 1:1, Estagnados.
4. Direção: Painel CEO/diretora, Performance da Roleta, relatórios, previsão, VGV.
5. Comercial e Financeiro: vendas, intermediação, simulador, financeiro.
6. Inteligência: HOMI, HOMI Gerente, Lia, alertas.
7. Conteúdo e administração: imóveis, materiais, Academia, RH, usuários, configurações.
8. Transversal: números que não batem entre telas, cores fora do padrão, arquivos grandes demais, lentidão, acessibilidade, celular 390px, resultado do último exame de segurança.

Cada tela é aberta no computador e no celular, com usuário de cada perfil, sem alterar dados reais.

**Entrega da Fase 1:** um relatório (arquivo para baixar) com:
- o que está bom, razoável e ruim, por perfil;
- cada problema com print, o impacto para quem usa e quantas vezes por dia acontece;
- classificação Impacto (alto/médio/baixo) × Risco × Esforço;
- uma lista de "melhorias seguras" (sem mexer em regra de negócio) e outra de "melhorias sensíveis" (precisam de desenho e plano próprios).

## Fase 2 — Escolha

Você escolhe, do relatório, o que entra. Sugestão: começar pelas 3 a 5 melhorias de maior impacto para o corretor (a ação mais repetida do dia).

## Fase 3 em diante — Uma melhoria por vez

Para cada bloco escolhido:
1. desenho (computador + celular) para aprovação;
2. plano curto;
3. construção;
4. validação ao vivo, computador e celular, com cliente de teste, apagando os dados no fim.

## O que nunca muda sem aprovação explícita

Pipeline como fonte única, Oferta Ativa como fonte única de ligações, "Tudo no Lead", regras da Roleta, visitas, VGV e parcerias, financeiro, permissões, descarte/inativação/estagnação, aproveitamento seguro, identidade visual (azul da marca, Homi).

## Detalhes técnicos

- Fase 1 usa investigadores em paralelo (leitura de código, consultas só de leitura ao banco, navegação automatizada em 1280px e 390px, exame de segurança existente).
- Métricas: comparar cada número de painel com sua fonte canônica (`v_negocios_pipeline`, VGV único, `roleta_visitas_realizadas_periodo`, ranking da Oferta Ativa).
- Código: arquivos acima de 500 linhas, cores fixas fora dos tokens, consultas duplicadas, sem limite de 1000 linhas, `as any`.
- Nenhuma migração, edição de código ou envio a cliente na Fase 1.
- Relatório salvo em Arquivos como `Auditoria_UhomeSales_2026-11.md`.
