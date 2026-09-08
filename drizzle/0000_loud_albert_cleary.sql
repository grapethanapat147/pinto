CREATE TABLE `actions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`channel_label` text NOT NULL,
	`tone` text NOT NULL,
	`label` text NOT NULL,
	`title` text NOT NULL,
	`detail` text NOT NULL,
	`impact_kind` text NOT NULL,
	`impact_satang` integer NOT NULL,
	`insight` text NOT NULL,
	`recommendation` text NOT NULL,
	`detected_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `actions_shop_resolved` ON `actions` (`shop_id`,`resolved_at`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`channel_id` integer NOT NULL,
	`name` text NOT NULL,
	`spend_satang` integer NOT NULL,
	`revenue_satang` integer NOT NULL,
	`health` text NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaigns_shop_name` ON `campaigns` (`shop_id`,`name`);--> statement-breakpoint
CREATE TABLE `channel_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`channel_id` integer NOT NULL,
	`period` text NOT NULL,
	`sales_satang` integer NOT NULL,
	`order_count` integer NOT NULL,
	`profit_satang` integer NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channel_metrics_key` ON `channel_metrics` (`shop_id`,`channel_id`,`period`);--> statement-breakpoint
CREATE TABLE `channels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`code` text NOT NULL,
	`display_name` text NOT NULL,
	`kind` text NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channels_shop_code` ON `channels` (`shop_id`,`code`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`channel_id` integer NOT NULL,
	`order_id` integer,
	`customer_name` text NOT NULL,
	`topic` text NOT NULL,
	`unread_count` integer DEFAULT 0 NOT NULL,
	`last_message_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `conversations_shop_last_message` ON `conversations` (`shop_id`,`last_message_at`);--> statement-breakpoint
CREATE TABLE `customer_segments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`segment_key` text NOT NULL,
	`label` text NOT NULL,
	`customer_count` integer NOT NULL,
	`note` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `dashboard_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`scope` text NOT NULL,
	`period` text,
	`metric_key` text NOT NULL,
	`label` text NOT NULL,
	`value_satang` integer,
	`value_num` real,
	`unit` text NOT NULL,
	`note` text,
	`trend` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dashboard_metrics_key` ON `dashboard_metrics` (`shop_id`,`scope`,`period`,`metric_key`);--> statement-breakpoint
CREATE TABLE `inventory_levels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`on_hand` integer DEFAULT 0 NOT NULL,
	`reserved` integer DEFAULT 0 NOT NULL,
	`days_left` integer,
	`sync_state` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_levels_product` ON `inventory_levels` (`product_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`conversation_id` integer NOT NULL,
	`sender` text NOT NULL,
	`body` text NOT NULL,
	`sent_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `messages_conversation_sent` ON `messages` (`conversation_id`,`sent_at`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`channel_id` integer NOT NULL,
	`external_id` text NOT NULL,
	`customer_name` text NOT NULL,
	`total_satang` integer NOT NULL,
	`status` text NOT NULL,
	`placed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `orders_shop_placed` ON `orders` (`shop_id`,`placed_at`);--> statement-breakpoint
CREATE INDEX `orders_shop_status` ON `orders` (`shop_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_shop_external` ON `orders` (`shop_id`,`external_id`);--> statement-breakpoint
CREATE TABLE `payouts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`channel_id` integer NOT NULL,
	`expected_on` text NOT NULL,
	`order_count` integer NOT NULL,
	`amount_satang` integer NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payouts_shop_expected` ON `payouts` (`shop_id`,`expected_on`);--> statement-breakpoint
CREATE TABLE `product_opportunities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`growth_percent` real NOT NULL,
	`profit_satang` integer NOT NULL,
	`accent` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_shop_sku` ON `products` (`shop_id`,`sku`);--> statement-breakpoint
CREATE TABLE `regions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`name` text NOT NULL,
	`share_percent` real NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `restock_suggestions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`suggested_quantity` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shops` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `waterfall_steps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`label` text NOT NULL,
	`amount_satang` integer NOT NULL,
	`kind` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
