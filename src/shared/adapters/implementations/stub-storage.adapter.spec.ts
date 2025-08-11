import { Test, TestingModule } from '@nestjs/testing';
import { StubStorageAdapter } from './stub-storage.adapter';
import { LoggerService } from '../../../core/logger/logger.service';

describe('StubStorageAdapter', () => {
    let adapter: StubStorageAdapter;
    let loggerService: jest.Mocked<LoggerService>;

    beforeEach(async () => {
        const mockLoggerService = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StubStorageAdapter,
                {
                    provide: LoggerService,
                    useValue: mockLoggerService,
                },
            ],
        }).compile();

        adapter = module.get<StubStorageAdapter>(StubStorageAdapter);
        loggerService = module.get(LoggerService);
    });

    it('should be defined', () => {
        expect(adapter).toBeDefined();
    });

    describe('generatePresignedUploadUrl', () => {
        it('should generate a presigned upload URL', async () => {
            const key = 'test-file.txt';
            const options = { expiresIn: 3600 };

            const url = await adapter.generatePresignedUploadUrl(key, options);

            expect(url).toContain('stub-storage.example.com/upload/test-file.txt');
            expect(url).toContain('expires=');
            expect(loggerService.log).toHaveBeenCalledWith(
                'Generating presigned upload URL (stub)',
                {
                    key,
                    options,
                }
            );
        });
    });

    describe('generatePresignedDownloadUrl', () => {
        it('should generate a presigned download URL', async () => {
            const key = 'test-file.txt';

            const url = await adapter.generatePresignedDownloadUrl(key);

            expect(url).toContain('stub-storage.example.com/download/test-file.txt');
            expect(url).toContain('expires=');
            expect(loggerService.log).toHaveBeenCalledWith(
                'Generating presigned download URL (stub)',
                {
                    key,
                    options: undefined,
                }
            );
        });
    });

    describe('uploadFile', () => {
        it('should upload a file and return upload result', async () => {
            const key = 'test-upload.txt';
            const data = Buffer.from('test content');
            const contentType = 'text/plain';

            const result = await adapter.uploadFile(key, data, contentType);

            expect(result).toEqual({
                key,
                url: `https://stub-storage.example.com/${key}`,
                etag: expect.any(String),
                size: data.length,
            });
            expect(loggerService.log).toHaveBeenCalledWith('Uploading file (stub)', {
                key,
                contentType,
            });
        });
    });

    describe('downloadFile', () => {
        it('should download a file and return stream', async () => {
            const key = 'test-download.txt';

            const result = await adapter.downloadFile(key);

            expect(result.stream).toBeDefined();
            expect(result.contentType).toBe('application/octet-stream');
            expect(result.contentLength).toBe(17);
            expect(result.lastModified).toBeInstanceOf(Date);
            expect(loggerService.log).toHaveBeenCalledWith('Downloading file (stub)', { key });
        });
    });

    describe('fileExists', () => {
        it('should return true for files containing "test"', async () => {
            const result = await adapter.fileExists('test-file.txt');
            expect(result).toBe(true);
        });

        it('should return false for files not containing "test"', async () => {
            const result = await adapter.fileExists('other-file.txt');
            expect(result).toBe(false);
        });
    });

    describe('getFileMetadata', () => {
        it('should return file metadata for existing files', async () => {
            const key = 'test-file.txt';

            const metadata = await adapter.getFileMetadata(key);

            expect(metadata).toEqual({
                key,
                size: 1024,
                lastModified: expect.any(Date),
                etag: expect.any(String),
                contentType: 'application/octet-stream',
            });
        });

        it('should throw error for non-existing files', async () => {
            const key = 'non-existing-file.txt';

            await expect(adapter.getFileMetadata(key)).rejects.toThrow(
                'File not found: non-existing-file.txt'
            );
        });
    });

    describe('listFiles', () => {
        it('should return list of files with prefix', async () => {
            const prefix = 'documents';
            const maxKeys = 5;

            const files = await adapter.listFiles(prefix, maxKeys);

            expect(files).toHaveLength(2);
            expect(files[0].key).toContain(prefix);
            expect(files[1].key).toContain(prefix);
            expect(loggerService.log).toHaveBeenCalledWith('Listing files (stub)', {
                prefix,
                maxKeys,
            });
        });
    });

    describe('copyFile', () => {
        it('should copy file from source to destination', async () => {
            const sourceKey = 'test-source.txt';
            const destinationKey = 'test-destination.txt';

            await adapter.copyFile(sourceKey, destinationKey);

            expect(loggerService.log).toHaveBeenCalledWith('Copying file (stub)', {
                sourceKey,
                destinationKey,
            });
        });

        it('should throw error if source file does not exist', async () => {
            const sourceKey = 'non-existing-source.txt';
            const destinationKey = 'test-destination.txt';

            await expect(adapter.copyFile(sourceKey, destinationKey)).rejects.toThrow(
                'Source file not found: non-existing-source.txt'
            );
        });
    });

    describe('deleteFile', () => {
        it('should delete a file', async () => {
            const key = 'test-delete.txt';

            await adapter.deleteFile(key);

            expect(loggerService.log).toHaveBeenCalledWith('Deleting file (stub)', { key });
        });
    });

    describe('getFileSize', () => {
        it('should return file size for existing files', async () => {
            const key = 'test-file.txt';

            const size = await adapter.getFileSize(key);

            expect(size).toBe(1024);
        });

        it('should throw error for non-existing files', async () => {
            const key = 'non-existing-file.txt';

            await expect(adapter.getFileSize(key)).rejects.toThrow(
                'File not found: non-existing-file.txt'
            );
        });
    });
});
