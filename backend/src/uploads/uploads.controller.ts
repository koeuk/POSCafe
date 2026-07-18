import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { RequiresPage } from '../common/decorators/requires-page.decorator';

// Raster image types only, keyed by the extension we write to disk. `mimetype`
// is attacker-controlled (it's just the multipart Content-Type header), and the
// ./uploads directory is served statically — so the extension must come from
// this table, never from the client's filename, or an "image/png" part named
// `x.html` lands on disk as HTML and executes as stored XSS on the API origin.
// SVG is deliberately excluded: it is an image type that can carry <script>.
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
};

@Controller('uploads')
export class UploadsController {
  // Image upload is used by the product, category and (admin) staff forms.
  @RequiresPage('products', 'categories')
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          // Extension from the allowlist, not from file.originalname.
          cb(null, `${unique}${ALLOWED_IMAGE_TYPES[file.mimetype]}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_IMAGE_TYPES[file.mimetype]) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `Unsupported image type. Allowed: ${Object.keys(
                ALLOWED_IMAGE_TYPES,
              ).join(', ')}`,
            ),
            false,
          );
        }
      },
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    // Relative path; the frontend prefixes it with the API base URL.
    return { path: `/uploads/${file.filename}` };
  }
}
