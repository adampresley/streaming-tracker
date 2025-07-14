CREATE TABLE `platforms` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platforms_name_unique` ON `platforms` (`name`);--> statement-breakpoint
CREATE TABLE `shows` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`total_seasons` integer NOT NULL,
	`platform_id` integer NOT NULL,
	FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shows_to_users` (
	`show_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`status` text DEFAULT 'WANT_TO_WATCH' NOT NULL,
	`current_season` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_name_unique` ON `users` (`name`);