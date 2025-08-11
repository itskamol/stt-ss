export interface PresignedUrlOptions {
    expiresIn?: number; // seconds
    contentType?: string;
    contentLength?: number;
}

export interface UploadResult {
    key: string;
    url: string;
    etag?: string;
    size?: number;
}

export interface DownloadResult {
    stream: NodeJS.ReadableStream;
    contentType?: string;
    contentLength?: number;
    lastModified?: Date;
}

export interface StorageObject {
    key: string;
    size: number;
    lastModified: Date;
    etag: string;
    contentType?: string;
}

export interface IStorageAdapter {
    /**
     * Generate a presigned URL for uploading a file
     */
    generatePresignedUploadUrl(key: string, options?: PresignedUrlOptions): Promise<string>;

    /**
     * Generate a presigned URL for downloading a file
     */
    generatePresignedDownloadUrl(key: string, options?: PresignedUrlOptions): Promise<string>;

    /**
     * Upload a file directly
     */
    uploadFile(
        key: string,
        data: Buffer | NodeJS.ReadableStream,
        contentType?: string
    ): Promise<UploadResult>;

    /**
     * Download a file directly
     */
    downloadFile(key: string): Promise<DownloadResult>;

    /**
     * Delete a file
     */
    deleteFile(key: string): Promise<void>;

    /**
     * Check if a file exists
     */
    fileExists(key: string): Promise<boolean>;

    /**
     * Get file metadata
     */
    getFileMetadata(key: string): Promise<StorageObject>;

    /**
     * List files with a prefix
     */
    listFiles(prefix: string, maxKeys?: number): Promise<StorageObject[]>;

    /**
     * Copy a file
     */
    copyFile(sourceKey: string, destinationKey: string): Promise<void>;

    /**
     * Get file size
     */
    getFileSize(key: string): Promise<number>;
}
