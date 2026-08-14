import { Injectable, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateAppSettingDto } from './dto/update-app-setting.dto';
import { AppSetting } from './entities/app-setting.entity';

// The one settings row always lives at this id.
const SETTINGS_ID = 1;

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(AppSetting)
    private readonly repo: Repository<AppSetting>,
  ) {}

  // Seed the single branding row the first time the app boots.
  async onModuleInit() {
    if (!(await this.repo.findOne({ where: { id: SETTINGS_ID } }))) {
      await this.repo.save(
        this.repo.create({ id: SETTINGS_ID, appName: 'POSCAFE' }),
      );
    }
  }

  async find(): Promise<AppSetting> {
    // onModuleInit guarantees the row exists; fall back defensively anyway.
    const settings = await this.repo.findOne({ where: { id: SETTINGS_ID } });
    return (
      settings ?? this.repo.create({ id: SETTINGS_ID, appName: 'POSCAFE' })
    );
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
    return this.repo.save(settings);
  }
}
