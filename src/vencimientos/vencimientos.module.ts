import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vencimiento } from './vencimiento.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Vencimiento])],
  exports: [TypeOrmModule],
})
export class VencimientosModule {}
