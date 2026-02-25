import { IsEnum } from 'class-validator';

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
}

export class UpdateAppointmentStatusDto {
  @IsEnum(AppointmentStatus, {
    message:
      'status must be one of: scheduled, confirmed, in_progress, completed, canceled',
  })
  status: AppointmentStatus;
}
