import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { RequiresPage } from '../common/decorators/requires-page.decorator';
import { CreateSizeDto } from './dto/create-size.dto';
import { UpdateSizeDto } from './dto/update-size.dto';
import { SizesService } from './sizes.service';

@Controller('sizes')
export class SizesController {
  constructor(private readonly sizesService: SizesService) {}

  // Reads open to any authenticated user (the product form needs the catalog).
  @Get()
  findAll() {
    return this.sizesService.findAll();
  }

  // Managing the size catalog lives on the Stock page.
  @RequiresPage('stock')
  @Post()
  create(@Body() dto: CreateSizeDto) {
    return this.sizesService.create(dto);
  }

  @RequiresPage('stock')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSizeDto) {
    return this.sizesService.update(id, dto);
  }

  @RequiresPage('stock')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.sizesService.remove(id);
  }
}
