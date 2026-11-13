ALTER TABLE `inventory_items` ADD COLUMN `archivedAt` DATETIME(6) NULL;
CREATE INDEX `IDX_inventory_items_archivedAt` ON `inventory_items` (`archivedAt`);
