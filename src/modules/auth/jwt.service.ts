import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '../../core/config/config.service';
import { LoggerService } from '../../core/logger/logger.service';
import { UserContext } from '../../shared/interfaces/data-scope.interface';

export interface JwtPayload {
    sub: string;
    email: string;
    organizationId?: string;
    branchIds?: string[];
    roles: string[];
    permissions: string[];
    iat?: number;
    exp?: number;
}

export interface RefreshTokenPayload {
    sub: string;
    tokenVersion: number;
    iat?: number;
    exp?: number;
}

@Injectable()
export class CustomJwtService {
    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly logger: LoggerService
    ) {}

    /**
     * Generate access token with user context
     */
    generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
        try {
            const token = this.jwtService.sign(payload, {
                secret: this.configService.jwtSecret,
                expiresIn: this.configService.jwtExpirationTime,
            });

            this.logger.log('Access token generated', {
                userId: payload.sub,
                organizationId: payload.organizationId,
                roles: payload.roles,
                module: 'jwt',
            });

            return token;
        } catch (error) {
            this.logger.error('Failed to generate access token', error.message, {
                userId: payload.sub,
                module: 'jwt',
            });
            throw error;
        }
    }

    /**
     * Generate refresh token
     */
    generateRefreshToken(userId: string, tokenVersion: number = 1): string {
        try {
            const payload: RefreshTokenPayload = {
                sub: userId,
                tokenVersion,
            };

            const token = this.jwtService.sign(payload, {
                secret: this.configService.refreshTokenSecret,
                expiresIn: this.configService.refreshTokenExpirationTime,
            });

            this.logger.log('Refresh token generated', {
                userId,
                tokenVersion,
                module: 'jwt',
            });

            return token;
        } catch (error) {
            this.logger.error('Failed to generate refresh token', error.message, {
                userId,
                module: 'jwt',
            });
            throw error;
        }
    }

    /**
     * Verify and decode access token
     */
    verifyAccessToken(token: string): JwtPayload {
        try {
            const payload = this.jwtService.verify<JwtPayload>(token, {
                secret: this.configService.jwtSecret,
            });

            return payload;
        } catch (error) {
            this.logger.warn('Access token verification failed', {
                error: error.message,
                module: 'jwt',
            });
            throw error;
        }
    }

    /**
     * Verify and decode refresh token
     */
    verifyRefreshToken(token: string): RefreshTokenPayload {
        try {
            const payload = this.jwtService.verify<RefreshTokenPayload>(token, {
                secret: this.configService.refreshTokenSecret,
            });

            return payload;
        } catch (error) {
            this.logger.warn('Refresh token verification failed', {
                error: error.message,
                module: 'jwt',
            });
            throw error;
        }
    }

    /**
     * Decode token without verification (for debugging)
     */
    decodeToken(token: string): any {
        return this.jwtService.decode(token);
    }

    /**
     * Generate token pair (access + refresh)
     */
    generateTokenPair(
        userPayload: Omit<JwtPayload, 'iat' | 'exp'>,
        tokenVersion: number = 1
    ): { accessToken: string; refreshToken: string } {
        const accessToken = this.generateAccessToken(userPayload);
        const refreshToken = this.generateRefreshToken(userPayload.sub, tokenVersion);

        return {
            accessToken,
            refreshToken,
        };
    }

    /**
     * Extract user context from JWT payload
     */
    extractUserContext(payload: JwtPayload): UserContext {
        return {
            sub: payload.sub,
            email: payload.email,
            organizationId: payload.organizationId,
            branchIds: payload.branchIds,
            roles: payload.roles,
            permissions: payload.permissions,
        };
    }
}

// Export as JwtService for compatibility
export { CustomJwtService as JwtService };
