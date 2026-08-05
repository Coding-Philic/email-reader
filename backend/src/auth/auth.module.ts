import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { TokenEncryptionService } from './token-encryption.service';
import { GmailModule } from '../gmail/gmail.module';

@Module({
  imports: [forwardRef(() => GmailModule)],
  controllers: [AuthController],
  providers: [AuthService, SupabaseAuthGuard, TokenEncryptionService],
  exports: [AuthService, SupabaseAuthGuard, TokenEncryptionService],
})
export class AuthModule {}
