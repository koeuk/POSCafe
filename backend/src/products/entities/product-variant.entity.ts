import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './product.entity';

/**
 * Per-size stock for a product. The product's `sizes` JSON still drives menu
 * display and pricing; this table is the source of truth for how many cups of
 * each size are in stock (and therefore what's out of stock).
 */
@Entity('product_variants')
@Index(['productId', 'size'], { unique: true })
export class ProductVariant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  productId: number;

  @ManyToOne(() => Product, (product) => product.variants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'varchar', length: 255 })
  size: string;

  // Price snapshot mirrored from the product's size option (for reference).
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ default: 0 })
  stock: number;
}
