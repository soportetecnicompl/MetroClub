import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { CreateScreenDto } from './dto/create-screen.dto';
import { CreateSeatsDto } from './dto/create-seats.dto';
import { CreatePriceRuleDto } from './dto/create-price-rule.dto';
import { CreateShowtimeDto } from './dto/create-showtime.dto';

/** Catálogo de cartelera: películas, salas, butacas, precios y funciones. */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  createMovie(dto: CreateMovieDto) {
    return this.prisma.movie.create({ data: dto });
  }

  listMovies() {
    return this.prisma.movie.findMany({ where: { isActive: true }, orderBy: { title: 'asc' } });
  }

  createScreen(dto: CreateScreenDto) {
    return this.prisma.screen.create({ data: dto });
  }

  createSeats(screenId: string, dto: CreateSeatsDto) {
    return this.prisma.seat.createMany({
      data: dto.seats.map((seat) => ({ screenId, row: seat.row, number: seat.number, type: seat.type })),
    });
  }

  createPriceRule(dto: CreatePriceRuleDto) {
    return this.prisma.priceRule.upsert({
      where: { complexId_format: { complexId: dto.complexId, format: dto.format } },
      update: { price: dto.price, isActive: true },
      create: dto,
    });
  }

  createShowtime(dto: CreateShowtimeDto) {
    return this.prisma.showtime.create({
      data: { ...dto, startsAt: new Date(dto.startsAt) },
    });
  }

  listShowtimes(params: { complexId?: string; movieId?: string; from?: Date }) {
    return this.prisma.showtime.findMany({
      where: {
        complexId: params.complexId,
        movieId: params.movieId,
        startsAt: params.from ? { gte: params.from } : undefined,
        status: { not: 'CANCELLED' },
      },
      orderBy: { startsAt: 'asc' },
      include: { movie: true, screen: true, priceRule: true },
    });
  }
}
