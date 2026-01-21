try {
  require("dotenv").config();
} catch (e) {}
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const authMiddleware = require("./middlewares/auth");
const isAdminMiddleware = require("./middlewares/isAdmin");
const { upload } = require("./config/cloudinary");
const {
  sendBookingEmail,
  sendVerificationEmail,
} = require("./services/mailService");
const { deleteFromCloudinary } = require("./services/cloudinary");
const cron = require("node-cron");

const baseUrl = process.env.BASE_URL || "http://localhost:5173";
const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server rodando na porta ${PORT}`);
});

cron.schedule("*/5 * * * *", async () => {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  try {
    const ticketsToCancel = await prisma.ticket.findMany({
      where: {
        status: 1,
        createdAt: { lt: thirtyMinutesAgo },
      },
      select: { eventId: true },
    });

    if (ticketsToCancel.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.ticket.updateMany({
          where: {
            status: 1,
            createdAt: { lt: thirtyMinutesAgo },
          },
          data: { status: 4 },
        });

        for (const ticket of ticketsToCancel) {
          await tx.event.update({
            where: { id: ticket.eventId },
            data: { capacity: { increment: 1 } },
          });
        }
      });
    }
  } catch (error) {
    return ("Erro no Cron de limpeza:", error);
  }
});

app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  const verificationToken = crypto.randomBytes(32).toString("hex");

  try {
    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) return res.status(400).json({ error: "Usuário já existe" });

    if (name.length <= 0 || email.length <= 0 || password.length < 6) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, verificationToken },
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar usuário" });
  }
});

app.get("/verify-email", async (req, res) => {
  const { token } = req.query;
  const urlLogin = `${baseUrl}/login`;

  const user = await prisma.user.findFirst({
    where: { verificationToken: token },
  });

  if (!user) {
    return res.status(400).json({ error: "Token inválido ou já utilizado" });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      verified: true,
      verificationToken: null,
    },
  });

  res.redirect(urlLogin);
});

app.post("/send-verify-email", async (req, res) => {
  const { email } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    const verificationToken = crypto.randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken },
    });

    const serverUrl = process.env.SERVER_URL || `http://localhost:${PORT}`;
    const verificationUrl = `${serverUrl}/verify-email?token=${verificationToken}`;
    await sendVerificationEmail(user.email, user.name, verificationUrl);

    res.json({ message: "E-mail de verificação enviado!" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao enviar e-mail de verificação" });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Credenciais inválidas" });

    if (!user.verified) {
      return res.status(403).json({ error: "E-mail não verificado" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      return res.status(401).json({ error: "Credenciais inválidas" });

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: "Erro no servidor" });
  }
});

app.get("/events", async (req, res) => {
  const events = await prisma.event.findMany({
    include: { owner: { select: { name: true } } },
  });
  res.json(events);
});

app.post(
  "/events",
  authMiddleware,
  isAdminMiddleware,
  upload.single("image"),
  async (req, res) => {
    const {
      title,
      description,
      date,
      location,
      price,
      capacity,
      ticketLimitPerPerson,
    } = req.body;

    try {
      let imageUrl = req.body.imageUrl;

      if (req.file) {
        imageUrl = req.file.path;
      }

      const event = await prisma.event.create({
        data: {
          title,
          description,
          date: new Date(date),
          capacity: Number(capacity),
          location,
          price: parseFloat(price),
          imageUrl,
          ownerId: req.user.id,
          ticketLimitPerPerson: Number(ticketLimitPerPerson),
        },
      });
      res.status(201).json(event);
    } catch (error) {
      res.status(400).json({ error: "Erro ao criar evento" });
    }
  },
);

app.get("/events/:id", async (req, res) => {
  const { id } = req.params;
  const event = await prisma.event.findUnique({
    where: { id },
    include: { owner: { select: { name: true } } },
  });
  res.json(event);
});

app.get("/events/:id/availability", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      return res.status(404).json({ error: "Evento não encontrado" });
    }

    const userTicketCount = await prisma.ticket.count({
      where: {
        eventId: id,
        userId: userId,
        status: { not: 4 }, // Ignora ingressos cancelados/reembolsados
      },
    });

    const hasReachedLimit = userTicketCount >= event.ticketLimitPerPerson;

    res.json({
      hasReachedLimit,
      userTicketCount,
      ticketLimitPerPerson: event.ticketLimitPerPerson,
      canBuy: !hasReachedLimit && event.capacity > 0,
    });
  } catch (error) {
    console.error("Erro ao verificar disponibilidade:", error);
    res.status(500).json({ error: "Erro ao verificar disponibilidade" });
  }
});

app.post("/bookings", authMiddleware, async (req, res) => {
  const { eventId, quantity } = req.body;
  const qty = Number(quantity);
  const userId = req.user.id;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: eventId },
      });

      if (!event) throw new Error("Evento não encontrado");

      const userTicketCount = await prisma.ticket.count({
        where: {
          eventId: eventId,
          userId: userId,
          status: { not: 4 },
        },
      });

      if (userTicketCount + qty > event.ticketLimitPerPerson) {
        return res.status(400).json({
          error: `Você já possui ${userTicketCount} ingresso(s). O limite para este evento é de ${event.ticketLimitPerPerson} por pessoa.`,
        });
      }

      if (event.capacity < qty) {
        throw new Error("Capacidade insuficiente para este evento.");
      }

      await tx.event.update({
        where: { id: eventId },
        data: { capacity: { decrement: qty } },
      });

      const ticketData = Array.from({ length: qty }).map(() => ({
        eventId,
        userId: req.user.id,
        status: 1,
      }));

      return await tx.ticket.createMany({ data: ticketData });
    });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const event = await prisma.event.findUnique({ where: { id: eventId } });

    const serverUrl = process.env.SERVER_URL || `http://localhost:${PORT}`;
    const confirmationUrl = `${serverUrl}/confirm-booking?userId=${req.user.id}&eventId=${eventId}`;

    await sendBookingEmail(
      user.email,
      user.name,
      {
        title: event.title,
        location: event.location,
        date: event.date.toISOString().split("T")[0],
        quantity: qty,
      },
      confirmationUrl,
    );

    res.status(201).json({ message: "Reserva gerada! Verifique seu e-mail." });
  } catch (error) {
    res
      .status(400)
      .json({ error: error.message || "Erro ao processar reserva" });
  }
});

app.get("/admin/tickets/pendentes", authMiddleware, async (req, res) => {
  try {
    const tickets = await prisma.ticket.findMany({
      where: {
        status: 3,
        event: {
          ownerId: req.user.id,
        },
      },
      include: {
        user: { select: { name: true, email: true } },
        event: { select: { title: true } },
      },
    });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar tickets pendentes" });
  }
});

app.get("/my-tickets", authMiddleware, async (req, res) => {
  try {
    const tickets = await prisma.ticket.findMany({
      where: { userId: req.user.id },
      include: {
        event: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: "Erro ao procurar ingressos" });
  }
});

app.get("/my-events", authMiddleware, async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      where: { ownerId: req.user.id },
      include: {
        tickets: {
          select: { createdAt: true },
        },
        _count: {
          select: { tickets: true },
        },
      },
      orderBy: { date: "asc" },
    });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: "Erro ao carregar seus eventos" });
  }
});

app.delete(
  "/events/:id",
  authMiddleware,
  upload.single("avatar"),
  async (req, res) => {
    const { id } = req.params;
    try {
      const event = await prisma.event.findUnique({
        where: { id, ownerId: req.user.id },
      });

      if (event.imageUrl) {
        await deleteFromCloudinary(event.imageUrl);
      }
      await prisma.ticket.deleteMany({ where: { eventId: id } });
      await prisma.event.delete({ where: { id, ownerId: req.user.id } });

      res.json({ message: "Evento excluído com sucesso" });
    } catch (error) {
      res.status(400).json({ error: "Não foi possível excluir o evento" });
    }
  },
);

app.put("/events/:id", authMiddleware, isAdminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { title, description, date, location, price, imageUrl, capacity } =
    req.body;

  try {
    const event = await prisma.event.update({
      where: { id, ownerId: req.user.id },
      data: {
        title,
        description,
        date: new Date(date),
        capacity: Number(capacity),
        location,
        price: parseFloat(price),
        imageUrl,
      },
    });
    res.json(event);
  } catch (error) {
    res.status(400).json({ error: "Erro ao atualizar evento" });
  }
});

app.get("/user/me", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    res.json(user);
  } catch (error) {
    res.status(401).json({ error: "Token inválido ou expirado" });
  }
});

app.post("/coupons", authMiddleware, async (req, res) => {
  if (req.user.role !== "ADMIN")
    return res.status(403).json({ error: "Acesso negado" });

  const { code, discountPercent, expirationDate, maxUses } = req.body;

  try {
    const coupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        discountPercent: parseInt(discountPercent),
        expirationDate: new Date(expirationDate),
        maxUses: parseInt(maxUses) || 100,
      },
    });
    res.json(coupon);
  } catch (error) {
    res
      .status(400)
      .json({ error: "Erro ao criar cupom. O código já pode existir." });
  }
});

app.get("/coupons", authMiddleware, async (req, res) => {
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(coupons);
});

app.post("/coupons/validate", async (req, res) => {
  const { code } = req.body;

  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!coupon || !coupon.active) {
    return res.status(404).json({ error: "Cupom inválido ou inativo." });
  }

  const now = new Date();
  if (now > coupon.expirationDate) {
    return res.status(400).json({ error: "Este cupom já expirou." });
  }

  if (coupon.usedCount >= coupon.maxUses) {
    return res
      .status(400)
      .json({ error: "Este cupom atingiu o limite de usos." });
  }

  res.json({
    discountPercent: coupon.discountPercent,
    message: "Cupom aplicado com sucesso!",
  });
});

app.delete("/coupons/:code", authMiddleware, async (req, res) => {
  if (req.user.role !== "ADMIN")
    return res.status(403).json({ error: "Acesso negado" });
  const { code } = req.params;
  try {
    await prisma.coupon.delete({ where: { code: code.toUpperCase() } });
    res.json({ message: "Cupom excluído com sucesso" });
  } catch (error) {
    res.status(400).json({ error: "Não foi possível excluir o cupom" });
  }
});

app.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
      },
    });

    if (!user) return res.status(401).json({ error: "Usuário não existe" });

    res.json(user);
  } catch (error) {
    res.status(401).json({ error: "Token inválido" });
  }
});

app.put(
  "/profile",
  authMiddleware,
  upload.single("avatar"),
  async (req, res) => {
    const { name } = req.body;

    if (req.file && req.user.avatarUrl) {
      await deleteFromCloudinary(req.user.avatarUrl);
    }

    try {
      const updateData = { name };

      if (req.file) {
        updateData.avatarUrl = req.file.path;
      }

      const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatarUrl: true,
        },
      });

      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar perfil." });
    }
  },
);

app.get("/confirm-booking", async (req, res) => {
  const { userId, eventId } = req.query;

  try {
    const updated = await prisma.ticket.updateMany({
      where: {
        userId: userId,
        eventId: eventId,
        status: 1,
      },
      data: { status: 3 },
    });

    if (updated.count === 0) {
      return res.send("<h1>Reserva expirada ou já confirmada.</h1>");
    }

    res.redirect(`${baseUrl}/my-tickets`);
  } catch (error) {
    res.status(500).send("Erro ao confirmar reserva.");
  }
});

app.patch("/tickets/:id/status", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { newStatus } = req.body;

  try {
    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: { status: newStatus },
    });

    if (newStatus === 4) {
      const ticket = await prisma.ticket.findUnique({ where: { id } });
      await prisma.event.update({
        where: { id: ticket.eventId },
        data: { capacity: { increment: 1 } },
      });
    }

    res.json({ message: "Status atualizado!", updatedTicket });
  } catch (error) {
    res.status(400).json({ error: "Erro ao atualizar status" });
  }
});

app.post(
  "/tickets/check-in",
  authMiddleware,
  isAdminMiddleware,
  async (req, res) => {
    const { ticketId } = req.body;

    if (!ticketId) {
      return res.status(400).json({ error: "ID do ticket é obrigatório" });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket não encontrado" });
    }

    if (ticket.status !== 3) {
      return res
        .status(400)
        .json({ error: "Este ticket não está aprovado ou já foi usado." });
    }

    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 5 },
    });

    res.json({
      message: "Check-in realizado com sucesso! Bem-vindo ao evento.",
    });
  },
);
