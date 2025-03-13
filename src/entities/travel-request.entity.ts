import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';

export enum TravelRequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected'
}

export enum TravelLeeway {
  ONE_DAY = 1,
  THREE_DAYS = 3,
  FIVE_DAYS = 5
}

export enum ValidationStatus {
  PENDING = 'pending',
  VALIDATED = 'validated',
  REJECTED = 'rejected'
}

@Entity()
export class TravelRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  destination: string;

  @Column()
  purpose: string;

  @Column({ type: 'date' })
  travelDate: Date;

  @Column({
    type: 'enum',
    enum: TravelRequestStatus,
    default: TravelRequestStatus.PENDING
  })
  status: TravelRequestStatus;

  @Column({
    type: 'enum',
    enum: ValidationStatus,
    default: ValidationStatus.PENDING
  })
  validationStatus: ValidationStatus;

  @Column({
    type: 'enum',
    enum: TravelLeeway,
    default: TravelLeeway.ONE_DAY
  })
  leewayDays: TravelLeeway;

  @ManyToOne(() => User, user => user.travelRequests)
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  remarks?: string;

  @Column({ nullable: true })
  securityCode?: string;

  @Column({ nullable: true })
  codeExpirationDate?: Date;

  @Column({ nullable: true })
  lastUsedDate?: Date;

  @Column({ default: false })
  isCodeExpired: boolean;
}
