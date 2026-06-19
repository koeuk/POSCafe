import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  // Optional size options (e.g. S/M/L) with their own prices. When set, the
  // `price` above acts as the default/base and the cashier must pick a size.
  @Column({ type: 'json', nullable: true })
  sizes: { size: string; price: number }[] | null;

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

  @Column({ default: 0 })
  stock: number;

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
