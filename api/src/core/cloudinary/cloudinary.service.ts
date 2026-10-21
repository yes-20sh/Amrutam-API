import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, ConfigOptions } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private isConfigured = false;

  constructor(@Optional() private readonly configService?: ConfigService) {
    const cloudName =
      this.configService?.get<string>('CLOUDINARY_CLOUD_NAME') ||
      process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey =
      this.configService?.get<string>('CLOUDINARY_API_KEY') ||
      process.env.CLOUDINARY_API_KEY;
    const apiSecret =
      this.configService?.get<string>('CLOUDINARY_API_SECRET') ||
      process.env.CLOUDINARY_API_SECRET;

    if (cloudName && apiKey && apiSecret) {
      const config: ConfigOptions = {
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      };

      cloudinary.config(config);
      this.isConfigured = true;
      this.logger.log('Cloudinary configured successfully');
    } else {
      this.logger.warn(
        'Cloudinary credentials missing in environment variables. Uploads will fail until configured.',
      );
    }
  }

  getCloudinary(): typeof cloudinary {
    return cloudinary;
  }

  /**
   * Upload an image (base64 data URI, remote URL, or file path) to Cloudinary
   */
  async uploadImage(
    fileData: string,
    folder = 'amrutam/profiles',
  ): Promise<string> {
    if (!this.isConfigured) {
      throw new Error(
        'Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      );
    }

    try {
      const result = await cloudinary.uploader.upload(fileData, {
        folder,
        resource_type: 'image',
        transformation: [
          { width: 500, height: 500, crop: 'thumb', gravity: 'face' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
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

  /**
   * Delete an image from Cloudinary by its secure URL or public_id
   */
  async deleteImage(imageUrlOrPublicId: string): Promise<boolean> {
    if (!this.isConfigured || !imageUrlOrPublicId) {
      return false;
    }

    try {
      const publicId =
        this.extractPublicId(imageUrlOrPublicId) || imageUrlOrPublicId;
      if (!publicId) return false;

      const result = await cloudinary.uploader.destroy(publicId);
      return result.result === 'ok';
    } catch (error) {
      this.logger.warn(
        `Failed to delete image from Cloudinary: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return false;
    }
  }

  /**
   * Extracts the public_id from a Cloudinary URL (e.g. "amrutam/profiles/xyz")
   */
  extractPublicId(imageUrl: string): string | null {
    try {
      if (!imageUrl || !imageUrl.includes('res.cloudinary.com')) {
        return null;
      }

      const uploadIndex = imageUrl.indexOf('/upload/');
      if (uploadIndex === -1) return null;

      let pathAfterUpload = imageUrl.substring(uploadIndex + '/upload/'.length);

      // Strip version tag (e.g. v1234567890/)
      pathAfterUpload = pathAfterUpload.replace(/^v\d+\//, '');

      // Strip file extension
      const lastDotIndex = pathAfterUpload.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        pathAfterUpload = pathAfterUpload.substring(0, lastDotIndex);
      }

      return pathAfterUpload;
    } catch {
      return null;
    }
  }
}
