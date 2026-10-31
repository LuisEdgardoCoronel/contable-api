import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Impuesto } from './impuesto.entity';

@Injectable()
export class ImpuestosService {
  constructor(
    @InjectRepository(Impuesto)
    private readonly impuestos: Repository<Impuesto>,
  ) {}

  listar(): Promise<Impuesto[]> {
    return this.impuestos.find({ order: { nombre: 'ASC' } });
  }

  buscar(id: string): Promise<Impuesto | null> {
    return this.impuestos.findOneBy({ id });
  }
}
