export interface BiometricTemplate {
    id: string;
    userId: string;
    type: 'fingerprint' | 'face' | 'iris' | 'voice';
    template: string; // Base64 encoded template data
    quality: number; // 0-100
    createdAt: Date;
    updatedAt: Date;
}

export interface BiometricMatchRequest {
    template: string; // Base64 encoded biometric data
    type: 'fingerprint' | 'face' | 'iris' | 'voice';
    organizationId: string;
    branchId?: string;
    threshold?: number; // Matching threshold (0-100)
}

export interface BiometricMatchResult {
    matched: boolean;
    userId?: string;
    confidence: number; // 0-100
    template?: BiometricTemplate;
    processingTime: number; // milliseconds
}

export interface BiometricEnrollRequest {
    userId: string;
    type: 'fingerprint' | 'face' | 'iris' | 'voice';
    samples: string[]; // Multiple samples for better accuracy
    organizationId: string;
}

export interface BiometricEnrollResult {
    success: boolean;
    templateId?: string;
    quality: number;
    message?: string;
}

export interface MatchingStatistics {
    totalMatches: number;
    successfulMatches: number;
    failedMatches: number;
    averageConfidence: number;
    averageProcessingTime: number;
    lastUpdated: Date;
}

export interface QualityCheckResult {
    quality: number; // 0-100
    issues: string[];
    recommendations: string[];
    acceptable: boolean;
}

export interface IMatchingAdapter {
    /**
     * Enroll a new biometric template
     */
    enrollBiometric(request: BiometricEnrollRequest): Promise<BiometricEnrollResult>;

    /**
     * Match biometric data against stored templates
     */
    matchBiometric(request: BiometricMatchRequest): Promise<BiometricMatchResult>;

    /**
     * Match biometric data against a specific user's templates
     */
    verifyBiometric(
        userId: string,
        template: string,
        type: 'fingerprint' | 'face' | 'iris' | 'voice',
        threshold?: number
    ): Promise<BiometricMatchResult>;

    /**
     * Get all biometric templates for a user
     */
    getUserTemplates(userId: string): Promise<BiometricTemplate[]>;

    /**
     * Delete a biometric template
     */
    deleteTemplate(templateId: string): Promise<void>;

    /**
     * Delete all templates for a user
     */
    deleteUserTemplates(userId: string): Promise<void>;

    /**
     * Update a biometric template
     */
    updateTemplate(templateId: string, samples: string[]): Promise<BiometricEnrollResult>;

    /**
     * Check biometric data quality
     */
    checkQuality(
        template: string,
        type: 'fingerprint' | 'face' | 'iris' | 'voice'
    ): Promise<QualityCheckResult>;

    /**
     * Get matching statistics
     */
    getMatchingStatistics(
        organizationId: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<MatchingStatistics>;

    /**
     * Bulk enroll biometric templates
     */
    bulkEnrollBiometrics(requests: BiometricEnrollRequest[]): Promise<BiometricEnrollResult[]>;

    /**
     * Search for similar templates (duplicate detection)
     */
    findSimilarTemplates(
        template: string,
        type: 'fingerprint' | 'face' | 'iris' | 'voice',
        threshold?: number
    ): Promise<BiometricTemplate[]>;

    /**
     * Get template by ID
     */
    getTemplate(templateId: string): Promise<BiometricTemplate>;

    /**
     * List templates by organization
     */
    listTemplates(
        organizationId: string,
        type?: 'fingerprint' | 'face' | 'iris' | 'voice'
    ): Promise<BiometricTemplate[]>;

    /**
     * Optimize matching database (cleanup, indexing, etc.)
     */
    optimizeDatabase(): Promise<{ message: string; duration: number }>;

    /**
     * Test adapter connectivity and performance
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        responseTime: number;
        version?: string;
        capabilities: string[];
    }>;
}
