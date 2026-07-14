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

  // Theme colours (hex, e.g. "#2A1D15"). null on any field = use the built-in
  // default for that surface. Applied as CSS variables on the frontend.
  @Column({ type: 'varchar', length: 9, nullable: true })
  buttonColor: string | null;

  @Column({ type: 'varchar', length: 9, nullable: true })
  pageBg: string | null;

  @Column({ type: 'varchar', length: 9, nullable: true })
  sidebarBg: string | null;

  @Column({ type: 'varchar', length: 9, nullable: true })
  sidebarActiveColor: string | null;
}
