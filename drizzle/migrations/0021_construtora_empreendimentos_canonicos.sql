ALTER TABLE public.empreendimentos_canonicos ADD COLUMN IF NOT EXISTS construtora text;
UPDATE public.empreendimentos_canonicos SET construtora = CASE nome
 WHEN 'Open Bosque' THEN 'Open' WHEN 'Open Arvoredo' THEN 'Open'
 WHEN 'Shift' THEN 'Plaenge'
 WHEN 'The Arch' THEN 'Cyrela' WHEN 'Boa Vista' THEN 'Cyrela' WHEN 'Connect JW' THEN 'Cyrela' WHEN 'Skyline Menino Deus' THEN 'Cyrela' WHEN 'Jp Redenção' THEN 'Cyrela'
 WHEN 'Grand Park Moinhos' THEN 'Melnick'
 WHEN 'Duetto Morana' THEN 'Morana'
 WHEN 'Lake Eyre' THEN 'Multiplan'
 WHEN 'Átrio' THEN 'ABF' WHEN 'Casa Bastian' THEN 'ABF' WHEN 'Hola' THEN 'ABF'
 WHEN 'Vértice Las Casas' THEN 'Suelo'
 WHEN 'Casa Tua Porto Alegre' THEN 'Encorp' WHEN 'Casa Tua Canoas' THEN 'Encorp'
 WHEN 'Lév' THEN 'Giardino'
 WHEN 'Alto Lindóia' THEN 'Florença'
 WHEN 'Villa Pietra' THEN 'Krebs'
 WHEN 'Avulso' THEN 'Imóvel de terceiros'
 ELSE construtora END
WHERE construtora IS NULL;