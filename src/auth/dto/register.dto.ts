import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { emailNormalizado, recortar } from '../../common/utils/transforms';
import {
  Allow,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'contador@estudio.com' })
  @Transform(emailNormalizado)
  @IsEmail()
  email!: string;

  // bcrypt solo usa los primeros 72 bytes.
  @ApiProperty({ minLength: 8, maxLength: 72, example: 'unaClaveSegura' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: 'Juan Pérez' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nombre!: string;

  /**
   * Se acepta para que `forbidNonWhitelisted` no rechace el request, pero se
   * ignora: register siempre crea un admin.
   */
  @ApiHideProperty()
  @Allow()
  rol?: unknown;
}
