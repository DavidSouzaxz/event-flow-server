const SibApiV3Sdk = require("sib-api-v3-sdk");

// Configuração do cliente
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

/**
 * Envia e-mail de confirmação de reserva
 */
async function sendBookingEmail(userEmail, userName, eventDetails) {
  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

  sendSmtpEmail.subject = `Confirmado: ${eventDetails.title}`;
  sendSmtpEmail.sender = { name: "EventFlow 🎟️", email: process.env.MAIL_USER };
  sendSmtpEmail.to = [{ email: userEmail, name: userName }];
  sendSmtpEmail.htmlContent = `
        <div style="background-color: #f3f4f6; padding: 40px 10px; font-family: sans-serif;">
            <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 24px; padding: 40px;">
                <h1 style="color: #4f46e5;">EventFlow</h1>
                <h2>Olá, ${userName}! 👋</h2>
                <p>Sua reserva para <strong>${eventDetails.title}</strong> foi confirmada.</p>
                <div style="background-color: #f9fafb; padding: 20px; border-radius: 15px;">
                    <p><strong>Data:</strong> ${eventDetails.date}</p>
                    <p><strong>Local:</strong> ${eventDetails.location}</p>
                    <p><strong>Ingressos:</strong> ${eventDetails.quantity}</p>
                </div>
                <br>
                <a href="https://event-flow-client-azure.vercel.app/my-tickets" 
                   style="background-color: #4f46e5; color: white; padding: 15px 25px; text-decoration: none; border-radius: 10px; display: inline-block;">
                   Ver meus Ingressos
                </a>
            </div>
        </div>`;

  try {
    return await apiInstance.sendTransacEmail(sendSmtpEmail);
  } catch (error) {
    console.error("Erro Brevo Booking:", error);
    throw error;
  }
}

/**
 * Envia e-mail de verificação de conta
 */
async function sendVerificationEmail(userEmail, userName, verificationUrl) {
  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

  sendSmtpEmail.subject = "Ative sua conta no EventFlow";
  sendSmtpEmail.sender = { name: "EventFlow 🎟️", email: process.env.MAIL_USER };
  sendSmtpEmail.to = [{ email: userEmail, name: userName }];
  sendSmtpEmail.htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 40px; border: 1px solid #eee; border-radius: 20px;">
            <h1 style="color: #4f46e5;">Olá, ${userName}!</h1>
            <p>Clique no botão abaixo para ativar sua conta no EventFlow:</p>
            <a href="${verificationUrl}" 
               style="background-color: #4f46e5; color: white; padding: 15px 25px; text-decoration: none; border-radius: 10px; display: inline-block;">
                Verificar E-mail
            </a>
        </div>`;

  try {
    return await apiInstance.sendTransacEmail(sendSmtpEmail);
  } catch (error) {
    console.error("Erro Brevo Verification:", error);
    throw error;
  }
}

module.exports = { sendBookingEmail, sendVerificationEmail };
