import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  getDashboard(@Query('complexId') complexId?: string) {
    return this.reportsService.getDashboardSummary(complexId);
  }

  @Get('clients/export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="clientes-metroclub.csv"')
  exportClients() {
    return this.reportsService.exportClientsCsv();
  }
}
