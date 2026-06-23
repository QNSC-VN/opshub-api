import { Module } from '@nestjs/common';
import { RequestsController } from './interface/http/requests.controller';

/**
 * Unified requests inbox module.
 *
 * No own service/repo needed — the RequestEngine lives in the global
 * PlatformModule and is injected directly into the controller.
 */
@Module({
  controllers: [RequestsController],
})
export class RequestsModule {}
