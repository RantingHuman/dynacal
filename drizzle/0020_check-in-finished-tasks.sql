-- A past Block now waits for a Check-in ("Finished?") until it's answered. An open Task whose Remaining Duration
-- the review used up (worked out as it was: "done" counts the Block in full, "partial" its minutes worked) asks
-- about its latest reviewed past Block again, so the owner can finish it properly. A Task already waiting for a
-- Check-in already asks.
UPDATE `blocks` SET `review` = NULL WHERE `id` IN (
  SELECT (
    SELECT `latest`.`id` FROM `blocks` AS `latest`
    WHERE `latest`.`task_id` = `t`.`id` AND `latest`.`end` <= CAST(strftime('%s', 'now') AS INTEGER) * 1000
      AND `latest`.`review` IS NOT NULL
    ORDER BY `latest`.`end` DESC, `latest`.`start` DESC
    LIMIT 1
  )
  FROM `tasks` AS `t`
  WHERE `t`.`completed_at` IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM `blocks` AS `w`
      WHERE `w`.`task_id` = `t`.`id` AND `w`.`end` <= CAST(strftime('%s', 'now') AS INTEGER) * 1000
        AND `w`.`review` IS NULL
    )
    AND `t`.`estimated_minutes` <= (
      SELECT COALESCE(SUM(CASE `b`.`review` WHEN 'partial' THEN COALESCE(`b`.`worked_minutes`, 0)
                                            ELSE (`b`.`end` - `b`.`start`) / 60000.0 END), 0)
      FROM `blocks` AS `b`
      WHERE `b`.`task_id` = `t`.`id` AND `b`.`end` <= CAST(strftime('%s', 'now') AS INTEGER) * 1000
    )
);
