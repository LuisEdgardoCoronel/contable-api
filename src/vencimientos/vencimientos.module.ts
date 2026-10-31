import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientesModule } from '../clientes/clientes.module';
import { ImpuestosModule } from '../impuestos/impuestos.module';
import { Vencimiento } from './vencimiento.entity';
import { VencimientosController } from './vencimientos.controller';
import { VencimientosService } from './vencimientos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vencimiento]),
    ClientesModule,
    ImpuestosModule,
  ],
  controllers: [VencimientosController],
  providers: [VencimientosService],
  exports: [TypeOrmModule],
})
export class VencimientosModule {}
