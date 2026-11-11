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
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { Recipe } from './recipe.entity';

@Entity('recipe_items')
@Index(
  'UQ_recipe_items_recipeId_inventoryItemId',
  ['recipeId', 'inventoryItemId'],
  { unique: true },
)
export class RecipeItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  recipeId: number;

  @ManyToOne(() => Recipe, (recipe) => recipe.items, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'recipeId',
    foreignKeyConstraintName: 'FK_recipe_items_recipeId',
  })
  recipe: Recipe;

  @Column({ type: 'int' })
  inventoryItemId: number;

  @ManyToOne(() => InventoryItem, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'inventoryItemId',
    foreignKeyConstraintName: 'FK_recipe_items_inventoryItemId',
  })
  inventoryItem: InventoryItem;

  // Quantity of inventory item consumed per drink (e.g. 18 for g, 200 for ml, 1 for cup)
  @Column({ type: 'decimal', precision: 12, scale: 3 })
  quantity: number;

  // Unit `quantity` is written in. null = the inventory item's own unit.
  // May differ from the item's unit within the same family (item stocked in
  // kg, recipe line in g) — see inventory/units.ts for the conversion.
  @Column({ type: 'varchar', length: 50, nullable: true })
  unit: string | null;

  // Customer's choice (sugar, straw…): not part of the base drink. Only
  // deducted when the cashier adds it to the order line at checkout, as
  // many times as chosen.
  @Column({ type: 'boolean', default: false })
  optional: boolean;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
