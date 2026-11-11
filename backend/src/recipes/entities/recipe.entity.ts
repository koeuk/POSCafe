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
import { Product } from '../../products/entities/product.entity';
import { RecipeItem } from './recipe-item.entity';

@Entity('recipes')
@Index('UQ_recipes_productId_size', ['productId', 'size'], { unique: true })
export class Recipe {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  productId: number;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'productId',
    foreignKeyConstraintName: 'FK_recipes_productId',
  })
  product: Product;

  // null for sizeless drinks/items, or '12oz', '16oz', '22oz', 'S', 'M', 'L', etc.
  @Column({ type: 'varchar', length: 50, nullable: true })
  size: string | null;

  @OneToMany(() => RecipeItem, (item) => item.recipe, { cascade: true })
  items: RecipeItem[];

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
