/**
 * Shared mapping utility: Typesense document → UI card format.
 * Single source of truth for ImoveisPage, useAISearch, and any future consumer.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface MappedProperty {
  [key: string]: any;
  codigo: string;
  titulo_anuncio: string;
  empreendimento_nome: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_logradouro: string;
  valor_venda: number;
  valor_locacao: number;
  area_privativa: number;
  garagens: number;
  suites: number;
  banheiros: number;
  dormitorios: number;
  valor_condominio: number;
  situacao: string;
  latitude: number | null;
  longitude: number | null;
  _fotos_normalized: string[];
  _fotos_full: string[];
  imagens: { link_thumb: string; link: string; link_large: string }[];
}

/**
 * Maps a raw Typesense document to the card-compatible format
 * used throughout the Imóveis UI.
 */
export function mapTypesenseDoc(doc: any): MappedProperty {
  const fotos: string[] = doc.fotos?.length ? doc.fotos : doc.foto_principal ? [doc.foto_principal] : [];
  const fotosFull: string[] = doc.fotos_full?.length ? doc.fotos_full : fotos;

  return {
    ...doc,
    codigo: doc.codigo || doc.id,
    titulo_anuncio: doc.titulo,
    empreendimento_nome: doc.empreendimento,
    endereco_bairro: doc.bairro,
    endereco_cidade: doc.cidade,
    endereco_logradouro: doc.endereco,
    valor_venda: doc.valor_venda,
    valor_locacao: doc.valor_locacao,
    area_privativa: doc.area_privativa,
    garagens: doc.vagas,
    suites: doc.suites,
    banheiros: doc.banheiros,
    dormitorios: doc.dormitorios,
    valor_condominio: doc.valor_condominio,
    situacao: doc.situacao,
    latitude: doc.latitude ?? null,
    longitude: doc.longitude ?? null,
    _fotos_normalized: fotos,
    _fotos_full: fotosFull,
    imagens: fotos.map((url: string, i: number) => ({
      link_thumb: url,
      link: fotosFull[i] || url,
      link_large: fotosFull[i] || url,
    })),
  };
}

/**
 * Maps an array of Typesense documents.
 */
export function mapTypesenseDocs(docs: any[]): MappedProperty[] {
  return docs.map(mapTypesenseDoc);
}
