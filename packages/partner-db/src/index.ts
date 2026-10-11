import { PrismaClient } from "../generated/client/index.js";

// Client for the "partner" schema only. Reads of CADB data go through
// @cadb/db, connected with the read-only partner login.
const globalForPartner = globalThis as unknown as { partnerPrisma: PrismaClient };

export const partnerPrisma =
  globalForPartner.partnerPrisma ||
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPartner.partnerPrisma = partnerPrisma;

export { PrismaClient, Prisma } from "../generated/client/index.js";
export type * from "../generated/client/index.js";
