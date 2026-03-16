import { useEffect } from "react";

export default function PrivacidadePage() {
  useEffect(() => {
    document.title = "Política de Privacidade | UhomeSales";
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-800">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">Política de Privacidade</h1>
        <p className="text-sm text-gray-500 mb-10">Última atualização: 16 de março de 2026</p>

        <div className="space-y-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Introdução</h2>
            <p>A <strong>UhomeSales</strong> ("nós", "nosso") é uma assessoria imobiliária sediada em Porto Alegre, RS, Brasil. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações pessoais quando você utiliza nosso site e serviços.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Dados que Coletamos</h2>
            <p>Podemos coletar os seguintes dados pessoais:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Dados de identificação:</strong> nome, e-mail, telefone.</li>
              <li><strong>Dados de interesse:</strong> empreendimentos de interesse, preferências de imóveis.</li>
              <li><strong>Dados de navegação:</strong> endereço IP, tipo de navegador, páginas visitadas, cookies.</li>
              <li><strong>Dados de comunicação:</strong> mensagens enviadas via formulários, WhatsApp ou e-mail.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Como Coletamos seus Dados</h2>
            <p>Seus dados são coletados quando você:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Preenche formulários em nosso site ou landing pages.</li>
              <li>Entra em contato conosco via WhatsApp, e-mail ou telefone.</li>
              <li>Participa de eventos, campanhas ou promoções imobiliárias.</li>
              <li>Navega em nosso site (dados de navegação via cookies).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Finalidade do Uso dos Dados</h2>
            <p>Utilizamos seus dados para:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Apresentar empreendimentos e oportunidades imobiliárias compatíveis com seu perfil.</li>
              <li>Enviar comunicações de marketing sobre promoções e eventos (com seu consentimento).</li>
              <li>Prestar atendimento personalizado e acompanhamento comercial.</li>
              <li>Melhorar nossos serviços e experiência do usuário.</li>
              <li>Cumprir obrigações legais e regulatórias.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Compartilhamento de Dados</h2>
            <p>Seus dados podem ser compartilhados com:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Incorporadoras parceiras:</strong> para viabilizar o atendimento e negociação de imóveis.</li>
              <li><strong>Prestadores de serviço:</strong> plataformas de e-mail marketing, CRM e comunicação, sempre com cláusulas de confidencialidade.</li>
            </ul>
            <p className="mt-2">Não vendemos, alugamos ou compartilhamos seus dados com terceiros para fins não relacionados aos nossos serviços.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Armazenamento e Segurança</h2>
            <p>Seus dados são armazenados em servidores seguros com criptografia e controles de acesso. Adotamos medidas técnicas e organizacionais para proteger suas informações contra acesso não autorizado, perda ou destruição.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Seus Direitos (LGPD)</h2>
            <p>De acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem direito a:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Confirmar a existência de tratamento de seus dados.</li>
              <li>Acessar, corrigir ou atualizar seus dados.</li>
              <li>Solicitar a exclusão de seus dados pessoais.</li>
              <li>Revogar o consentimento para comunicações de marketing.</li>
              <li>Solicitar a portabilidade dos seus dados.</li>
            </ul>
            <p className="mt-2">Para exercer seus direitos, entre em contato pelo e-mail: <a href="mailto:lucas@uhome.imb.br" className="text-blue-600 underline">lucas@uhome.imb.br</a></p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Cookies</h2>
            <p>Utilizamos cookies para melhorar sua experiência de navegação, analisar tráfego e personalizar conteúdo. Você pode gerenciar as preferências de cookies nas configurações do seu navegador.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Comunicações de Marketing</h2>
            <p>Ao fornecer seu e-mail ou telefone, você consente em receber comunicações sobre oportunidades imobiliárias. Você pode cancelar o recebimento a qualquer momento clicando no link de descadastro presente em nossos e-mails ou entrando em contato conosco.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Alterações nesta Política</h2>
            <p>Esta política pode ser atualizada periodicamente. Recomendamos que você a consulte regularmente. Alterações significativas serão comunicadas através de nossos canais.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">11. Contato</h2>
            <p><strong>UhomeSales — Assessoria Imobiliária</strong></p>
            <p>Porto Alegre, RS, Brasil</p>
            <p>E-mail: <a href="mailto:lucas@uhome.imb.br" className="text-blue-600 underline">lucas@uhome.imb.br</a></p>
            <p>Site: <a href="https://uhomesales.com" className="text-blue-600 underline">uhomesales.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
