import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BoxOfficeService } from './box-office.service';
import { HoldSeatDto } from './dto/hold-seat.dto';
import { ConfirmSaleDto } from './dto/confirm-sale.dto';
import { ScanTicketDto } from './dto/scan-ticket.dto';

@UseGuards(JwtAuthGuard)
@Controller('ticketing')
export class BoxOfficeController {
  constructor(private readonly boxOfficeService: BoxOfficeService) {}

  @Get('showtimes/:id/seat-map')
  getSeatMap(@Param('id') showtimeId: string) {
    return this.boxOfficeService.getSeatMap(showtimeId);
  }

  @Post('showtimes/:id/holds')
  holdSeat(@Param('id') showtimeId: string, @Body() dto: HoldSeatDto) {
    return this.boxOfficeService.holdSeat(showtimeId, dto.seatId, dto.heldBy);
  }

  @Delete('showtimes/:id/holds/:seatId')
  releaseHold(@Param('id') showtimeId: string, @Param('seatId') seatId: string) {
    return this.boxOfficeService.releaseHold(showtimeId, seatId);
  }

  @Post('sales')
  confirmSale(@Body() dto: ConfirmSaleDto) {
    return this.boxOfficeService.confirmSale(dto);
  }

  @Post('tickets/scan')
  scanTicket(@Body() dto: ScanTicketDto) {
    return this.boxOfficeService.scanTicket(dto.qrToken);
  }
}
