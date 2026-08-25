import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT ?? "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

/**
 * Opens a connection and authenticates, without sending anything. The fastest
 * way to tell a wrong password from a blocked port from a working setup —
 * nodemailer surfaces the provider's actual rejection here, whereas a failed
 * send buries it behind a queued notification.
 */
export async function verifySmtp(): Promise<void> {
  if (!process.env.SMTP_HOST) {
    throw new Error("SMTP_HOST is not set");
  }
  await transporter.verify();
}

export interface MailOptions {
  to: string;
  cc?: string;
  subject: string;
  html: string;
}

export async function sendMail(opts: MailOptions): Promise<void> {
  if (!process.env.SMTP_HOST) return; // silently skip if not configured
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? `"Centum Academy" <noreply@centumacademy.com>`,
    ...opts,
  });
}

export async function sendCredentialsMail(
  to: string,
  name: string,
  employeeCode: string,
  password: string,
  loginUrl: string = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"
): Promise<void> {
  if (!process.env.SMTP_HOST) {
    throw new Error("SMTP is not configured on the server. Set SMTP_HOST, SMTP_USER and SMTP_PASS in your environment variables.");
  }
  await sendMail({
    to,
    subject: "Your Centum Academy Dashboard Login Credentials",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="color:#1e40af;margin-bottom:4px">Welcome to Centum Academy</h2>
        <p style="color:#6b7280;margin-top:0">Hello ${name},</p>
        <p>Your HR team has created a profile for you on the Centum Academy Dashboard. Here are your login credentials:</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0">
          <p style="margin:0 0 8px"><strong>Employee Code:</strong> <code style="font-size:15px;color:#1e40af">${employeeCode}</code></p>
          <p style="margin:0"><strong>Temporary Password:</strong> <code style="font-size:15px;color:#c2410c">${password}</code></p>
        </div>
        <p>You will be prompted to <strong>change your password</strong> on first login.</p>
        <a href="${loginUrl}/login" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600">Login Now →</a>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px">If you did not expect this email, please contact your HR department.</p>
      </div>
    `,
  });
}
