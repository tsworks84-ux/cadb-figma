import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../lib/auth.js";
import { academicYearMap, gradeMap, schoolMap } from "../../lib/cadbLookups.js";

// CADB reference lists for pickers in partner-admin.
export async function adminLookupRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  app.get("/cadb/academic-years", async () => [...(await academicYearMap()).values()]);
  app.get("/cadb/grades", async () => [...(await gradeMap()).values()]);
  app.get("/cadb/schools", async () => [...(await schoolMap()).values()]);
}
