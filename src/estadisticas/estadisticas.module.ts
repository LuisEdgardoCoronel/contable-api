import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module';
import { VencimientosModule } from '../vencimientos/vencimientos.module';
import { EstadisticasController } from './estadisticas.controller';
import { EstadisticasService } from './estadisticas.service';

@Module({
  imports: [ClientesModule, VencimientosModule],
  controllers: [EstadisticasController],
  providers: [EstadisticasService],
})
export class EstadisticasModule {}
