import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('inventory_items')
export class InventoryItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  // Free-form grouping for the Inventory page, e.g. 'Packaging' (cups, lids,
  // straws) or 'Ingredient' (beans, milk, syrups).
  @Column({ type: 'varchar', length: 100, default: 'packaging' })
  category: string;

  // Unit of measure: 'pcs', 'g', 'ml', 'kg', 'L', etc.
  @Column({ type: 'varchar', length: 50, default: 'pcs' })
  unit: string;

  @Column('decimal', { precision: 12, scale: 3, default: 0 })
  stockQuantity: number;

  @Column('decimal', { precision: 12, scale: 3, default: 0 })
  minThreshold: number;

  @Column('decimal', { precision: 10, scale: 4, default: 0 })
  costPerUnit: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
