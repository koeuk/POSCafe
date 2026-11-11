import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';

/**
 * A product's size option (e.g. S/M/L) and its price. Sizes never carry
 * stock: a 'count' product keeps one figure on the product row, a 'recipe'
 * product is made to order from consumables (see Product.stockMode).
 */
@Entity('product_variants')
@Index('UQ_product_variants_productId_size', ['productId', 'size'], {
  unique: true,
})
export class ProductVariant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  productId: number;

  @ManyToOne(() => Product, (product) => product.variants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'productId',
    foreignKeyConstraintName: 'FK_product_variants_productId',
  })
  product: Product;

  @Column({ type: 'varchar', length: 50 })
  size: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  // Display/menu order (the position of the size row in the product form).
  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
