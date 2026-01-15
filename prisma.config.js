import { defineConfig } from "@prisma/config";
import * as dotenv from "dotenv";

// Carrega o .env explicitamente para o CLI do Prisma enxergar
dotenv.config();

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL, // Alterado para usar a variável do .env
  },
});
