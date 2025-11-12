import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import appConfig from '../../../config/app.config';

@Injectable()
export class JwtStrategy2 extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // ignoreExpiration: false,
      ignoreExpiration: true,
      secretOrKey: appConfig().jwt.secret,
    });

    console.log(ExtractJwt.fromAuthHeaderAsBearerToken());
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      email: payload.email,
      userPrefId: payload.userPrefId,
    };
  }
}
