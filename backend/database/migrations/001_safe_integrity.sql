-- Safe integrity migration for an EXISTING findora schema.
-- Back up the database first, run the read-only checks below, and inspect actual
-- SHOW CREATE TABLE output. This file has no DROP, TRUNCATE or DELETE statement.
-- If duplicates/orphans exist or column types are incompatible, ALTER fails; it
-- does not remove or rewrite rows. Review and resolve issues manually before retrying.
-- Do not run this file against an unverified/shared database during testing.

SELECT DATABASE() AS current_database;

-- Read-only preflight: these queries should return no rows before constraints are added.
SELECT LOWER(email) AS normalized_email, COUNT(*) AS duplicate_count
FROM users GROUP BY LOWER(email) HAVING COUNT(*) > 1;

SELECT item_id, claimant_id, COUNT(*) AS duplicate_count
FROM claims GROUP BY item_id, claimant_id HAVING COUNT(*) > 1;

SELECT i.item_id, i.user_id
FROM items i LEFT JOIN users u ON u.user_id = i.user_id
WHERE u.user_id IS NULL;

SELECT i.item_id, i.category_id
FROM items i LEFT JOIN categories c ON c.category_id = i.category_id
WHERE c.category_id IS NULL;

SELECT cl.claim_id, cl.item_id
FROM claims cl LEFT JOIN items i ON i.item_id = cl.item_id
WHERE i.item_id IS NULL;

SELECT cl.claim_id, cl.claimant_id
FROM claims cl LEFT JOIN users u ON u.user_id = cl.claimant_id
WHERE u.user_id IS NULL;

-- Stop and review if the selected database name is not findora.
-- The following conditional DDL checks for equivalent indexes/relationships by
-- columns, so rerunning this file after success does not add duplicates.
SET @luf_db := DATABASE();
SET @luf_has := (SELECT COUNT(*) FROM (
  SELECT index_name FROM information_schema.statistics
  WHERE table_schema = @luf_db AND table_name = 'users' AND non_unique = 0
  GROUP BY index_name HAVING COUNT(*) = 1 AND SUM(column_name = 'email') = 1
) AS matches);
SET @luf_sql := IF(@luf_db = 'findora' AND @luf_has = 0,
  'ALTER TABLE `users` ADD UNIQUE KEY `uq_users_email` (`email`)', 'SELECT 1');
PREPARE luf_stmt FROM @luf_sql; EXECUTE luf_stmt; DEALLOCATE PREPARE luf_stmt;

SET @luf_has := (SELECT COUNT(*) FROM (
  SELECT index_name FROM information_schema.statistics
  WHERE table_schema = @luf_db AND table_name = 'categories' AND non_unique = 0
  GROUP BY index_name HAVING COUNT(*) = 1 AND SUM(column_name = 'category_name') = 1
) AS matches);
SET @luf_sql := IF(@luf_db = 'findora' AND @luf_has = 0,
  'ALTER TABLE `categories` ADD UNIQUE KEY `uq_categories_name` (`category_name`)', 'SELECT 1');
PREPARE luf_stmt FROM @luf_sql; EXECUTE luf_stmt; DEALLOCATE PREPARE luf_stmt;

SET @luf_has := (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = @luf_db AND table_name = 'claims' AND non_unique = 0
  GROUP BY index_name HAVING COUNT(*) = 2
    AND SUM(column_name = 'item_id') = 1 AND SUM(column_name = 'claimant_id') = 1);
SET @luf_sql := IF(@luf_db = 'findora' AND COALESCE(@luf_has, 0) = 0,
  'ALTER TABLE `claims` ADD UNIQUE KEY `uq_claims_item_claimant` (`item_id`, `claimant_id`)', 'SELECT 1');
PREPARE luf_stmt FROM @luf_sql; EXECUTE luf_stmt; DEALLOCATE PREPARE luf_stmt;

SET @luf_has := (SELECT COUNT(*) FROM information_schema.key_column_usage
  WHERE constraint_schema = @luf_db AND table_name = 'items' AND column_name = 'user_id'
    AND referenced_table_name = 'users' AND referenced_column_name = 'user_id');
SET @luf_sql := IF(@luf_db = 'findora' AND @luf_has = 0,
  'ALTER TABLE `items` ADD CONSTRAINT `fk_items_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE RESTRICT', 'SELECT 1');
PREPARE luf_stmt FROM @luf_sql; EXECUTE luf_stmt; DEALLOCATE PREPARE luf_stmt;

SET @luf_has := (SELECT COUNT(*) FROM information_schema.key_column_usage
  WHERE constraint_schema = @luf_db AND table_name = 'items' AND column_name = 'category_id'
    AND referenced_table_name = 'categories' AND referenced_column_name = 'category_id');
SET @luf_sql := IF(@luf_db = 'findora' AND @luf_has = 0,
  'ALTER TABLE `items` ADD CONSTRAINT `fk_items_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`) ON UPDATE CASCADE ON DELETE RESTRICT', 'SELECT 1');
PREPARE luf_stmt FROM @luf_sql; EXECUTE luf_stmt; DEALLOCATE PREPARE luf_stmt;

SET @luf_has := (SELECT COUNT(*) FROM information_schema.key_column_usage
  WHERE constraint_schema = @luf_db AND table_name = 'claims' AND column_name = 'item_id'
    AND referenced_table_name = 'items' AND referenced_column_name = 'item_id');
SET @luf_sql := IF(@luf_db = 'findora' AND @luf_has = 0,
  'ALTER TABLE `claims` ADD CONSTRAINT `fk_claims_item` FOREIGN KEY (`item_id`) REFERENCES `items` (`item_id`) ON UPDATE CASCADE ON DELETE RESTRICT', 'SELECT 1');
PREPARE luf_stmt FROM @luf_sql; EXECUTE luf_stmt; DEALLOCATE PREPARE luf_stmt;

SET @luf_has := (SELECT COUNT(*) FROM information_schema.key_column_usage
  WHERE constraint_schema = @luf_db AND table_name = 'claims' AND column_name = 'claimant_id'
    AND referenced_table_name = 'users' AND referenced_column_name = 'user_id');
SET @luf_sql := IF(@luf_db = 'findora' AND @luf_has = 0,
  'ALTER TABLE `claims` ADD CONSTRAINT `fk_claims_user` FOREIGN KEY (`claimant_id`) REFERENCES `users` (`user_id`) ON UPDATE CASCADE ON DELETE RESTRICT', 'SELECT 1');
PREPARE luf_stmt FROM @luf_sql; EXECUTE luf_stmt; DEALLOCATE PREPARE luf_stmt;

SELECT 'Integrity migration finished; verify SHOW CREATE TABLE and preserved row counts.' AS result;
