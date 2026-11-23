import { Controller, Param, Post, UseGuards } from '@nestjs/common';

import { AuthenticationGuard } from '../auth/authentication.guard.js';

@Controller('plans')
@UseGuards(AuthenticationGuard)
export class PlansController {
  @Post(':planId/save')
  savePlan(@Param('planId') planId: string) {
    return {
      planId,
      status: 'not-implemented',
    };
  }
}
