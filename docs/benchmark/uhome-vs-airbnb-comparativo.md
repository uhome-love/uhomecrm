# uhome.com.br × Airbnb — comparativo completo do site (19/11/2026)

Atualização do documento "Airbnb × uhome.com.br — raio-X completo e plano", com a mesma estrutura. Agora a coluna Uhome vem do site real, testado no celular (360, 390 e 430 px) e no computador (1440 px), e não de suposições.

**Legenda:** ✅ pronto · 🟡 parcial · ❌ falta · ➖ não se aplica a venda de imóveis

---

## 1. Resumo executivo

- A Uhome já reproduz quase toda a experiência do Airbnb que faz sentido para compra de imóvel:
  - busca em pílula e busca em etapas no celular;
  - categorias com ícone 3D;
  - mapa com preço em pílula e busca ao mover;
  - filtros com histograma e contagem ao vivo;
  - gaveta do mapa com 3 alturas;
  - card com deslize de fotos;
  - página do imóvel com 1 foto grande + 4 menores e botão fixo de visita.
- **Maior distância que sobrou:** a velocidade real no celular. A busca leva 4,7 s nos visitantes reais; o bom é até 2,5 s. As correções desta semana baixaram o laboratório de 5,1 s para 3,8 s e ainda precisam ser publicadas.
- **Por decisão de negócio, ficam de fora:**
  - nota agregada do Google e número de corretores;
  - total de imóveis em vitrine;
  - datas e hóspedes;
  - qualquer item de aluguel.

## 2. Placar por área (0 a 10)

| Área | Airbnb | Uhome (antes) | Uhome (hoje) | Base da nota de hoje |
|---|---:|---:|---:|---|
| Busca (entrada) | 10 | 6 | 9 | Pílula Onde/Tipo/Valor; etapas em tela cheia no celular |
| Resultados + mapa | 10 | 7 | 9 | Lista + mapa fixo; gaveta com alça e 3 alturas |
| Pinos do mapa | 10 | 5 | 9 | Pílula branca com preço em todo zoom, que cresce ao passar no card |
| Filtros | 9 | 6 | 9 | Painel por cima, histograma, contagem ao vivo, "Mostrar N imóveis" |
| Card de imóvel | 9 | 8 | 9 | Selos, coração, pontinhos, deslize com o dedo (iPhone a confirmar) |
| Página do imóvel | 10 | 6 | 8 | Fotos 1+4, faixa de atalhos, agendamento, botão fixo |
| Conversão | 9 | 8 | 9 | Visita, WhatsApp, simulação, Lia, corretor |
| Mobile | 10 | 6 | 8 | Nenhuma página mais larga que a tela; abas do topo removidas |
| Movimento e efeitos | 10 | 6 | 8 | Tokens de movimento, toque com leve encolhida, respeito a "menos movimento" |
| Design system | 10 | 6 | 8 | Azul Uhome, Montserrat, botões de 12 px, toques de 44 px |
| Performance (laboratório) | 5 | 8 | 8 | Busca no celular lento: 3,8 s (era 5,1 s) |
| Performance real (visitantes) | 10 | 6 | 5 | Busca: LCP 4,7 s e INP 0,42 s no celular, antes de publicar |
| Acessibilidade | 9 | ? | 7 | 118 rótulos de leitura de tela, foco no teclado na galeria; sem auditoria completa |
| SEO técnico | 9 | 5 | 8 | 2.395 títulos "Casa_condominio" corrigidos; canônico https; links do mapa do site |
| Prova social | 10 | 4 | 6 | Depoimentos e selos; sem nota agregada (decisão de negócio) |

## 3. Desktop, ponta a ponta

| Item | Airbnb | Uhome hoje | Status |
|---|---|---|---|
| Header | Abas com ícone 3D, encolhe ao rolar | Logo + pílula de busca + botão de filtros; sem abas | ✅ |
| Busca segmentada | Onde / Quando / Quem com painéis | Onde / Tipo / Valor com painéis por campo | ✅ |
| Autocomplete | Negrito no trecho e tipo do resultado | Cidade, bairro e endereço; nome oficial da cidade sem diferenciar maiúsculas | 🟡 falta separar visualmente "Empreendimento" e "Código" |
| Home | Faixas de destinos e "Vistos recentemente" | Categorias 3D, faixas de imóveis, bairros, Por que Uhome, perguntas frequentes | ✅ |
| Lista + mapa | 2 colunas + mapa fixo | Grade + mapa fixo (a partir de 1024 px) | ✅ |
| Mini card do pino | Carrossel, coração, fechar | Foto, preço, coração, fechar, pontinha apontando o preço | ✅ |
| Filtros (modal) | Recomendados, tipo, preço com histograma, cômodos, comodidades | Tipo (vários), preço com histograma, quartos, banheiros, vagas, áreas, fase, comodidades, novidades | ✅ |
| Ordenar | Não tem | Mais recentes, menor e maior preço (valores simbólicos vão para o fim) | ✅ |
| Página do imóvel | Mosaico, tour, card fixo de reserva | Mosaico 1+4, galeria com zoom e teclado, faixa de atalhos, card lateral de visita | ✅ |
| Tour por cômodo | Fotos agrupadas por ambiente | Galeria única (o cadastro não informa o cômodo de cada foto) | 🟡 |
| Login | Um campo, telefone ou email | Email e Google; favoritos funcionam sem login | 🟡 falta entrar por telefone |

## 4. Mobile, ponta a ponta

| Item | Airbnb | Uhome hoje | Status |
|---|---|---|---|
| Topo limpo | Busca + pílulas | Busca + botão de filtros; abas removidas do código | ✅ (aparece depois de publicar) |
| Busca em etapas | Onde → Quando → Quem | Onde → Tipo → Valor, um cartão aberto por vez | ✅ |
| Filtro abre na hora | Sim | Painel por cima, sem trocar de página | ✅ |
| Chips de filtro ativo | Sim | Chips com "x" e "Limpar filtros" | ✅ |
| Mapa + gaveta | Alça e alturas | Alça, 3 alturas, "Mostrar mapa" | ✅ |
| Deslize de fotos no card | Foto segue o dedo | Foto segue o dedo e encaixa; toque abre o imóvel | 🟡 confirmar no iPhone real |
| Página do imóvel | Foto cheia + CTA fixo | Foto + botão fixo "Agendar visita" | ✅ |
| Barra inferior | Explorar / Favoritos / Viagens / Mensagens / Perfil | Explorar / Favoritos / Lia / Entrar | ✅ |
| Lia por cima dos painéis | — | Some quando um painel está aberto | ✅ |

## 5. Fundamentos técnicos

| Item | Airbnb | Uhome hoje | Status |
|---|---|---|---|
| Tipografia | Fonte própria | Montserrat própria, sem pedir fontes de fora | ✅ |
| Cores | Tokens | Tokens semânticos, azul Uhome | ✅ |
| Tokens de movimento | Molas | Curva padrão e encolhida ao toque | 🟡 sem molas |
| Primeira tela | Servidor | Primeira tela pronta servida pela borda (Home e Busca) | ✅ |
| Peso das fotos | Variações por tela | WebP de 480 px, 12 a 30 KB por card; 1ª foto adiantada | ✅ |
| Peso do app | Dividido por tela | Arquivo principal de ~630 KB | ❌ próximo passo |

## 6. Performance real (visitantes, p75, últimos 7 dias, antes de publicar)

| Página | LCP celular | INP celular | CLS |
|---|---|---|---|
| Busca | 4,7 s (lento) | 0,42 s (lento) | 0,05 (bom) |
| Imóvel | 3,2 s | — | bom |
| Home | 2,6 s | — | bom |

**Já feito, aguardando publicação:**
- imóveis pedidos no início do carregamento;
- 1ª foto adiantada;
- fotos extras só depois que a página fica pronta.

No laboratório, a busca baixou de 5,1 s para 3,8 s.

## 7. Diferenças que ainda restam (por prioridade)

| Prioridade | O que falta | Por quê |
|---|---|---|
| **P0** | Publicar e medir os visitantes reais | As melhorias só valem depois de publicadas |
| **P0** | Diminuir o arquivo principal (~630 KB) | É o que ainda segura a busca acima de 2,5 s |
| **P0** | Resposta ao toque (INP 0,42 s) | Achar o que trava ao tocar em filtro ou card |
| P1 | Confirmar o deslize de fotos no iPhone real | Testado só com toque simulado |
| P1 | Tipos no autocomplete (Bairro / Empreendimento / Código) | Igual ao Airbnb, mais claro |
| P1 | Auditoria de acessibilidade completa | Hoje há rótulos, mas sem auditoria formal |
| P2 | Entrar por telefone com WhatsApp | Mais simples que email |
| P2 | Tour por cômodo | Depende de o cadastro informar o ambiente da foto |
| P2 | Molas no movimento | Acabamento fino |

## 8. Fora de escopo por decisão da Uhome

- ➖ **Datas e hóspedes:** é venda, não estadia.
- ➖ **Nota agregada do Google, número de corretores e total de imóveis em vitrine:** regras do projeto.
- ➖ **Aluguel e preços de aluguel.**
- ➖ **Avaliações por imóvel:** substituídas por depoimentos de clientes.

## 9. O que não foi possível testar

- Gestos no iPhone real: deslizar fotos, arrastar a bolinha do preço, arrastar faixas.
- Envio de contato e visita: pela regra do projeto, não se envia lead de teste.
- O efeito das melhorias de velocidade nos visitantes reais, que só aparece após publicar.

---

<!-- RETORNO -->
