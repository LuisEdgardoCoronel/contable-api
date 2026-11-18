import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';
import { ClientesModule } from '../clientes/clientes.module';
import { EnvironmentVariables } from '../config/env.validation';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

/** Ventana del rate limit del login. El límite sale de `LOGIN_RATE_LIMIT`. */
export const LOGIN_VENTANA_MS = 60_000;

/** Opciones del throttler del login: `intentos` por ventana y por IP. */
export function opcionesRateLimitLogin(
  intentos: number,
): ThrottlerModuleOptions {
  return [{ name: 'login', ttl: LOGIN_VENTANA_MS, limit: intentos }];
}

@Module({
  imports: [
    UsuariosModule,
    ClientesModule,
    PassportModule,
    // Solo lo usa POST /auth/login (con @UseGuards(ThrottlerGuard)), no es global.
    // Guarda los contadores en memoria: con más de una instancia de la app
    // cada una cuenta por separado (habría que usar un storage compartido).
    // Límite por minuto configurable con LOGIN_RATE_LIMIT (default 5).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        opcionesRateLimitLogin(config.get('LOGIN_RATE_LIMIT', { infer: true })),
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          // El formato ("1d", "12h", "3600") se valida al arrancar.
          expiresIn: config.get('JWT_EXPIRES_IN', {
            infer: true,
          }) as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
