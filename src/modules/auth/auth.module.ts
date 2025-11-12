import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import appConfig from '../../config/app.config';
import { MailModule } from '../../mail/mail.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtStrategy2 } from './strategies/jwt.strategy2';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // JwtModule.register({
    //   secret: appConfig().jwt.secret,
    //   signOptions: { expiresIn: appConfig().jwt.expiry },
    // }),
    JwtModule.registerAsync({
      useFactory: async () => ({
        secret: appConfig().jwt.secret,
        signOptions: { expiresIn: appConfig().jwt.expiry },
      }),
    }),
    PrismaModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    GoogleStrategy,
    JwtStrategy2,
  ],
  exports: [AuthService],
})
export class AuthModule {}
