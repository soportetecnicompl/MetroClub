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

  @Get('clients')
  listClients(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: 'stamps' | 'points' | 'lastVisitAt' | 'createdAt',
  ) {
    return this.reportsService.listClients({
      search,
      sortBy,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('redemptions')
  listRedemptions(
    @Query('complexId') complexId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportsService.listRedemptions({
      complexId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
