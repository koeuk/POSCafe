import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

// Minimal shape of the multer file (no @types/multer installed).
interface UploadedImage {
  filename: string;
}

@Controller('uploads')
export class UploadsController {
  @Roles(Role.ADMIN)
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (_req, file, cb) => {
        if (/^image\//.test(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only image files are allowed'), false);
        }
      },
    }),
  )
  uploadImage(@UploadedFile() file: UploadedImage) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    // Relative path; the frontend prefixes it with the API base URL.
    return { path: `/uploads/${file.filename}` };
  }
}
