-- Baseline of the existing POSCAFE MySQL schema.

CREATE TABLE `users` (
        `id` int NOT NULL AUTO_INCREMENT,
        `name` varchar(255) NOT NULL,
        `username` varchar(255) NOT NULL,
        `email` varchar(255) NULL,
        `password` varchar(255) NOT NULL,
        `avatar` varchar(500) NULL,
        `role` enum ('admin', 'cashier') NOT NULL DEFAULT 'cashier',
        `allowedPages` json NULL,
        `isActive` tinyint NOT NULL DEFAULT 1,
        `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (`id`),
        UNIQUE INDEX `UQ_users_username` (`username`),
        UNIQUE INDEX `UQ_users_email` (`email`),
        INDEX `IDX_users_role_isActive` (`role`, `isActive`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `categories` (
        `id` int NOT NULL AUTO_INCREMENT,
        `name` varchar(255) NOT NULL,
        `description` text NULL,
        `image` varchar(500) NULL,
        `isActive` tinyint NOT NULL DEFAULT 1,
        `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (`id`),
        UNIQUE INDEX `UQ_categories_name` (`name`),
        INDEX `IDX_categories_isActive` (`isActive`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sizes` (
        `id` int NOT NULL AUTO_INCREMENT,
        `name` varchar(50) NOT NULL,
        `sortOrder` int NOT NULL DEFAULT 0,
        `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (`id`),
        UNIQUE INDEX `UQ_sizes_name` (`name`),
        INDEX `IDX_sizes_sortOrder` (`sortOrder`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `app_settings` (
        `id` int NOT NULL,
        `appName` varchar(100) NOT NULL DEFAULT 'POSCAFE',
        `logoUrl` text NULL,
        `khrPerUsd` int NOT NULL DEFAULT 4100,
        `bakongAccountId` varchar(64) NULL,
        `bakongMerchantName` varchar(25) NULL,
        `bakongMerchantCity` varchar(15) NULL,
        `khqrDynamic` tinyint NOT NULL DEFAULT 1,
        `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (`id`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `products` (
        `id` int NOT NULL AUTO_INCREMENT,
        `categoryId` int NULL,
        `name` varchar(255) NOT NULL,
        `description` text NULL,
        `price` decimal(10,2) NOT NULL,
        `discountPercent` int NOT NULL DEFAULT 0,
        `image` varchar(500) NULL,
        `gallery` json NULL,
        `stockMode` enum ('count', 'recipe') NOT NULL DEFAULT 'count',
        `stock` int NOT NULL DEFAULT 0,
        `isAvailable` tinyint NOT NULL DEFAULT 1,
        `archivedAt` datetime(6) NULL,
        `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (`id`),
        INDEX `IDX_products_name` (`name`),
        INDEX `IDX_products_archivedAt_isAvailable` (`archivedAt`, `isAvailable`),
        INDEX `IDX_products_categoryId_archivedAt_isAvailable` (`categoryId`, `archivedAt`, `isAvailable`),
        CONSTRAINT `FK_products_categoryId` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `product_variants` (
        `id` int NOT NULL AUTO_INCREMENT,
        `productId` int NOT NULL,
        `size` varchar(50) NOT NULL,
        `price` decimal(10,2) NOT NULL DEFAULT '0.00',
        `sortOrder` int NOT NULL DEFAULT 0,
        `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (`id`),
        UNIQUE INDEX `UQ_product_variants_productId_size` (`productId`, `size`),
        CONSTRAINT `FK_product_variants_productId` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `stock_movements` (
        `id` int NOT NULL AUTO_INCREMENT,
        `productId` int NOT NULL,
        `userId` int NULL,
        `delta` int NOT NULL,
        `stockAfter` int NOT NULL,
        `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (`id`),
        INDEX `IDX_stock_movements_productId_createdAt` (`productId`, `createdAt`),
        CONSTRAINT `FK_stock_movements_productId` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT `FK_stock_movements_userId` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `orders` (
        `id` int NOT NULL AUTO_INCREMENT,
        `userId` int NOT NULL,
        `orderNumber` varchar(64) NOT NULL,
        `total` decimal(10,2) NOT NULL,
        `status` enum ('pending', 'preparing', 'ready', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
        `paymentStatus` enum ('unpaid', 'paid', 'refunded') NOT NULL DEFAULT 'unpaid',
        `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (`id`),
        UNIQUE INDEX `UQ_orders_orderNumber` (`orderNumber`),
        INDEX `IDX_orders_createdAt` (`createdAt`),
        INDEX `IDX_orders_paymentStatus_createdAt` (`paymentStatus`, `createdAt`),
        INDEX `IDX_orders_status_createdAt` (`status`, `createdAt`),
        INDEX `IDX_orders_userId_createdAt` (`userId`, `createdAt`),
        CONSTRAINT `FK_orders_userId` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `order_items` (
        `id` int NOT NULL AUTO_INCREMENT,
        `orderId` int NOT NULL,
        `productId` int NOT NULL,
        `size` varchar(50) NULL,
        `quantity` int NOT NULL,
        `unitPrice` decimal(10,2) NOT NULL,
        `subtotal` decimal(10,2) NOT NULL,
        `note` varchar(255) NULL,
        `extras` json NULL,
        `stockSource` enum ('recipe', 'stock') NOT NULL DEFAULT 'stock',
        `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (`id`),
        CONSTRAINT `FK_order_items_orderId` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT `FK_order_items_productId` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `payments` (
        `id` int NOT NULL AUTO_INCREMENT,
        `orderId` int NOT NULL,
        `refundedById` int NULL,
        `method` enum ('cash', 'qr', 'card') NOT NULL,
        `amount` decimal(10,2) NOT NULL,
        `tendered` decimal(10,2) NOT NULL,
        `change` decimal(10,2) NOT NULL,
        `refundedAt` datetime(6) NULL,
        `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (`id`),
        UNIQUE INDEX `UQ_payments_orderId` (`orderId`),
        INDEX `IDX_payments_createdAt` (`createdAt`),
        INDEX `IDX_payments_refundedAt` (`refundedAt`),
        CONSTRAINT `FK_payments_orderId` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT `FK_payments_refundedById` FOREIGN KEY (`refundedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `password_resets` (
        `id` int NOT NULL AUTO_INCREMENT,
        `userId` int NOT NULL,
        `codeHash` varchar(255) NOT NULL,
        `attempts` int NOT NULL DEFAULT 0,
        `expiresAt` datetime(6) NOT NULL,
        `consumedAt` datetime(6) NULL,
        `completedAt` datetime(6) NULL,
        `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (`id`),
        INDEX `IDX_password_resets_userId_createdAt` (`userId`, `createdAt`),
        INDEX `IDX_password_resets_createdAt` (`createdAt`),
        CONSTRAINT `FK_password_resets_userId` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `inventory_items` (
        `id` int NOT NULL AUTO_INCREMENT,
        `name` varchar(255) NOT NULL,
        `category` varchar(100) NOT NULL DEFAULT 'Packaging',
        `unit` varchar(50) NOT NULL DEFAULT 'pcs',
        `stockQuantity` decimal(12,3) NOT NULL DEFAULT '0.000',
        `minThreshold` decimal(12,3) NOT NULL DEFAULT '0.000',
        `costPerUnit` decimal(10,4) NOT NULL DEFAULT '0.0000',
        `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (`id`),
        INDEX `IDX_inventory_items_category_name` (`category`, `name`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `inventory_movements` (
        `id` int NOT NULL AUTO_INCREMENT,
        `inventoryItemId` int NOT NULL,
        `orderId` int NULL,
        `userId` int NULL,
        `delta` decimal(12,3) NOT NULL,
        `stockAfter` decimal(12,3) NOT NULL,
        `reason` varchar(100) NOT NULL DEFAULT 'restock',
        `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (`id`),
        INDEX `IDX_inventory_movements_inventoryItemId_createdAt` (`inventoryItemId`, `createdAt`),
        INDEX `IDX_inventory_movements_orderId_reason` (`orderId`, `reason`),
        CONSTRAINT `FK_inventory_movements_inventoryItemId` FOREIGN KEY (`inventoryItemId`) REFERENCES `inventory_items`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT `FK_inventory_movements_orderId` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT `FK_inventory_movements_userId` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `recipes` (
        `id` int NOT NULL AUTO_INCREMENT,
        `productId` int NOT NULL,
        `size` varchar(50) NULL,
        `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (`id`),
        UNIQUE INDEX `UQ_recipes_productId_size` (`productId`, `size`),
        CONSTRAINT `FK_recipes_productId` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `recipe_items` (
        `id` int NOT NULL AUTO_INCREMENT,
        `recipeId` int NOT NULL,
        `inventoryItemId` int NOT NULL,
        `quantity` decimal(12,3) NOT NULL,
        `unit` varchar(50) NULL,
        `optional` tinyint NOT NULL DEFAULT 0,
        `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (`id`),
        UNIQUE INDEX `UQ_recipe_items_recipeId_inventoryItemId` (`recipeId`, `inventoryItemId`),
        CONSTRAINT `FK_recipe_items_recipeId` FOREIGN KEY (`recipeId`) REFERENCES `recipes`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT `FK_recipe_items_inventoryItemId` FOREIGN KEY (`inventoryItemId`) REFERENCES `inventory_items`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
