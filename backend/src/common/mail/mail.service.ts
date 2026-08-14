import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Outgoing mail over SMTP.
 *
 * When SMTP_HOST is unset (a fresh checkout, or a laptop with no mail account)
 * the service stays in "console mode": nothing is sent and the message body is
 * logged instead. That keeps the password-reset flow fully usable in
 * development without turning missing config into a boot-time crash — the shop
 * only needs SMTP set up before an admin actually locks themselves out.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    this.from = this.config.get<string>(
      'SMTP_FROM',
      this.config.get<string>('SMTP_USER', 'no-reply@poscafe.local'),
    );

    if (!host) {
      this.transporter = null;
      this.logger.warn(
        'SMTP_HOST is not set — emails will be logged to the console instead of sent.',
      );
      return;
    }

    const port = Number(this.config.get<string>('SMTP_PORT', '587'));
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      // Port 465 is implicit TLS; 587 upgrades via STARTTLS. Explicit
      // SMTP_SECURE wins for providers that don't follow that convention.
      secure: this.config.get<string>('SMTP_SECURE')
        ? this.config.get<string>('SMTP_SECURE') === 'true'
        : port === 465,
      auth: user ? { user, pass } : undefined,
    });
  }

  /** True when real mail can be sent (used to tell dev from production). */
  get isConfigured(): boolean {
    return this.transporter !== null;
  }

  async send(options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<void> {
    if (!this.transporter) {
      // Boxed and padded so it stands out in a busy dev log — this is the only
      // place the message exists when SMTP is unset, and a one-line entry gets
      // lost between request logs the moment anything else happens.
      this.logger.warn(
        [
          '',
          '┌─────────────────────────────────────────────────────────────',
          '│ EMAIL NOT SENT — SMTP_HOST is not configured',
          `│ To:      ${options.to}`,
          `│ Subject: ${options.subject}`,
          '├─────────────────────────────────────────────────────────────',
          ...options.text
            .trimEnd()
            .split('\n')
            .map((line) => `│ ${line}`),
          '└─────────────────────────────────────────────────────────────',
        ].join('\n'),
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  }
}
