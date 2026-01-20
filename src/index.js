try {
  require("dotenv").config();
} catch (e) {
 
}
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const authMiddleware = require("./middlewares/auth");
const isAdminMiddleware = require("./middlewares/isAdmin");
const { upload } = require("./config/cloudinary");

const prisma = new PrismaClient();

const app = express();
app.use(cors());
app.use(express.json());

app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) return res.status(400).json({ error: "Usuário já existe" });

    if (name.length <= 0 || email.length <= 0 || password.length < 6) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
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

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Credenciais inválidas" });

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server rodando na porta ${PORT}`);
});

app.get("/events", async (req, res) => {
  const events = await prisma.event.findMany({
    include: { owner: { select: { name: true } } },
  });
  res.json(events);
});

app.post("/events", authMiddleware, isAdminMiddleware, async (req, res) => {
  const { title, description, date, location, price, imageUrl, capacity } =
    req.body;

  try {
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
      },
    });
    res.status(201).json(event);
  } catch (error) {
    console.error("Erro ao criar evento:", error);
    res.status(400).json({ error: "Erro ao criar evento" });
  }
});

app.get("/events/:id", async (req, res) => {
  const { id } = req.params;
  const event = await prisma.event.findUnique({
    where: { id },
    include: { owner: { select: { name: true } } },
  });
  res.json(event);
});

app.post("/bookings", authMiddleware, async (req, res) => {
  const { eventId, quantity, couponCode } = req.body;

  try {
    
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return res.status(404).json({ error: "Evento não encontrado" });
    }

    if (couponCode) {
      await prisma.coupon.update({
        where: { code: couponCode },
        data: { usedCount: { increment: 1 } },
      });
    }

    const qty = Number(quantity);
    if (event.capacity < qty) {
      return res.status(400).json({
        error: "Quantidade de ingressos excede a capacidade do evento",
      });
    }

   
    const tickets = [];
    for (let i = 0; i < qty; i++) {
      const ticket = await prisma.ticket.create({
        data: {
          eventId,
          userId: req.user.id,
          quantity: 1,
        },
      });
      tickets.push(ticket);
    }

    
    await prisma.event.update({
      where: { id: eventId },
      data: { capacity: event.capacity - qty },
    });

    res.status(201).json({ tickets });
  } catch (error) {
    res.status(400).json({ error: "Erro ao gerar ingresso" });
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

app.delete("/events/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.ticket.deleteMany({ where: { eventId: id } });
    await prisma.event.delete({ where: { id, ownerId: req.user.id } });

    res.json({ message: "Evento excluído com sucesso" });
  } catch (error) {
    res.status(400).json({ error: "Não foi possível excluir o evento" });
  }
});

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
      console.error(error);
      res.status(500).json({ error: "Erro ao atualizar perfil." });
    }
  },
);
