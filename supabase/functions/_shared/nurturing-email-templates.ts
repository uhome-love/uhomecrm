// =============================================================================
// Templates HTML para E-mails de Nutrição (Mailgun single mode)
// Usados pelo cron-nurturing-sequencer quando canal === "email"
// =============================================================================

export interface NurturingEmailTemplate {
  subject: string;
  html: (vars: Record<string, string>) => string;
}

const BRAND_COLOR = "#1a365d";
const ACCENT_COLOR = "#2563eb";
const BG_COLOR = "#f8fafc";
const SITE_URL = "https://uhome.com.br";

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:${BG_COLOR};color:#333}
.container{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.header{background:${BRAND_COLOR};padding:28px 32px;text-align:center}
.header h1{color:#fff;font-size:20px;margin:0;font-weight:700}
.header p{color:rgba(255,255,255,.8);font-size:13px;margin:6px 0 0}
.body{padding:32px}
.body p{font-size:15px;line-height:1.6;margin:0 0 16px;color:#444}
.cta{display:inline-block;background:${ACCENT_COLOR};color:#fff!important;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;margin:8px 0 24px}
.footer{padding:20px 32px;text-align:center;font-size:11px;color:#999;border-top:1px solid #eee}
</style></head>
<body><div class="container">${content}</div></body></html>`;
}

export const NURTURING_EMAIL_TEMPLATES: Record<string, NurturingEmailTemplate> = {
  "reativacao-vitrine": {
    subject: "{{nome}}, separei imóveis especiais para você! 🏡",
    html: (vars) => baseLayout(`
      <div class="header">
        <h1>Imóveis selecionados para você</h1>
        <p>Uhome Inteligência Imobiliária</p>
      </div>
      <div class="body">
        <p>Olá <strong>${vars.nome || "Cliente"}</strong>,</p>
        <p>Encontramos imóveis que combinam com o que você procura${vars.empreendimento ? ` em <strong>${vars.empreendimento}</strong>` : ""}. Preparamos uma vitrine exclusiva com as melhores opções.</p>
        <p>Confira agora com um clique:</p>
        <p style="text-align:center">
          <a href="${vars.vitrine_url || SITE_URL + "/discover"}" class="cta">Ver Meus Imóveis →</a>
        </p>
        <p style="font-size:13px;color:#888">Se preferir, responda este e-mail ou fale diretamente com ${vars.corretor_nome || "seu corretor"} pelo WhatsApp.</p>
      </div>
      <div class="footer">
        <p>Uhome Inteligência Imobiliária · ${SITE_URL}</p>
        <p>Você recebeu este e-mail porque se cadastrou em nosso sistema.</p>
      </div>
    `),
  },

  "novidades-mercado": {
    subject: "Novidades do mercado imobiliário para você, {{nome}}! 📰",
    html: (vars) => baseLayout(`
      <div class="header">
        <h1>Novidades no Mercado</h1>
        <p>Conheça nosso novo site e as melhores oportunidades</p>
      </div>
      <div class="body">
        <p>Olá <strong>${vars.nome || "Cliente"}</strong>,</p>
        <p>O mercado imobiliário de Porto Alegre está cheio de oportunidades! Lançamos nosso <strong>novo site</strong> com uma experiência completamente renovada para você encontrar seu imóvel ideal.</p>
        <p>✅ Busca inteligente por bairro e faixa de preço<br>
           ✅ Vitrines personalizadas pelo seu corretor<br>
           ✅ Tour virtual e galeria completa de fotos</p>
        <p style="text-align:center">
          <a href="${vars.vitrine_url || SITE_URL + "/discover"}" class="cta">Explorar Imóveis →</a>
        </p>
        <p style="font-size:13px;color:#888">Quer ajuda? Fale com ${vars.corretor_nome || "um dos nossos corretores"} — estamos prontos para te atender.</p>
      </div>
      <div class="footer">
        <p>Uhome Inteligência Imobiliária · ${SITE_URL}</p>
        <p>Você recebeu este e-mail porque se cadastrou em nosso sistema.</p>
      </div>
    `),
  },

  "ultimo-lembrete": {
    subject: "{{nome}}, ainda estamos aqui para te ajudar! ⏰",
    html: (vars) => baseLayout(`
      <div class="header">
        <h1>Não perca essa oportunidade</h1>
        <p>Último lembrete antes de encerrarmos o atendimento</p>
      </div>
      <div class="body">
        <p>Olá <strong>${vars.nome || "Cliente"}</strong>,</p>
        <p>Notamos que você ainda não conferiu os imóveis que separamos. As condições especiais podem mudar a qualquer momento!</p>
        <p>Se o seu momento mudou, tudo bem — mas se ainda está buscando, estamos aqui para ajudar.</p>
        <p style="text-align:center">
          <a href="${vars.vitrine_url || SITE_URL + "/discover"}" class="cta">Ver Imóveis Agora →</a>
        </p>
        <p style="text-align:center;margin-top:8px">
          <a href="https://wa.me/555130850389?text=Oi! Quero saber sobre imóveis" style="color:${ACCENT_COLOR};font-size:14px;text-decoration:underline">Ou fale direto pelo WhatsApp →</a>
        </p>
      </div>
      <div class="footer">
        <p>Uhome Inteligência Imobiliária · ${SITE_URL}</p>
        <p>Você recebeu este e-mail porque se cadastrou em nosso sistema.</p>
      </div>
    `),
  },
};

export function renderNurturingEmail(
  templateKey: string,
  variables: Record<string, string>,
): { subject: string; html: string } | null {
  const template = NURTURING_EMAIL_TEMPLATES[templateKey];
  if (!template) return null;

  let subject = template.subject;
  for (const [key, value] of Object.entries(variables)) {
    subject = subject.replaceAll(`{{${key}}}`, value || "");
  }

  return {
    subject,
    html: template.html(variables),
  };
}
