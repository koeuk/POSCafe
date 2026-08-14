import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { UpdateAppSettingDto } from './dto/update-app-setting.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // Public — the login screen and sidebar need branding before/without auth.
  // Returns branding only; the payment config is admin-gated below.
  @Public()
  @Get()
  find() {
    return this.settingsService.findPublic();
  }

  // Bakong/KHQR settings, for the admin settings form only.
  @Roles(Role.ADMIN)
  @Get('payment')
  findPaymentConfig() {
    return this.settingsService.findPaymentConfig();
  }

  // Only admins may change the shop name, logo or payment settings.
  @Roles(Role.ADMIN)
  @Patch()
  update(@Body() dto: UpdateAppSettingDto) {
    return this.settingsService.update(dto);
  }
}
