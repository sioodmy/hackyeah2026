/**
 * Email delivery.
 *
 * Uses an SMTP server rather than a provider SDK: any provider can be pointed
 * at by changing the host, and no account with a specific vendor is assumed.
 *
 * Like push, delivery is best-effort. An SMTP outage must never turn a panic
 * button into a 500.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain text. There is no HTML template layer, on purpose. */
  text: string;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<boolean>;
}

/** Swallows everything and reports failure. The default when SMTP is unset. */
export const nullTransport: EmailTransport = {
  async send() {
    return false;
  },
};

class SmtpTransport implements EmailTransport {
  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly user: string | undefined,
    private readonly password: string | undefined,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<boolean> {
    const smtp = await import("nodemailer");

    const client = smtp.createTransport({
      host: this.host,
      port: this.port,
      secure: this.port === 465,
      auth: this.user ? { user: this.user, pass: this.password } : undefined,
    });

    try {
      await client.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
      return true;
    } finally {
      client.close();
    }
  }
}

let transport: EmailTransport | null = null;

/** Reads SMTP settings from the environment, or reports why it cannot send. */
export function emailTransport(env: {
  SMTP_HOST?: string | undefined;
  SMTP_PORT?: string | undefined;
  SMTP_USER?: string | undefined;
  SMTP_PASSWORD?: string | undefined;
  EMAIL_FROM?: string | undefined;
}): EmailTransport {
  if (transport) return transport;

  if (!env.SMTP_HOST) {
    console.warn(
      "[email] SMTP_HOST is not set; danger alerts will not send email",
    );
    transport = nullTransport;
    return transport;
  }

  transport = new SmtpTransport(
    env.SMTP_HOST,
    Number(env.SMTP_PORT ?? 587),
    env.SMTP_USER,
    env.SMTP_PASSWORD,
    env.EMAIL_FROM ?? "Safety Alert <alerts@safetyapp.example>",
  );
  return transport;
}

/** Test seam: swaps the transport without touching SMTP config. */
export function setEmailTransport(replacement: EmailTransport | null): void {
  transport = replacement;
}
