import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAppSettingDto } from './dto/update-app-setting.dto';
import type { AppSetting } from '@prisma/client';

// The one settings row always lives at this id.
const SETTINGS_ID = 1;

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.find();
  }

  find(): Promise<AppSetting> {
    return this.prisma.appSetting.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID },
      update: {},
    });
  }

  /**
   * The branding every visitor may see. GET /settings is public (the login
   * screen needs it), so the payment configuration is deliberately left out —
   * it's admin-only and served by `findPaymentConfig`.
   */
  async findPublic() {
    const s = await this.find();
    return {
      appName: s.appName,
      logoUrl: s.logoUrl,
      khrPerUsd: s.khrPerUsd,
      // Lets the pay screen show the QR tab only when it will actually work.
      khqrEnabled: Boolean(s.bakongAccountId),
    };
  }

  /** Bakong/KHQR configuration for the admin settings form. */
  async findPaymentConfig() {
    const s = await this.find();
    return {
      bakongAccountId: s.bakongAccountId,
      bakongMerchantName: s.bakongMerchantName,
      bakongMerchantCity: s.bakongMerchantCity,
      khqrDynamic: s.khqrDynamic,
    };
  }

  async update(dto: UpdateAppSettingDto): Promise<AppSetting> {
    const settings = await this.find();
    if (dto.appName !== undefined) settings.appName = dto.appName.trim();
    if (dto.logoUrl !== undefined) settings.logoUrl = dto.logoUrl;
    if (dto.khrPerUsd !== undefined) settings.khrPerUsd = dto.khrPerUsd;
    // An empty string means "clear it" — stored as null so the KHQR generator
    // sees a single "not configured" value.
    if (dto.bakongAccountId !== undefined) {
      settings.bakongAccountId = dto.bakongAccountId?.trim() || null;
    }
    if (dto.bakongMerchantName !== undefined) {
      settings.bakongMerchantName = dto.bakongMerchantName?.trim() || null;
    }
    if (dto.bakongMerchantCity !== undefined) {
      settings.bakongMerchantCity = dto.bakongMerchantCity?.trim() || null;
    }
    if (dto.khqrDynamic !== undefined) {
      settings.khqrDynamic = dto.khqrDynamic;
    }
    return this.prisma.appSetting.update({
      where: { id: SETTINGS_ID },
      data: {
        appName: settings.appName, logoUrl: settings.logoUrl, khrPerUsd: settings.khrPerUsd,
        bakongAccountId: settings.bakongAccountId, bakongMerchantName: settings.bakongMerchantName,
        bakongMerchantCity: settings.bakongMerchantCity, khqrDynamic: settings.khqrDynamic,
      },
    });
  }
}
