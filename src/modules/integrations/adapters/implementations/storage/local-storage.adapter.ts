import { Readable } from 'stream';
import { Injectable } from '@nestjs/common';
import * as path from 'path';
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'fs/promises';
import {
    DownloadResult,
    IStorageAdapter,
    PresignedUrlOptions,
    StorageObject,
    UploadResult,
} from '../../interfaces';
import { LoggerService } from '@/core/logger';
import { existsSync } from 'fs';
import { ConfigService } from '@/core/config/config.service';

@Injectable()
export class LocalStorageAdapter implements IStorageAdapter {
    private readonly uploadDir: string;

    constructor(
        private readonly logger: LoggerService,
        private readonly configService: ConfigService
    ) {
        this.uploadDir = this.configService.uploadDir;
        this.ensureUploadDirectory();
    }

    private async ensureUploadDirectory(): Promise<void> {
        try {
            await mkdir(this.uploadDir, { recursive: true });
            this.logger.log('Upload directory ensured', { directory: this.uploadDir });
        } catch (error) {
            this.logger.error('Failed to create upload directory', error.trace, {
                error: error.message,
            });
            throw new Error(`Failed to create upload directory: ${error.message}`);
        }
    }

    private getFilePath(key: string): string {
        return path.join(this.uploadDir, key);
    }

    async generatePresignedUploadUrl(key: string, options?: PresignedUrlOptions): Promise<string> {
        this.logger.log('Generating presigned upload URL (local)', { key, options });
        return `/api/upload/${key}`;
    }

    async generatePresignedDownloadUrl(
        key: string,
        options?: PresignedUrlOptions
    ): Promise<string> {
        this.logger.log('Generating presigned download URL (local)', { key, options });
        return `/api/download/${key}`;
    }

    async uploadFile(
        key: string,
        data: Buffer | NodeJS.ReadableStream,
        contentType?: string
    ): Promise<UploadResult> {
        this.logger.log('Uploading file (local)', { key, contentType });

        try {
            const filePath = this.getFilePath(key);
            const directory = path.dirname(filePath);

            // Ensure directory exists
            if (!existsSync(directory)) await mkdir(directory, { recursive: true });

            // Convert stream to buffer if needed
            let buffer: Buffer;
            if (Buffer.isBuffer(data)) {
                buffer = data;
            } else {
                const chunks: Buffer[] = [];
                for await (const chunk of data) {
                    chunks.push(chunk as Buffer);
                }
                buffer = Buffer.concat(chunks);
            }
            await writeFile(filePath, buffer);

            return {
                key,
                url: `/api/files/${key}`,
                etag: `"${Date.now()}"`,
                size: buffer.length,
            };
        } catch (error) {
            this.logger.error('Failed to upload file', error.trace, { key, error: error.message });
            throw new Error(`Failed to upload file: ${error.message}`);
        }
    }

    async downloadFile(key: string): Promise<DownloadResult> {
        this.logger.log('Downloading file (local)', { key });
        try {
            const filePath = this.getFilePath(key);
            const stats = await stat(filePath);
            const buffer = await readFile(filePath);

            const stream = new Readable();
            stream.push(buffer);
            stream.push(null);

            return {
                stream,
                contentLength: stats.size,
                lastModified: stats.mtime,
            };
        } catch (error) {
            this.logger.error('Failed to download file', error.trace, {
                key,
                error: error.message,
            });
            throw new Error(`File not found: ${key}`);
        }
    }

    async deleteFile(key: string): Promise<void> {
        this.logger.log('Deleting file (local)', { key });

        try {
            const filePath = this.getFilePath(key);
            await unlink(filePath);
        } catch (error) {
            this.logger.error('Failed to delete file', error.trace, { key, error: error.message });
            // Don't throw error if file doesn't exist
        }
    }

    async fileExists(key: string): Promise<boolean> {
        try {
            const filePath = this.getFilePath(key);
            await stat(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async getFileMetadata(key: string): Promise<StorageObject> {
        this.logger.log('Getting file metadata (local)', { key });

        try {
            const filePath = this.getFilePath(key);
            const stats = await stat(filePath);

            return {
                key,
                size: stats.size,
                lastModified: stats.mtime,
                etag: `"${stats.mtime.getTime()}"`,
            };
        } catch (error) {
            throw new Error(`File not found: ${key}`);
        }
    }

    async listFiles(prefix: string, maxKeys?: number): Promise<StorageObject[]> {
        this.logger.log('Listing files (local)', { prefix, maxKeys });

        try {
            const directory = path.join(this.uploadDir, prefix);
            const files = await readdir(directory);
            const storageObjects: StorageObject[] = [];

            for (const file of files) {
                if (maxKeys && storageObjects.length >= maxKeys) break;

                const filePath = path.join(directory, file);
                const stats = await stat(filePath);

                if (stats.isFile()) {
                    storageObjects.push({
                        key: path.join(prefix, file),
                        size: stats.size,
                        lastModified: stats.mtime,
                        etag: `"${stats.mtime.getTime()}"`,
                    });
                }
            }

            return storageObjects;
        } catch (error) {
            this.logger.error('Failed to list files', error.trace, {
                prefix,
                error: error.message,
            });
            return [];
        }
    }

    async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
        this.logger.log('Copying file (local)', { sourceKey, destinationKey });

        try {
            const sourcePath = this.getFilePath(sourceKey);
            const destPath = this.getFilePath(destinationKey);
            const destDirectory = path.dirname(destPath);

            await mkdir(destDirectory, { recursive: true });
            const buffer = await readFile(sourcePath);
            await writeFile(destPath, buffer);
        } catch (error) {
            this.logger.error('Failed to copy file', error.trace, {
                sourceKey,
                destinationKey,
                error: error.message,
            });
            throw new Error(`Failed to copy file: ${error.message}`);
        }
    }

    async getFileSize(key: string): Promise<number> {
        try {
            const filePath = this.getFilePath(key);
            const stats = await stat(filePath);
            return stats.size;
        } catch (error) {
            throw new Error(`File not found: ${key}`);
        }
    }
}
