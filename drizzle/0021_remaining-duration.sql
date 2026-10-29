-- A Task's Remaining Duration is now its stored duration, not its estimate minus the time its past Blocks count as
-- worked (ADR 0006). An open Task the review answered for keeps the time that left it ("done" counts the Block in
-- full, "partial" its minutes worked), plus the time of any past Block still waiting for a Check-in, which now counts
-- against the duration instead. A Task the review used up has its latest Block waiting again (the last migration),
-- so it needs no less than that Block: it holds and asks "Finished?". Its reviewed Blocks then count as answered More
-- time. Completed Tasks, and Tasks the review never answered for, stay as they were.
UPDATE `tasks` SET `estimated_minutes` = MAX(
  15,
  `estimated_minutes` - (
    SELECT SUM(CASE `b`.`review` WHEN 'partial' THEN COALESCE(`b`.`worked_minutes`, 0)
                                 ELSE (`b`.`end` - `b`.`start`) / 60000 END)
    FROM `blocks` AS `b`
    WHERE `b`.`task_id` = `tasks`.`id` AND `b`.`review` IN ('done', 'partial')
      AND `b`.`end` <= CAST(strftime('%s', 'now') AS INTEGER) * 1000
  ),
  (
    SELECT COALESCE(SUM((`w`.`end` - `w`.`start`) / 60000), 0)
    FROM `blocks` AS `w`
    WHERE `w`.`task_id` = `tasks`.`id` AND `w`.`review` IS NULL
      AND `w`.`end` <= CAST(strftime('%s', 'now') AS INTEGER) * 1000
  )
)
WHERE `completed_at` IS NULL
  AND EXISTS (
    SELECT 1 FROM `blocks` AS `r`
    WHERE `r`.`task_id` = `tasks`.`id` AND `r`.`review` IN ('done', 'partial')
      AND `r`.`end` <= CAST(strftime('%s', 'now') AS INTEGER) * 1000
  );
--> statement-breakpoint
UPDATE `blocks` SET `review` = 'more-time'
WHERE `review` IN ('done', 'partial')
  AND `end` <= CAST(strftime('%s', 'now') AS INTEGER) * 1000
  AND `task_id` IN (SELECT `id` FROM `tasks` WHERE `completed_at` IS NULL);
