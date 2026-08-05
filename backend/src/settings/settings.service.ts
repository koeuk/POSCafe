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

  async update(dto: UpdateAppSettingDto): Promise<AppSetting> {
    const settings = await this.find();
    if (dto.appName !== undefined) settings.appName = dto.appName.trim();
    if (dto.logoUrl !== undefined) settings.logoUrl = dto.logoUrl;
    return this.repo.save(settings);
  }
}
