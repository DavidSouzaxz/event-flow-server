const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2) {
    return res.status(401).json({ error: "Erro no token" });
  }

  const [scheme, token] = parts;

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: "Token inválido" });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });
      if (!user) {
        return res.status(401).json({ error: "Usuário não encontrado" });
      }

      req.user = user;
      return next();
    } catch (error) {
      return res.status(500).json({ error: "Erro ao buscar usuário" });
    }
  });
};
