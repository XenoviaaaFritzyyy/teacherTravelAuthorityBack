import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum TravelRequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

export enum ValidationStatus {
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  REJECTED = 'REJECTED',
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
    default: TravelRequestStatus.PENDING,
  })
  status: TravelRequestStatus;

  @Column({
    type: 'boolean',
    default: false,
  })
  viewed: boolean;

  @Column({
    type: 'enum',
    enum: ValidationStatus,
    default: ValidationStatus.PENDING,
  })
  validationStatus: ValidationStatus;

  @ManyToOne(() => User, (user) => user.travelRequests, {
    eager: false,
  })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ default: '' })
  securityCode: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  codeExpirationDate: Date;

  /**
   * The key part: This must be a 'simple-array' or 'simple-json' column type
   * so we can store multiple string values in a TEXT-like column.
   */
  @Column('simple-array', { nullable: true })
  department: string[];

  @Column({ default: false })
  isCodeExpired: boolean;
}
