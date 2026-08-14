import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * App-wide branding, stored as a single row (id = 1). Holds the shop name and
 * an optional logo URL shown in the sidebar, login screen and menu browser.
 * The SettingsService seeds this row on first run.
 */
@Entity('app_settings')
export class AppSetting {
  // Fixed at 1 — there is only ever one settings row.
  @PrimaryColumn()
  id: number;

  @Column({ default: 'POSCAFE' })
  appName: string;

  // Absolute URL to the uploaded logo, or null to fall back to the ☕ mark.
  @Column({ type: 'text', nullable: true })
  logoUrl: string | null;

  // KHR per 1 USD, used to show riel amounts alongside dollar prices.
  @Column({ default: 4100 })
  khrPerUsd: number;

  // Bakong account the KHQR pays into, e.g. "koeuk@aclb". null = QR payment
  // is not configured, so the pay screen shows no code.
  @Column({ type: 'varchar', length: 64, nullable: true })
  bakongAccountId: string | null;

  // Merchant name shown in the customer's banking app (falls back to appName).
  // KHQR limits this to 25 characters.
  @Column({ type: 'varchar', length: 25, nullable: true })
  bakongMerchantName: string | null;

  // Merchant city shown in the banking app. KHQR limits it to 15 characters.
  @Column({ type: 'varchar', length: 15, nullable: true })
  bakongMerchantCity: string | null;
}
