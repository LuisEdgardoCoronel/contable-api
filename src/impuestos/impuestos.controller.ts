import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ImpuestoResponseDto } from './dto/impuesto-response.dto';
import { ImpuestosService } from './impuestos.service';

@ApiTags('impuestos')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'No autenticado' })
@Controller('impuestos')
export class ImpuestosController {
  constructor(private readonly impuestosService: ImpuestosService) {}

  @Get()
  @ApiResponse({ status: 200, type: [ImpuestoResponseDto] })
  listar() {
    return this.impuestosService.listar();
  }
}
