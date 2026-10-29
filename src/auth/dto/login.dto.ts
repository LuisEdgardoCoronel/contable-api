import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { emailNormalizado } from '../../common/utils/transforms';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'contador@estudio.com' })
  @Transform(emailNormalizado)
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'unaClaveSegura' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password!: string;
}
