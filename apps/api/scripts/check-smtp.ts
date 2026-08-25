import "dotenv/config";
import { verifySmtp, sendMail } from "../src/utils/mailer.js";

/**
 * Confirms the SMTP settings in this environment actually work.
 *
 *   pnpm --filter @cadb/api check-smtp                  # auth handshake only
 *   pnpm --filter @cadb/api check-smtp you@example.com  # also send a real mail
 *
 * Worth running after setting SMTP anywhere, because the app is deliberately
 * quiet when mail is misconfigured: notifications queue rows and retry rather
 * than surfacing an error to whoever applied for the leave.
 */

const recipient = process.argv[2];

function show(label: string, value: string | undefined) {
  console.log(`  ${label.padEnd(12)} ${value || "\x1b[31m(not set)\x1b[0m"}`);
}

console.log("\nSMTP configuration");
show("host", process.env.SMTP_HOST);
show("port", process.env.SMTP_PORT ?? "587 (default)");
show("secure", process.env.SMTP_SECURE ?? "false (default)");
show("user", process.env.SMTP_USER);
show("pass", process.env.SMTP_PASS ? `set, ${process.env.SMTP_PASS.length} chars` : undefined);
show("from", process.env.SMTP_FROM);

// Gmail refuses to send as an address the authenticated account doesn't own,
// and silently rewrites the header in some cases — both look like "the app is
// sending from the wrong address" long after the fact.
const from = process.env.SMTP_FROM ?? "";
const fromAddr = from.match(/<([^>]+)>/)?.[1] ?? from.trim().replace(/^"|"$/g, "");
if (process.env.SMTP_HOST?.includes("gmail") && process.env.SMTP_USER && fromAddr && fromAddr !== process.env.SMTP_USER) {
  console.log(
    `\n\x1b[33m!\x1b[0m SMTP_FROM (${fromAddr}) differs from SMTP_USER (${process.env.SMTP_USER}).` +
    `\n  Gmail only allows this if ${fromAddr} is a verified "Send mail as" alias on that account,` +
    `\n  otherwise it rewrites or rejects the message.`,
  );
}

// Without credentials nodemailer skips authentication altogether, and verify()
// succeeds on nothing more than a reachable port. Reporting that as a pass is
// worse than reporting nothing, so refuse to run instead.
if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.error(
    "\n\x1b[31m✘\x1b[0m incomplete configuration — set SMTP_HOST, SMTP_USER and SMTP_PASS." +
    "\n  Verifying now would only prove the port is reachable, not that login works.\n",
  );
  process.exit(1);
}

console.log("\nVerifying connection and credentials…");
try {
  await verifySmtp();
  console.log("\x1b[32m✔\x1b[0m authenticated");
} catch (err: any) {
  console.error(`\x1b[31m✘\x1b[0m ${err?.code ?? "error"}: ${err?.message ?? err}`);
  if (err?.responseCode === 535) {
    console.error("  535 is a rejected login. For Google Workspace this is almost always an");
    console.error("  ordinary account password instead of a 16-character App Password, or");
    console.error("  2-Step Verification not being enabled on the sending account.");
  }
  process.exit(1);
}

if (!recipient) {
  console.log("\nPass an address to send a real test mail: check-smtp you@example.com\n");
  process.exit(0);
}

console.log(`\nSending a test message to ${recipient}…`);
try {
  await sendMail({
    to: recipient,
    subject: "CADB SMTP test",
    html: `<div style="font-family:sans-serif;padding:16px">
      <h2 style="color:#2C3E7C;margin:0 0 8px">SMTP is working</h2>
      <p style="color:#374151;font-size:14px">
        Sent from the Centum Academy Dashboard at ${new Date().toISOString()}.
        Leave and claim notifications will use this same route.
      </p>
    </div>`,
  });
  console.log("\x1b[32m✔\x1b[0m sent — check the inbox, and the spam folder if it isn't there\n");
} catch (err: any) {
  console.error(`\x1b[31m✘\x1b[0m send failed: ${err?.message ?? err}\n`);
  process.exit(1);
}
