require("dotenv").config();
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const authMiddleware = require("./middlewares/auth");

const prisma = new PrismaClient();

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint de Cadastro
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // 1. Verificar se o usuário já existe
    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) return res.status(400).json({ error: "Usuário já existe" });

    // 2. Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Criar no banco
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });

    res.status(201).json({ id: user.id, name: user.name, email: user.email });
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar usuário" });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Busca o usuário
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Credenciais inválidas" });

    // 2. Verifica a senha
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      return res.status(401).json({ error: "Credenciais inválidas" });

    // 3. Gera o Token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" } // Expira em 1 dia
    );

    res.json({
      user: { id: user.id, name: user.name, email: user.email },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: "Erro no servidor" });
  }
});

app.listen(3000, () =>
  console.log("🚀 Server rodando em http://localhost:3000")
);

app.get("/events", async (req, res) => {
  const events = await prisma.event.findMany({
    include: { owner: { select: { name: true } } }, // Traz o nome do organizador
  });
  res.json(events);
});

app.post("/events", authMiddleware, async (req, res) => {
  const { title, description, date, location, price, imageUrl } = req.body;

  try {
    const event = await prisma.event.create({
      data: {
        title,
        description,
        date: new Date(date),
        location,
        price: parseFloat(price),
        imageUrl,
        ownerId: req.userId, // Pego do token pelo middleware!
      },
    });
    res.status(201).json(event);
  } catch (error) {
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
  const { eventId } = req.body;

  try {
    const ticket = await prisma.ticket.create({
      data: {
        eventId,
        userId: req.userId, // Identificado pelo middleware de auth
      },
    });
    res.status(201).json(ticket);
  } catch (error) {
    res.status(400).json({ error: "Erro ao gerar ingresso" });
  }
});

app.get("/my-tickets", authMiddleware, async (req, res) => {
  try {
    const tickets = await prisma.ticket.findMany({
      where: { userId: req.userId },
      include: {
        event: true, // Traz os detalhes do evento junto com o ingresso
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
      where: { ownerId: req.userId },
      include: {
        _count: {
          select: { tickets: true }, // Conta quantos ingressos foram gerados
        },
      },
      orderBy: { date: "asc" },
    });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: "Erro ao carregar seus eventos" });
  }
});

// Endpoint para excluir um evento
app.delete("/events/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    // Primeiro deletamos os tickets vinculados (integridade referencial)
    await prisma.ticket.deleteMany({ where: { eventId: id } });
    // Depois o evento
    await prisma.event.delete({ where: { id, ownerId: req.userId } });

    res.json({ message: "Evento excluído com sucesso" });
  } catch (error) {
    res.status(400).json({ error: "Não foi possível excluir o evento" });
  }
});

app.put("/events/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { title, description, date, location, price, imageUrl } = req.body;

  try {
    const event = await prisma.event.update({
      where: { id, ownerId: req.userId }, // Garante que só o dono edita
      data: {
        title,
        description,
        date: new Date(date),
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
