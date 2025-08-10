import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CustomJwtService } from './jwt.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserModule } from '../user/user.module';
import { CacheModule } from '../../core/cache/cache.module';
import { ConfigService } from '../../core/config/config.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.jwtSecret,
        signOptions: {
          expiresIn: configService.jwtExpirationTime,
        },
      }),
      inject: [ConfigService],
    }),
    UserModule,
    CacheModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    CustomJwtService,
    JwtStrategy,
  ],
  exports: [
    AuthService,
    CustomJwtService,
    PassportModule,
  ],
})
export class AuthModule {}