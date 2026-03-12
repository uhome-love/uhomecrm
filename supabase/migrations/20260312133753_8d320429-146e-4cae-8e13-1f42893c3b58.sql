-- Update Orygem (57290-UH) with extracted data
UPDATE empreendimento_overrides SET
  landing_titulo = 'Orygem Residence Club',
  landing_subtitulo = 'Sofisticação, conforto e segurança para viver a sua essência.',
  cor_primaria = '#5c4033',
  descricao = 'Condomínio fechado de casas em Teresópolis, Porto Alegre. Casas de 2 e 3 dormitórios com 150 a 173 m², pátio com churrasqueira, 3º pavimento com terraço e opções de uso. Espera para lareira, piscina e/ou spa. Lazer completo com infraestrutura de clube, incluindo Club House, piscinas, quadra de beach tennis, academia e muito mais. Localizado na Av. Engenheiro Ludolfo Boehl, 931 — entre a Zona Sul e a Zona Norte, no centro de inúmeras possibilidades.',
  diferenciais = ARRAY[
    'Casas de 2 e 3 Dorms | 150 a 173 m²',
    'Pátio com churrasqueira',
    '3º pavimento com terraço e opções de uso',
    'Espera para lareira, piscina e/ou spa',
    'Lazer completo com infraestrutura de clube',
    'Piscina com Deck Solarium e Spa',
    'Quadra de Beach Tennis e Mini-Quadra',
    'Academia, Salão de Festas e Sala de Jogos',
    'Quiosque Gourmet e Fogo de Chão',
    'Espaço Pet, Playground e Redário',
    'Market interno',
    'Teresópolis — 10 min da PUCRS, 5 min Bourbon'
  ],
  plantas = ARRAY[
    'https://www.encorp.com.br/wp-content/uploads/2024/01/Orygem-Residence-Club-Logo-1.png'
  ],
  mapa_url = NULL,
  updated_at = NOW()
WHERE codigo = '57290-UH';

-- Insert Casa Tua (52101-UH) if not exists
INSERT INTO empreendimento_overrides (
  codigo, landing_titulo, landing_subtitulo, cor_primaria, descricao, diferenciais, plantas, mapa_url, updated_at
) VALUES (
  '52101-UH',
  'Casa Tua — Alto Petrópolis',
  'Casa com a tua energia. Condomínio fechado de casas em Porto Alegre.',
  '#6b5b4e',
  'Condomínio fechado de casas no Alto Petrópolis, Porto Alegre. Casas de 2 e 3 dormitórios com 150 a 173 m², pátio privativo com churrasqueira, espera para lareira, piscina e/ou spa, e opção com 3º pavimento com terraço. Lazer completo com Club House: academia, Casinha Tua (brinquedoteca), sauna, sala de massagem, piscinas adulto e infantil, salão de festas, salão gourmet e sala de jogos. Área externa com quadra de beach tennis, mini quadra poliesportiva, parque de aventuras, pet place, quiosques gourmet e fogo de chão. Localizado na Av. Protásio Alves, 10.431.',
  ARRAY[
    'Casas de 2 e 3 Dorms | 150 a 173 m²',
    'Pátio privativo com churrasqueira',
    'Espera para lareira, piscina e/ou spa',
    'Opção com 3º pavimento com terraço',
    'Club House completo com academia e sauna',
    'Casinha Tua — brinquedoteca exclusiva',
    'Piscinas adulto e infantil',
    'Quadra de Beach Tennis e Mini Quadra',
    'Parque de Aventuras para todas as idades',
    'Pet Place, Fogo de Chão e Quiosques Gourmet',
    'Salão de Festas e Salão Gourmet',
    'Alto Petrópolis — próximo ao Bourbon Country e Santa Dorotéia'
  ],
  ARRAY[
    'https://www.encorp.com.br/wp-content/uploads/2025/08/44-PB_3D-Terreo-scaled.png',
    'https://www.encorp.com.br/wp-content/uploads/2025/08/45-PB_3D-02P-scaled.png',
    'https://www.encorp.com.br/wp-content/uploads/2025/08/46-PB_3D-Terraco-scaled.png',
    'https://www.encorp.com.br/wp-content/uploads/2025/08/47-PB_2D-Terreo-scaled.png',
    'https://www.encorp.com.br/wp-content/uploads/2025/08/48-PB_2D_02P-scaled.png'
  ],
  'https://www.encorp.com.br/wp-content/uploads/2025/08/map-teste.jpg',
  NOW()
) ON CONFLICT (codigo) DO UPDATE SET
  landing_titulo = EXCLUDED.landing_titulo,
  landing_subtitulo = EXCLUDED.landing_subtitulo,
  cor_primaria = EXCLUDED.cor_primaria,
  descricao = EXCLUDED.descricao,
  diferenciais = EXCLUDED.diferenciais,
  plantas = EXCLUDED.plantas,
  mapa_url = EXCLUDED.mapa_url,
  updated_at = NOW();