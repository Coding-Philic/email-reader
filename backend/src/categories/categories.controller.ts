import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Controller('categories')
@UseGuards(SupabaseAuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async getCategories(@CurrentUser() user: AuthUser) {
    const categories = await this.categoriesService.getUserCategories(user.id);
    return { data: categories };
  }

  @Put(':id/rule')
  async updateRule(
    @CurrentUser() user: AuthUser,
    @Param('id') categoryId: string,
    @Body()
    body: {
      action: string;
      notifyTelegram: boolean;
      autoReplyTemplate?: string;
    },
  ) {
    await this.categoriesService.updateCategoryRule(
      user.id,
      categoryId,
      body.action,
      body.notifyTelegram,
      body.autoReplyTemplate,
    );
    return { message: 'Rule updated' };
  }

  @Put('order')
  async updateOrder(
    @CurrentUser() user: AuthUser,
    @Body() body: { orderedIds: string[] },
  ) {
    await this.categoriesService.updateCategoryOrder(user.id, body.orderedIds);
    return { message: 'Order updated' };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteCategory(
    @CurrentUser() user: AuthUser,
    @Param('id') categoryId: string,
  ) {
    await this.categoriesService.deleteCategory(user.id, categoryId);
    return { message: 'Category deleted' };
  }
}
