import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CheckoutService } from './checkout.service';
import { ConfirmCombinedSaleDto } from './dto/confirm-combined-sale.dto';

@UseGuards(JwtAuthGuard)
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('sale')
  confirmCombinedSale(@Body() dto: ConfirmCombinedSaleDto) {
    return this.checkoutService.confirmCombinedSale(dto);
  }
}
