import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '../../../core/config/config.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { JwtPayload } from '../jwt.service';
import { UserContext } from '../../../shared/interfaces/data-scope.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private readonly configService: ConfigService,
        private readonly logger: LoggerService
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.jwtSecret,
        });
    }

    async validate(payload: JwtPayload): Promise<UserContext> {
        try {
            // Basic payload validation
            if (!payload.sub || !payload.email) {
                this.logger.warn('Invalid JWT payload: missing required fields', {
                    hasUserId: !!payload.sub,
                    hasEmail: !!payload.email,
                    module: 'jwt-strategy',
                });
                throw new UnauthorizedException('Invalid token payload');
            }

            // Extract user context
            const userContext: UserContext = {
                sub: payload.sub,
                email: payload.email,
                organizationId: payload.organizationId,
                branchIds: payload.branchIds || [],
                roles: payload.roles || [],
                permissions: payload.permissions || [],
            };

            this.logger.debug('JWT validation successful', {
                userId: userContext.sub,
                organizationId: userContext.organizationId,
                roles: userContext.roles,
                module: 'jwt-strategy',
            });

            return userContext;
        } catch (error) {
            this.logger.error('JWT validation failed', error.message, {
                module: 'jwt-strategy',
                error: error.message,
            });
            throw new UnauthorizedException('Token validation failed');
        }
    }
}
