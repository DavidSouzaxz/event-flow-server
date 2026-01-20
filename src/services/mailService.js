const { Resend } = require("resend");

// Substitua pela sua chave ou use process.env
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendBookingEmail(userEmail, userName, eventDetails) {
  try {
    await resend.emails.send({
      from: "EventFlow <onboarding@resend.dev>", // No plano gratuito use esse remetente
      to: userEmail,
      subject: `Confirmado: ${eventDetails.title}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h1 style="color: #4f46e5;">EventFlow</h1>
          <h2>Olá, ${userName}!</h2>
          <p>Sua reserva para <strong>${eventDetails.title}</strong> está confirmada.</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 10px;">
            <p><strong>Data:</strong> ${eventDetails.date}</p>
            <p><strong>Local:</strong> ${eventDetails.location}</p>
            <p><strong>Ingressos:</strong> ${eventDetails.quantity}</p>
          </div>
          <br />
          <a href="https://event-flow-client-azure.vercel.app/my-tickets" 
             style="background: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
             Ver meus ingressos
          </a>
        </div>
      `,
    });
  } catch (error) {
    console.error("Erro Resend:", error);
  }
}

async function sendVerificationEmail(userEmail, userName, verificationUrl) {
  try {
    await resend.emails.send({
      from: "EventFlow <onboarding@resend.dev>",
      to: userEmail,
      subject: "Ative sua conta no EventFlow",
      html: `
        <div style="font-family: sans-serif; text-align: center;">
          <h1 style="color: #4f46e5;">Bem-vindo ao EventFlow!</h1>
          <p>Olá ${userName}, clique no botão abaixo para verificar seu e-mail:</p>
          <a href="${verificationUrl}" 
             style="background: #4f46e5; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; display: inline-block; margin-top: 20px;">
             Verificar Conta
          </a>
        </div>
      `,
    });
  } catch (error) {
    console.error("Erro Resend Verificação:", error);
  }
}

module.exports = { sendBookingEmail, sendVerificationEmail };
