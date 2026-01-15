module.exports = (req, res, next) => {
  if (req.user && req.user.role === "ADMIN") {
    return next();
  }

  return res.status(403).json({
    error: "Acesso negado. Apenas administradores podem realizar esta ação.",
  });
};
