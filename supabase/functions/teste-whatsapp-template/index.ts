const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!;
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!;
const UHOMESITE_URL = Deno.env.get('UHOMESITE_URL') || 'https://uhome.com.br';

function gerarSlug(titulo: string, codigo: string): string {
  const slug = titulo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-').replace(/-+/g,'-').slice(0,60);
  return slug + '-' + codigo;
}

Deno.serve(async (_req) => {
  const linkImovel = UHOMESITE_URL + '/imovel/' + gerarSlug('Casa em Condomínio no Alto Petrópolis', '52101-UH');

  const payload = { messaging_product: 'whatsapp', to: '5551992597097', type: 'template', template: { name: 'vitrine_imoveis_personalizada', language: { code: 'pt_BR' }, components: [{ type: 'body', parameters: [{ type: 'text', text: 'Lucas' },{ type: 'text', text: 'Casa em Condomínio no Alto Petrópolis' },{ type: 'text', text: 'Petrópolis' },{ type: 'text', text: 'Casa de Condomínio' },{ type: 'text', text: 'R$ 545.000' },{ type: 'text', text: linkImovel }] }] } };

  const r = await fetch('https://graph.facebook.com/v19.0/' + WHATSAPP_PHONE_NUMBER_ID + '/messages', { method: 'POST', headers: { Authorization: 'Bearer ' + WHATSAPP_ACCESS_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

  const res = await r.json();

  return new Response(JSON.stringify({ sucesso: r.ok, link_gerado: linkImovel, resposta_meta: res }), { headers: { 'Content-Type': 'application/json' } });
});
