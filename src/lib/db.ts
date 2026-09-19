import { PrismaClient, Prisma } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { __eskPrisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured. Copy .env.example to .env and set it.");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db: PrismaClient = globalForPrisma.__eskPrisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.__eskPrisma = db;

export { Prisma };
export type DbClient = PrismaClient | Prisma.TransactionClient;
export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;
