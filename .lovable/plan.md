# Painel CEO em 6 widgets (novo design system)

## Ideia
A versão de computador do Painel CEO passa a ser uma grade organizada de 6 widgets, todos no visual aprovado em "Peças da marca". Cada widget tem título, período, 2 a 4 números principais, um gráfico ou lista e um botão "Ver detalhes".

```text
[ Saudação + Missão de Natal + período + Fila CEO ]
[ Faixa de indicadores do topo (já feita)         ]
+----------------------+----------------------+
| 1 Roleta e Leads     | 2 Marketing          |
+----------------------+----------------------+
| 3 Funil e Gestão de Leads / Conversão       |
+----------------------+----------------------+
| 4 Agenda de Visitas  | 5 Negócios e Funil   |
+----------------------+----------------------+
| 6 Oferta Ativa (ranking + ligações)         |
+---------------------------------------------+
```

## O que vai em cada widget (só informações que o painel já tem)
1. **Roleta e Leads**: enviados para a Roleta, Fila CEO, corretores presentes, novo interesse, leads por corretor.
2. **Marketing**: leads gerados, leads por origem (Instagram, Facebook, site...), leads por empreendimento, reaproveitados da Oferta Ativa.
3. **Funil e Gestão de Leads**: funil das 7 etapas do Pipeline com emojis e cores, conversão entre etapas.
4. **Agenda de Visitas**: marcadas, realizadas, no-show, meta de visitas e comparação com o período anterior.
5. **Negócios**: total, em contrato, propostas, VGV assinado, funil Documentação → Proposta → Contrato → Ganho e vendas do período.
6. **Oferta Ativa**: ligações, aproveitados, taxa de aproveitamento, ranking de corretores e equipes.

As aprovações pendentes continuam aparecendo acima dos widgets quando houver.

## O que NÃO muda
- Números, regras, filtros, período e cliques que abrem detalhes: iguais aos de hoje.
- Celular continua com o layout aprovado.
- Cores variadas em listas e funis, emojis e Natal mantidos.

## Ordem
1. Desenho dos 6 widgets para sua aprovação (imagem).
2. Construir widgets 1 e 2 e te mostrar.
3. Widgets 3 e 4.
4. Widgets 5 e 6 e remoção das seções antigas.
5. Conferência ao vivo como CEO, nos temas claro e escuro, comparando os números com os de antes.

## Detalhes técnicos
- Novo `src/components/ceo/dashboard/widgets/` com uma peça por widget (cada uma abaixo de 300 linhas), montada com `src/components/ds/*` (Panel, StatCard, Charts, Lists, DataTable).
- Todos os dados vêm de `useCeoDashboardController`, sem mudanças; nada de novas consultas, banco ou regras.
- `DesktopDashboardContent` passa a montar a grade; os `Desktop*` antigos são removidos só no fim, depois da conferência.
