import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Impuesto } from './impuesto.entity';
import { ImpuestosController } from './impuestos.controller';
import { ImpuestosService } from './impuestos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Impuesto])],
  controllers: [ImpuestosController],
  providers: [ImpuestosService],
  exports: [TypeOrmModule, ImpuestosService],
})
export class ImpuestosModule {}
