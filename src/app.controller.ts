import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeController } from '@nestjs/swagger';

@ApiExcludeController()
@ApiTags('root')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Root endpoint' })
  getRoot() {
    return {
      message: 'Minka Collections Bridge API',
      version: '1.0.0',
      docs: '/api/docs',
    };
  }
}
