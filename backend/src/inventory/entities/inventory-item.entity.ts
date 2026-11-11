import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('inventory_items')
@Index('IDX_inventory_items_category_name', ['category', 'name'])
export class InventoryItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  // Supply group: 'Raw Materials' (beans, milk, syrups, ice), 'Packaging'
  // (cups, lids, straws, bags) or 'Operating Supplies' (gloves, cleaning),
  // or any custom name typed on the Inventory page.
  @Column({ type: 'varchar', length: 100, default: 'Packaging' })
  category: string;

  // Unit of measure: 'pcs', 'g', 'ml', 'kg', 'L', etc.
  @Column({ type: 'varchar', length: 50, default: 'pcs' })
  unit: string;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  stockQuantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  minThreshold: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  costPerUnit: number;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
