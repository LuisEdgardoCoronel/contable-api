import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { ClientesModule } from '../clientes/clientes.module';
import { EnvironmentVariables } from '../config/env.validation';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

/** Intentos de login permitidos por IP en cada ventana. */
export const LOGIN_INTENTOS = 5;
export const LOGIN_VENTANA_MS = 60_000;

@Module({
  imports: [
    UsuariosModule,
    ClientesModule,
    PassportModule,
    // Solo lo usa POST /auth/login (con @UseGuards(ThrottlerGuard)), no es global.
    // Guarda los contadores en memoria: con más de una instancia de la app
    // cada una cuenta por separado (habría que usar un storage compartido).
    ThrottlerModule.forRoot([
      { name: 'login', ttl: LOGIN_VENTANA_MS, limit: LOGIN_INTENTOS },
    ]),
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
