import {
  Column,
  CreateDateColumn,
  Entity,
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
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  // Base price. For sized products (any `variants` rows) each variant carries
  // its own price and this acts only as a fallback/default.
  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  // Percentage off the price (0–100). 0 = no discount.
  @Column({ type: 'int', default: 0 })
  discountPercent: number;

  @Column({ nullable: true })
  image: string;

  // Additional gallery images (URLs or uploaded paths). null = none.
  @Column({ type: 'json', nullable: true })
  gallery: string[] | null;

  @Column({ default: true })
  isAvailable: boolean;

  // How the product's availability is tracked — one rule per product:
  //  - 'count':  `stock` is the number of units on hand, whatever the size.
  //              Sizes only differ by price.
  //  - 'recipe': made to order. Each sale deducts the consumables in the
  //              product's recipe(s) and `stock` is ignored (kept at 0).
  @Column({ type: 'varchar', length: 10, default: 'count' })
  stockMode: StockMode;

  // Units on hand for a 'count' product. Always 0 for a 'recipe' product.
  @Column({ default: 0 })
  stock: number;

  @OneToMany(() => ProductVariant, (variant) => variant.product, {
    cascade: true,
  })
  variants: ProductVariant[];

  @Column()
  categoryId: number;

  @ManyToOne(() => Category, (category) => category.products, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
