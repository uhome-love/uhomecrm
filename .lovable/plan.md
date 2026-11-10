# Pipeline de Leads e Negócios — minha visão como desenvolvedor (visão CEO)

Esta é uma opinião, baseada nas 8 telas enviadas. Nada será alterado sem desenho e aprovação de cada item.

## O que eu manteria
- **As 10 etapas** e Negócios como continuação do mesmo cliente. É simples e verdadeiro.
- **Cartão do cliente**: nome, produto, telefone, última atividade colorida e corretor. Lê rápido.
- **Bolinhas verde/amarelo/vermelho no topo** (1.689 / 193 / 25): mostram a saúde da carteira num olhar.
- **Ficha com "Próxima ação" e Registrar** em destaque: leva o corretor a agir.
- **Abas Equipes / Leads / Negócios** e **Empresa / Meus leads**.

## O que eu mudaria (por ordem de impacto)

### 1. Erros que aparecem nas telas
- **Tarefa e visita com datas diferentes**: o cliente Matheus Martins tem "Confirmar visita" amanhã (11/11, 10h), mas a visita está marcada para quinta (12/11, 14h). Precisa conferir se a confirmação deveria ser no dia da visita ou na véspera, e deixar isso claro no cartão.
- **"Desatualizado 5d" com visita marcada**: um cliente com visita futura não deveria aparecer vermelho. Isso gera falsa cobrança.
- **Origens repetidas no filtro**: "Facebook Leads Ads", "FacebookAds", "fb", "meta ads" e "meta backfill" são a mesma coisa. Juntar em poucos nomes (Meta, Site, Indicação, Oferta Ativa, Lia, TikTok, Outros).

### 2. Visão CEO: o que falta enxergar
- **Gargalo visível**: Qualificação tem 855 clientes (fica 24 dias em média) e Aquecimento 603 (47 dias). Mostrar no topo de cada coluna quantos estão parados há muito tempo e um botão "ver parados".
- **Valor por etapa com sentido**: hoje aparece "R$ 7,2M" em Aquecimento, que é um valor estimado. Para o CEO, o valor importa a partir de Visita. Eu mostraria o valor só de Visita para frente e o número de clientes antes disso.
- **Faixa de conversão**: uma linha fina mostrando quantos passam de uma etapa para a próxima no mês (ex.: Qualificação → Visita 8%).

### 3. Limpeza visual
- O aviso "127 em Ganho... 15 em Negócios" ocupa uma linha inteira. Transformar em dois atalhos pequenos.
- A linha de etapas acima das colunas repete as colunas. Manter só uma, que serve para pular até a etapa.
- Selos demais no cartão (Quente + Visita marcada + T5 24h + c/ Roni). Mostrar no máximo dois e o resto na ficha.
- Na ficha, "Status da Etapa" fica escondido embaixo. Subir para perto do nome.

### 4. Negócios
- Coluna de Proposta e Contrato com **valor e data prevista de assinatura** bem visíveis.
- Aviso quando um negócio fica mais de X dias sem andar.

### 5. Ficha do cliente — como eu organizaria

```text
+-------------------------------------------------------------+
| MM  Matheus Martins          [Visita v]  Quente   (x)       |
|     Open Bosque · fb · entrou 24/10 · Rafaela Sandin        |
|     [Ligar] [WhatsApp] [Anotar] [...]                       |
+----------------------------+--------------------------------+
| AGORA                      | Linha do tempo | Tarefas | Visitas | Dados |
| Visita qui 12/11 14h       |                                |
| Confirmar amanhã 10h       |  tudo em ordem de data,        |
| [Registrar atividade]      |  com filtro por tipo           |
|                            |                                |
| Situação da etapa          |                                |
| Visita marcada             |                                |
|                            |                                |
| Negócio (se houver)        |                                |
| valor · previsão           |                                |
+----------------------------+--------------------------------+
```

- **Topo fixo** com nome, etapa, temperatura, produto, origem, corretor e os botões de contato. Fica sempre visível, mesmo rolando.
- **Coluna esquerda "Agora"**: só o que precisa de ação: próxima visita, próxima tarefa, um botão principal e a situação da etapa (hoje está escondida embaixo).
- **Coluna direita com 4 abas**: Linha do tempo, Tarefas, Visitas e Dados (origem, anúncio, formulário e respostas saem da esquerda e vão para cá).
- **Telefone e e-mail** viram linha pequena com botão de copiar, sem ocupar espaço grande.
- **"Ações admin"** vai para dentro do menu "...", não fica solto.
- **Celular**: topo compacto, "Agora" em cima e as abas embaixo, com botões fixos no rodapé.

## Estamos no máximo?
Não, mas estamos perto de um CRM bom de mercado. Sincero:
- **Bom nível**: funções (Roleta, Oferta Ativa, Lia, Financeiro) e regras estão acima da maioria dos CRMs imobiliários.
- **Onde ainda perde para os melhores (Pipedrive, HubSpot, Attio)**: muitos selos e emojis competindo; informação repetida (etapas em dobro, avisos longos); a ficha tem a ação importante misturada com dados de consulta; pouca animação suave ao abrir e mover; cores ainda variam de tela para tela; muitas telas não têm versão própria no celular.
- **Para chegar ao topo**: menos coisas por tela, uma ação principal clara, mesmo padrão em todas as páginas e movimento suave. É exatamente o que as fases visuais já aprovadas estão fazendo; a ficha seria a próxima peça mais valiosa.

## Como seguiria
1. Você escolhe quais itens entram.
2. Primeiro investigo os erros do bloco 1 nos dados (sem mexer).
3. Desenho de cada mudança visual (computador e celular) para aprovação.
4. Construo uma fase por vez e confiro ao vivo, sem mexer nos números oficiais.
