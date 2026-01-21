// routes/tickets.js ou services/ticketService.js

async function reserveTicket(userId, eventId) {
  // 1. Verificar limite por usuário
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (event.maxTicketsPerUser > 0) {
    const count = await prisma.ticket.count({
      where: { userId, eventId, status: { in: [1, 2, 3, 5] } },
    });
    if (count >= event.maxTicketsPerUser) throw new Error("Limite atingido!");
  }

  // 2. Achar o lote ativo (que ainda tem vagas)
  const activeBatch = await prisma.batch.findFirst({
    where: { eventId, tickets: { none: { status: 4 } } }, // Simplificação lógica
    orderBy: { price: "asc" },
  });

  // 3. Criar ticket com status 1 (Gerado)
  const ticket = await prisma.ticket.create({
    data: { userId, eventId, batchId: activeBatch.id, status: 1 },
  });

  // 4. Disparar e-mail via Brevo
  await sendVerificationEmail(userEmail, userName, verificationUrl);

  return ticket;
}
