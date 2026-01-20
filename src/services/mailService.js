const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

async function sendBookingEmail(userEmail, userName, eventDetails) {
  const mailOptions = {
    from: `"EventFlow 🎟️" <${process.env.MAIL_USER}>`,
    to: userEmail,
    subject: `Confirmado: ${eventDetails.title}`,
    html: `
        <div style="background-color: #f3f4f6; padding: 40px 10px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
                
                <div style="background-color: #4f46e5; padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -1px;">EventFlow</h1>
                    <p style="color: #e0e7ff; margin: 5px 0 0 0; font-size: 14px; font-weight: 500;">Sua reserva está confirmada!</p>
                    </div>

                <div style="padding: 40px 30px;">
                    <h2 style="color: #111827; margin: 0 0 20px 0; font-size: 22px; font-weight: 800;">Olá, ${userName}! 👋</h2>
                    <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                        Prepare-se! Sua reserva para o evento <strong>${eventDetails.title}</strong> foi concluída com sucesso. Abaixo estão os detalhes do seu ingresso:
                    </p>

                <div style="background-color: #f9fafb; border: 2px dashed #e5e7eb; border-radius: 20px; padding: 25px; margin-bottom: 30px;">
                    <div style="margin-bottom: 15px;">
                        <span style="color: #9ca3af; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Data do Evento</span>
                        <p style="color: #111827; margin: 2px 0; font-size: 16px; font-weight: 700;">${eventDetails.date}</p>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <span style="color: #9ca3af; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Localização</span>
                        <p style="color: #111827; margin: 2px 0; font-size: 16px; font-weight: 700;">${eventDetails.location}</p>
                    </div>

                    <div>
                        <span style="color: #9ca3af; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Ingressos</span>
                        <p style="color: #4f46e5; margin: 2px 0; font-size: 20px; font-weight: 900;">${eventDetails.quantity}x Entrada Inteira</p>
                    </div>
                </div>

                <div style="text-align: center;">
                    <a href="https://event-flow-client-azure.vercel.app/my-tickets" 
                    style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 18px 35px; border-radius: 16px; text-decoration: none; font-weight: 800; font-size: 16px; transition: background-color 0.3s;">
                    Acessar meus Ingressos
                    </a>
                </div>
                </div>

                <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #f3f4f6;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                        Este é um e-mail automático enviado pelo sistema EventFlow.<br>
                        Não é necessário responder a esta mensagem.
                    </p>
                </div>
            </div>
        
        <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">
            &copy; 2026 EventFlow Dashboard Project. Desenvolvido por David Souza.
        </p>
    </div>
        `,
  };

  return transporter.sendMail(mailOptions);
}

async function sendVerificationEmail(userEmail, userName, verificationUrl) {
  const mailOptions = {
    from: `"EventFlow 🎟️" <${process.env.MAIL_USER}>`,
    to: userEmail,
    subject: "Ative sua conta no EventFlow",
    html: `
      <h1>Olá, ${userName}!</h1>
      <p>Obrigado por se cadastrar. Clique no botão abaixo para ativar sua conta:</p>
      <a href="${verificationUrl}" style="background: #4f46e5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 8px;">
        Verificar E-mail
      </a>
    `,
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendBookingEmail, sendVerificationEmail };
