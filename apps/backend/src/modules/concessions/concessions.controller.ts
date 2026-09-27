import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { ConcessionsService } from './concessions.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { SetRecipeDto } from './dto/set-recipe.dto';
import { SellConcessionsDto } from './dto/sell-concessions.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('concessions')
export class ConcessionsController {
  constructor(private readonly concessionsService: ConcessionsService) {}

  @Get('ingredients')
  listIngredients(@Query('complexId') complexId?: string) {
    return this.concessionsService.listIngredients(complexId);
  }

  @Post('ingredients')
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN', 'COMPLEX_ADMIN')
  createIngredient(@Body() dto: CreateIngredientDto) {
    return this.concessionsService.createIngredient(dto);
  }

  @Post('ingredients/:id/movements')
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN', 'COMPLEX_ADMIN')
  adjustStock(@Param('id') id: string, @Body() dto: AdjustStockDto, @Req() req: Request) {
    return this.concessionsService.adjustStock(id, dto, (req.user as JwtPayload | undefined)?.sub);
  }

  @Get('ingredients/:id/movements')
  listMovements(@Param('id') id: string) {
    return this.concessionsService.listMovements(id);
  }

  @Get('products')
  listProducts(@Query('complexId') complexId?: string) {
    return this.concessionsService.listProducts(complexId);
  }

  @Post('products')
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN', 'COMPLEX_ADMIN')
  createProduct(@Body() dto: CreateProductDto) {
    return this.concessionsService.createProduct(dto);
  }

  @Post('products/:id/recipe')
  @Roles('SUPER_ADMIN', 'CENTRAL_ADMIN', 'COMPLEX_ADMIN')
  setRecipe(@Param('id') id: string, @Body() dto: SetRecipeDto) {
    return this.concessionsService.setRecipe(id, dto);
  }

  @Post('sales')
  sellProducts(@Body() dto: SellConcessionsDto, @Req() req: Request) {
    return this.concessionsService.sellProducts(dto, (req.user as JwtPayload | undefined)?.sub);
  }

  @Get('sales')
  listSales(@Query('complexId') complexId?: string) {
    return this.concessionsService.listSales(complexId);
  }
}
