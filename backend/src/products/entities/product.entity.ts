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

  // Whole-product stock (used for products WITHOUT size options). Sized
  // products track stock per-size in `variants` instead.
  @Column({ default: 0 })
  stock: number;

  // Capacity high-water mark: the largest stock level ever set by an admin.
  // Orders decrement `stock` but never this, so sold = totalStock - stock.
  @Column({ default: 0 })
  totalStock: number;

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
