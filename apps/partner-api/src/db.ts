import { PrismaClient as PartnerPrismaClient } from "@cadb/partner-db";
import { PrismaClient as CadbPrismaClient } from "@cadb/db";
import { config } from "./config.js";

// Rows in the partner schema, through partner_rw_<env>.
export const partnerDb = new PartnerPrismaClient({
  datasources: { db: { url: config.partnerUrl } },
  log: ["error", "warn"],
});

// CADB data, through partner_ro_<env>: SELECT on academic tables only.
// Student has column-level grants, so every Student read MUST use an explicit
// `select` — selecting all columns is refused by the database.
export const cadb = new CadbPrismaClient({
  datasources: { db: { url: config.cadbReadUrl } },
  log: ["error", "warn"],
});
