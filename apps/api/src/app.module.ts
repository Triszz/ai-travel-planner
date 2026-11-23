import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PlansModule } from './plans/plans.module.js';

@Module({
  imports: [PlansModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
