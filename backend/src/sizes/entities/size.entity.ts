import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Master list of cup sizes (e.g. Small / Medium / Large). Products pick from
 * these in the product form; the chosen name + price is stored on the product.
 */
@Entity('sizes')
export class Size {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ default: 0 })
  sortOrder: number;
}
