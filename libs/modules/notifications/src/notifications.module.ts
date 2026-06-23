import { Module } from '@nestjs/common';
import { NotificationsService } from './application/notifications.service';
import { NotificationRelayService } from './application/notification-relay.service';
import { EmailRelayService } from './application/email-relay.service';
import { NotificationsController } from './interface/http/notifications.controller';
import { NotificationDrizzleRepository } from './infrastructure/persistence/notification.drizzle-repository';
import { NOTIFICATION_REPOSITORY } from './domain/ports/notification.repository';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationRelayService,
    EmailRelayService,
    { provide: NOTIFICATION_REPOSITORY, useClass: NotificationDrizzleRepository },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
