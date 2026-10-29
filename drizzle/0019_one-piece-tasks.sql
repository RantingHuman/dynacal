-- A Task is now scheduled in one piece unless the owner makes it a Splittable Task; every existing Task becomes one piece.
ALTER TABLE `tasks` RENAME COLUMN `dont_split` TO `splittable`;--> statement-breakpoint
UPDATE `tasks` SET `splittable` = 0;
