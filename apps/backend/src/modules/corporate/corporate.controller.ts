import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CorporateService } from './corporate.service';
import { CreateCorporateAccountDto } from './dto/create-corporate-account.dto';
import { CreateBatchDto } from './dto/create-batch.dto';
import { RedeemVoucherDto } from './dto/redeem-voucher.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('corporate')
export class CorporateController {
  constructor(private readonly corporateService: CorporateService) {}

  @Get('accounts')
  listAccounts() {
    return this.corporateService.listAccounts();
  }

  @Post('accounts')
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN')
  createAccount(@Body() dto: CreateCorporateAccountDto) {
    return this.corporateService.createAccount(dto);
  }

  @Get('batches')
  listBatches(@Query('corporateAccountId') corporateAccountId?: string) {
    return this.corporateService.listBatches(corporateAccountId);
  }

  @Post('batches')
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN')
  createBatch(@Body() dto: CreateBatchDto) {
    return this.corporateService.createBatch(dto);
  }

  @Get('batches/:id/vouchers')
  listVouchers(@Param('id') id: string) {
    return this.corporateService.listVouchers(id);
  }

  @Post('vouchers/redeem')
  redeemVoucher(@Body() dto: RedeemVoucherDto) {
    return this.corporateService.redeemVoucher(dto);
  }

  @Post('vouchers/:id/void')
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN', 'COMPLEX_ADMIN')
  voidVoucher(@Param('id') id: string) {
    return this.corporateService.voidVoucher(id);
  }
}
