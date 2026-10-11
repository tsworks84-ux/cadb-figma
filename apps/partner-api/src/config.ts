import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// Refuse to start on the wrong database login. The CADB read URL must be a
// partner_ro_* login and the partner URL a partner_rw_* login, so a pasted
// owner or CADB URL can never give this service write access to CADB.
function loginUrl(name: string, rolePrefix: string): string {
  const url = required(name);
  const user = decodeURIComponent(new URL(url).username);
  if (!user.startsWith(rolePrefix)) {
    throw new Error(`${name} must connect as ${rolePrefix}<env> (got "${user}")`);
  }
  return url;
}

const partnerUrl = loginUrl("PARTNER_RW_URL", "partner_rw_");
if (new URL(partnerUrl).searchParams.get("schema") !== "partner") {
  throw new Error("PARTNER_RW_URL must end in ?schema=partner");
}

const serviceSecret = required("PARTNER_SERVICE_SECRET");
if (serviceSecret.length < 32) throw new Error("PARTNER_SERVICE_SECRET must be at least 32 characters");

export const config = {
  host: process.env.PARTNER_API_HOST ?? "127.0.0.1",
  port: Number(process.env.PARTNER_API_PORT ?? 4100),
  partnerUrl,
  cadbReadUrl: loginUrl("CADB_READ_URL", "partner_ro_"),
  serviceSecret,
  adminSessionHours: Number(process.env.ADMIN_SESSION_HOURS ?? 12),
  isDev: process.env.NODE_ENV === "development",
};
