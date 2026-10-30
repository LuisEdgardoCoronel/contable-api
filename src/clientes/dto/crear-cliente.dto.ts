import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  cuitNormalizado,
  emailNormalizado,
  recortar,
  recortarONull,
} from '../../common/utils/transforms';
import { IsCuit } from '../../common/validators/is-cuit.validator';
import { CondicionIVA } from '../cliente.entity';

export class CrearClienteDto {
  @ApiProperty({ example: 'Panadería La Espiga SRL' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  razonSocial!: string;

  @ApiProperty({
    example: '30712345671',
    description: 'Se aceptan guiones o espacios; se guarda solo con dígitos',
  })
  @Transform(cuitNormalizado)
  @IsCuit()
  cuit!: string;

  @ApiProperty({
    example: 'administracion@laespiga.com',
    description: 'Email de contacto (puede diferir del email de login)',
  })
  @Transform(emailNormalizado)
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '1145678900' })
  @Transform(recortarONull)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  telefono?: string | null;

  @ApiProperty({ enum: CondicionIVA })
  @IsEnum(CondicionIVA)
  condicionIVA!: CondicionIVA;
}
