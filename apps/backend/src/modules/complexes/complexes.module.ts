import { Module } from '@nestjs/common';
import { ComplexesService } from './complexes.service';
import { ComplexesController } from './complexes.controller';

@Module({
  controllers: [ComplexesController],
  providers: [ComplexesService],
  exports: [ComplexesService],
})
export class ComplexesModule {}
