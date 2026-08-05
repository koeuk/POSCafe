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
 * A product's size option (e.g. S/M/L): its price and its stock. This table
 * is the single source of truth for sized products — menu display, checkout
 * pricing and stock tracking all read from here.
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

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  price: number;

  // Display/menu order (the position of the size row in the product form).
  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: 0 })
  stock: number;
}
