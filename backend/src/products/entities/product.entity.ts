import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { ProductVariant } from './product-variant.entity';

export type StockMode = 'count' | 'recipe';
export const STOCK_MODES: StockMode[] = ['count', 'recipe'];

@Entity('products')
@Index('IDX_products_categoryId_archivedAt_isAvailable', [
  'categoryId',
  'archivedAt',
  'isAvailable',
])
@Index('IDX_products_archivedAt_isAvailable', ['archivedAt', 'isAvailable'])
@Index('IDX_products_name', ['name'])
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Base price. For sized products (any `variants` rows) each variant carries
  // its own price and this acts only as a fallback/default.
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  // Percentage off the price (0–100). 0 = no discount.
  @Column({ type: 'int', default: 0 })
  discountPercent: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image: string | null;

  // Additional gallery images (URLs or uploaded paths). null = none.
  @Column({ type: 'json', nullable: true })
  gallery: string[] | null;

  @Column({ type: 'boolean', default: true })
  isAvailable: boolean;

  // How the product's availability is tracked — one rule per product:
  //  - 'count':  `stock` is the number of units on hand, whatever the size.
  //              Sizes only differ by price.
  //  - 'recipe': made to order. Each sale deducts the consumables in the
  //              product's recipe(s) and `stock` is ignored (kept at 0).
  @Column({ type: 'enum', enum: STOCK_MODES, default: 'count' })
  stockMode: StockMode;

  // Units on hand for a 'count' product. Always 0 for a 'recipe' product.
  @Column({ type: 'int', default: 0 })
  stock: number;

  // Set when a product with sales history is "deleted": it leaves the menu,
  // POS, catalog and stock reports, but stays for order history and reports.
  // See product-removal.ts.
  @Column({ type: 'datetime', precision: 6, nullable: true })
  archivedAt: Date | null;

  @OneToMany(() => ProductVariant, (variant) => variant.product, {
    cascade: true,
  })
  variants: ProductVariant[];

  // null only for an archived product whose category was force-deleted.
  @Column({ type: 'int', nullable: true })
  categoryId: number | null;

  @ManyToOne(() => Category, (category) => category.products, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'categoryId',
    foreignKeyConstraintName: 'FK_products_categoryId',
  })
  category: Category | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
