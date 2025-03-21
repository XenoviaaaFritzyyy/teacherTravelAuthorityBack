import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';

export enum TravelRequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected'
}

export enum ValidationStatus {
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  REJECTED = 'REJECTED'
}

@Entity()
export class TravelRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  purpose: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

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

  @ManyToOne(() => User, user => user.travelRequests, {
    eager: false
  })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ default: '' })
  remarks: string;

  @Column({ default: '' })
  securityCode: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  codeExpirationDate: Date;

  @Column({ default: false })
  isCodeExpired: boolean;
}
