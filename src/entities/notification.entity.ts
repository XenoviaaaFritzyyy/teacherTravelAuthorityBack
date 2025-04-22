import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';

export enum NotificationType {
  TRAVEL_REQUEST_APPROVED = 'TRAVEL_REQUEST_APPROVED',
  TRAVEL_REQUEST_REJECTED = 'TRAVEL_REQUEST_REJECTED',
  TRAVEL_REQUEST_EXPIRED = 'TRAVEL_REQUEST_EXPIRED',
  TRAVEL_REQUEST_COMPLETED = 'TRAVEL_REQUEST_COMPLETED',
  TRAVEL_REQUEST_VALIDATED = 'TRAVEL_REQUEST_VALIDATED',
  TRAVEL_REQUEST_RECEIPT = 'TRAVEL_REQUEST_RECEIPT',
  CERTIFICATE_OF_APPEARANCE_APPROVED = 'CERTIFICATE_OF_APPEARANCE_APPROVED'
}

@Entity()
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  message: string;

  @Column({
    type: 'enum',
    enum: NotificationType
  })
  type: NotificationType;

  @Column({ default: false })
  isRead: boolean;

  @ManyToOne(() => User, user => user.notifications)
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}
