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
  @Public()
  @Get()
  find() {
    return this.settingsService.find();
  }

  // Only admins may change the shop name or logo.
  @Roles(Role.ADMIN)
  @Patch()
  update(@Body() dto: UpdateAppSettingDto) {
    return this.settingsService.update(dto);
  }
}
