import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { Recipe } from './recipe.entity';

@Entity('recipe_items')
export class RecipeItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  recipeId: number;

  @ManyToOne(() => Recipe, (recipe) => recipe.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipeId' })
  recipe: Recipe;

  @Column()
  inventoryItemId: number;

  @ManyToOne(() => InventoryItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventoryItemId' })
  inventoryItem: InventoryItem;

  // Quantity of inventory item consumed per drink (e.g. 18 for g, 200 for ml, 1 for cup)
  @Column('decimal', { precision: 12, scale: 3 })
  quantity: number;

  // Unit `quantity` is written in. null = the inventory item's own unit.
  // May differ from the item's unit within the same family (item stocked in
  // kg, recipe line in g) — see inventory/units.ts for the conversion.
  @Column({ type: 'varchar', length: 50, nullable: true })
  unit: string | null;
}
