
-- Update Orygem (57290-UH) with real photos from Encorp site
UPDATE empreendimento_overrides SET
  fotos = ARRAY[
    'https://www.encorp.com.br/wp-content/uploads/2024/01/08-Club_house_piscina-copiar.webp',
    'https://www.encorp.com.br/wp-content/uploads/2024/01/07-Frontal_clube-R02-copiar.webp',
    'https://www.encorp.com.br/wp-content/uploads/2024/05/15-Market-scaled.jpg',
    'https://www.encorp.com.br/wp-content/uploads/2024/01/Orygem-Residence-Club-Logo-1.png'
  ],
  mapa_url = 'https://www.encorp.com.br/wp-content/uploads/2024/01/Mapa-Orygem.webp',
  video_url = 'https://youtu.be/a1XjjW8MvVc',
  updated_at = NOW()
WHERE codigo = '57290-UH';

-- Update Casa Tua (52101-UH) with real photos from Encorp site
UPDATE empreendimento_overrides SET
  fotos = ARRAY[
    'https://www.encorp.com.br/wp-content/uploads/2025/08/07-Rua_app-Ceu-Maior-scaled.webp',
    'https://www.encorp.com.br/wp-content/uploads/2025/08/07-Rua_app-scaled.webp',
    'https://www.encorp.com.br/wp-content/uploads/2025/08/07-Rua_app-Maior-IA-scaled.webp',
    'https://www.encorp.com.br/wp-content/uploads/2025/08/Logo-Casa-Tua.png'
  ],
  video_url = 'https://youtu.be/5KUO72QmEu8',
  updated_at = NOW()
WHERE codigo = '52101-UH';
