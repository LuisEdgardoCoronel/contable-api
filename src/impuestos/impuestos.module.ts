import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Impuesto } from './impuesto.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Impuesto])],
  exports: [TypeOrmModule],
})
export class ImpuestosModule {}
