import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Master list of cup sizes (e.g. Small / Medium / Large). Products pick from
 * these in the product form; the chosen name + price is stored on the product.
 */
@Entity('sizes')
@Index('UQ_sizes_name', ['name'], { unique: true })
@Index('IDX_sizes_sortOrder', ['sortOrder'])
export class Size {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
