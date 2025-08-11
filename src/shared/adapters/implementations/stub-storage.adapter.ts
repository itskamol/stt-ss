import { Readable } from 'stream';
import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../core/logger/logger.service';
import {
    DownloadResult,
    IStorageAdapter,
    PresignedUrlOptions,
    StorageObject,
    UploadResult,
} from '../storage.adapter';

@Injectable()
export class StubStorageAdapter implements IStorageAdapter {
    constructor(private readonly logger: LoggerService) { }

    async generatePresignedUploadUrl(key: string, options?: PresignedUrlOptions): Promise<string> {
        this.logger.log('Generating presigned upload URL (stub)', { key, options });

        // Return a mock presigned URL
        return `https://stub-storage.example.com/upload/${key}?expires=${Date.now() + (options?.expiresIn || 3600) * 1000}`;
    }

    async generatePresignedDownloadUrl(
        key: string,
        options?: PresignedUrlOptions
    ): Promise<string> {
        this.logger.log('Generating presigned download URL (stub)', { key, options });

        // Return a mock presigned URL
        return `https://stub-storage.example.com/download/${key}?expires=${Date.now() + (options?.expiresIn || 3600) * 1000}`;
    }

    async uploadFile(
        key: string,
        data: Buffer | NodeJS.ReadableStream,
        contentType?: string
    ): Promise<UploadResult> {
        this.logger.log('Uploading file (stub)', { key, contentType });

        // Simulate upload delay
        await new Promise(resolve => setTimeout(resolve, 100));

        return {
            key,
            url: `https://stub-storage.example.com/${key}`,
            etag: `"${Math.random().toString(36).substring(7)}"`,
            size: data instanceof Buffer ? data.length : 1024,
        };
    }

    async downloadFile(key: string): Promise<DownloadResult> {
        this.logger.log('Downloading file (stub)', { key });

        // Create a mock readable stream
        const stream = new Readable({
            read() {
                this.push('Mock file content');
                this.push(null);
            },
        });

        return {
            stream,
            contentType: 'application/octet-stream',
            contentLength: 17,
            lastModified: new Date(),
        };
    }

    async deleteFile(key: string): Promise<void> {
        this.logger.log('Deleting file (stub)', { key });

        // Simulate delete delay
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    async fileExists(key: string): Promise<boolean> {
        this.logger.log('Checking file existence (stub)', { key });

        // Mock: files with 'test' in the name exist
        return key.includes('test');
    }

    async getFileMetadata(key: string): Promise<StorageObject> {
        this.logger.log('Getting file metadata (stub)', { key });

        if (!(await this.fileExists(key))) {
            throw new Error(`File not found: ${key}`);
        }

        return {
            key,
            size: 1024,
            lastModified: new Date(),
            etag: `"${Math.random().toString(36).substring(7)}"`,
            contentType: 'application/octet-stream',
        };
    }

    async listFiles(prefix: string, maxKeys?: number): Promise<StorageObject[]> {
        this.logger.log('Listing files (stub)', { prefix, maxKeys });

        // Return mock file list
        const mockFiles: StorageObject[] = [
            {
                key: `${prefix}/file1.txt`,
                size: 512,
                lastModified: new Date(Date.now() - 86400000),
                etag: '"abc123"',
                contentType: 'text/plain',
            },
            {
                key: `${prefix}/file2.pdf`,
                size: 2048,
                lastModified: new Date(Date.now() - 172800000),
                etag: '"def456"',
                contentType: 'application/pdf',
            },
        ];

        return mockFiles.slice(0, maxKeys || 10);
    }

    async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
        this.logger.log('Copying file (stub)', { sourceKey, destinationKey });

        if (!(await this.fileExists(sourceKey))) {
            throw new Error(`Source file not found: ${sourceKey}`);
        }

        // Simulate copy delay
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    async getFileSize(key: string): Promise<number> {
        this.logger.log('Getting file size (stub)', { key });

        if (!(await this.fileExists(key))) {
            throw new Error(`File not found: ${key}`);
        }

        return 1024; // Mock size
    }
}
