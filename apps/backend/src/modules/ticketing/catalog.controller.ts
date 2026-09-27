import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CatalogService } from './catalog.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { CreateScreenDto } from './dto/create-screen.dto';
import { CreateSeatsDto } from './dto/create-seats.dto';
import { CreatePriceRuleDto } from './dto/create-price-rule.dto';
import { CreateShowtimeDto } from './dto/create-showtime.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ticketing')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('movies')
  listMovies() {
    return this.catalogService.listMovies();
  }

  @Post('movies')
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN')
  createMovie(@Body() dto: CreateMovieDto) {
    return this.catalogService.createMovie(dto);
  }

  @Get('screens')
  listScreens(@Query('complexId') complexId?: string) {
    return this.catalogService.listScreens(complexId);
  }

  @Post('screens')
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN')
  createScreen(@Body() dto: CreateScreenDto) {
    return this.catalogService.createScreen(dto);
  }

  @Get('screens/:id/seats')
  listSeats(@Param('id') screenId: string) {
    return this.catalogService.listSeats(screenId);
  }

  @Post('screens/:id/seats')
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN')
  createSeats(@Param('id') screenId: string, @Body() dto: CreateSeatsDto) {
    return this.catalogService.createSeats(screenId, dto);
  }

  @Get('price-rules')
  listPriceRules(@Query('complexId') complexId?: string) {
    return this.catalogService.listPriceRules(complexId);
  }

  @Post('price-rules')
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN')
  createPriceRule(@Body() dto: CreatePriceRuleDto) {
    return this.catalogService.createPriceRule(dto);
  }

  @Post('showtimes')
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN')
  createShowtime(@Body() dto: CreateShowtimeDto) {
    return this.catalogService.createShowtime(dto);
  }

  @Get('showtimes')
  listShowtimes(
    @Query('complexId') complexId?: string,
    @Query('movieId') movieId?: string,
    @Query('from') from?: string,
  ) {
    return this.catalogService.listShowtimes({ complexId, movieId, from: from ? new Date(from) : undefined });
  }
}
