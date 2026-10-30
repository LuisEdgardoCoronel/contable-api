import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { emailNormalizado, recortar } from '../../common/utils/transforms';

export class CrearAccesoDto {
  @ApiProperty({
    example: 'duenio@laespiga.com',
    description: 'Email de login del cliente',
  })
  @Transform(emailNormalizado)
  @IsEmail()
  @MaxLength(255)
  email!: string;

  // bcrypt solo usa los primeros 72 bytes.
  @ApiProperty({
    minLength: 8,
    maxLength: 72,
    example: 'claveInicial123',
    description: 'Contraseña inicial',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiPropertyOptional({
    example: 'María Gómez',
    description: 'Nombre del usuario. Si se omite, se usa la razón social',
  })
  @Transform(recortar)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nombre?: string;
}
