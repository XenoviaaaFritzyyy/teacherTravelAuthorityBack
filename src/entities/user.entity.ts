import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Notification } from './notification.entity';
import { TravelRequest } from './travel-request.entity';

export enum UserRole {
  TEACHER = 'Teacher',
  PRINCIPAL = 'Principal',
  PSDS = 'PSDS',
  ASDS = 'ASDS',
  AO_ADMIN_OFFICER = 'AO Admin Officer',
  AO_ADMIN = 'AO Admin',
  ADMIN = 'Admin'
}

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column({ select: false })
  password: string;

  @Column()
  first_name: string;

  @Column()
  last_name: string;

  @Column()
  school_id: string;

  @Column()
  school_name: string;

  @Column()
  district: string;

  @Column()
  email: string;

  @Column()
  position: string;

  @Column()
  contact_no: string;

  @Column()
  employee_number: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.TEACHER
  })
  role: UserRole;

  @Column()
  createdAt: Date = new Date();

  @Column({ default: false })
  requirePasswordChange: boolean;

  @OneToMany(() => Notification, notification => notification.user)
  notifications: Notification[];

  @OneToMany(() => TravelRequest, travelRequest => travelRequest.user)
  travelRequests: TravelRequest[];
}