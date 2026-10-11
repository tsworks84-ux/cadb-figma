// Create a partner-admin user, or reset an existing user's password.
//
//   pnpm --filter @cadb/partner-api create-admin -- --email a@b.com --name "A B" --role OWNER
//   node dist/scripts/create-admin.js --email a@b.com --reset-password        (on a server)
//
// The password comes from ADMIN_INITIAL_PASSWORD, or a random one is printed
// once. Either way the user must change it at first sign-in.
import { parseArgs } from "util";
import { randomBytes } from "crypto";
import { partnerDb } from "../db.js";
import { hashPassword, PASSWORD_MIN } from "../lib/auth.js";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "MANAGER" },
    "employee-id": { type: "string" },
    "reset-password": { type: "boolean", default: false },
  },
});

const email = values.email?.trim().toLowerCase();
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("--email is required");
const role = values.role === "OWNER" ? "OWNER" : values.role === "MANAGER" ? "MANAGER" : null;
if (!role) throw new Error("--role must be OWNER or MANAGER");

const generated = !process.env.ADMIN_INITIAL_PASSWORD;
const password = process.env.ADMIN_INITIAL_PASSWORD ?? randomBytes(12).toString("base64url");
if (password.length < PASSWORD_MIN) throw new Error(`password must be at least ${PASSWORD_MIN} characters`);

const existing = await partnerDb.adminUser.findUnique({ where: { email } });
if (existing && !values["reset-password"]) {
  throw new Error(`${email} already exists; pass --reset-password to give them a new temporary password`);
}

if (existing) {
  await partnerDb.$transaction([
    partnerDb.adminUser.update({ where: { id: existing.id }, data: { passwordHash: await hashPassword(password), mustChangePassword: true, isActive: true } }),
    partnerDb.adminSession.updateMany({ where: { adminUserId: existing.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  console.log(`Password reset for ${email}; their sessions were signed out.`);
} else {
  if (!values.name?.trim()) throw new Error("--name is required for a new user");
  const user = await partnerDb.adminUser.create({
    data: { email, name: values.name.trim(), role, employeeId: values["employee-id"] ?? null, passwordHash: await hashPassword(password) },
  });
  console.log(`Created ${role} ${user.name} <${email}>.`);
}
if (generated) console.log(`Temporary password (shown once): ${password}`);
await partnerDb.$disconnect();
