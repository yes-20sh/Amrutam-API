import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinaryBase, ConfigOptions } from 'cloudinary';

interface CloudinarySDK {
  config(options: ConfigOptions): ConfigOptions;
  uploader: {
    upload(
      file: string,
      options?: Record<string, unknown>,
    ): Promise<{ secure_url: string }>;
  };
}

const cloudinary = cloudinaryBase as CloudinarySDK;

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly configService: ConfigService) {
    const config: ConfigOptions = {
      cloud_name: this.configService.getOrThrow<string>(
        'CLOUDINARY_CLOUD_NAME',
      ),
      api_key: this.configService.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.getOrThrow<string>(
        'CLOUDINARY_API_SECRET',
      ),
    };

    cloudinary.config(config);

    this.logger.log('Cloudinary configured');
  }

  getCloudinary(): typeof cloudinary {
    return cloudinary;
  }

  async uploadImage(fileData: string): Promise<string> {
    try {
      const result = await cloudinary.uploader.upload(fileData, {
        folder: 'passvy/avatars',
      });
      return result.secure_url;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed to upload image to Cloudinary: ${error.message}`,
        );
      }
      throw new Error('Image upload failed');
    }
  }
}
