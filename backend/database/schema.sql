-- Fresh-install schema for Design and Development of a Centralized Web-Based
-- University Lost-and-Found Management Platform.
-- Existing databases are not modified by CREATE ... IF NOT EXISTS. Do not drop
-- or recreate an existing database. Review actual DDL before using on an existing DB.

CREATE DATABASE IF NOT EXISTS university_lost_found
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE university_lost_found;

CREATE TABLE IF NOT EXISTS users (
  user_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student', 'staff', 'admin') NOT NULL DEFAULT 'student',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  category_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_name VARCHAR(80) NOT NULL,
  description VARCHAR(300) NULL,
  PRIMARY KEY (category_id),
  UNIQUE KEY uq_categories_name (category_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS items (
  item_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  item_type ENUM('lost', 'found') NOT NULL,
  item_name VARCHAR(80) NOT NULL,
  description VARCHAR(500) NOT NULL,
  location VARCHAR(120) NOT NULL,
  item_date DATE NOT NULL,
  colour VARCHAR(80) NULL,
  image_path VARCHAR(512) NULL,
  status ENUM('Pending review', 'Approved', 'Rejected', 'Recovered') NOT NULL DEFAULT 'Pending review',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (item_id),
  KEY idx_items_owner_created (user_id, created_at),
  KEY idx_items_status_created (status, created_at),
  KEY idx_items_type_date (item_type, item_date),
  KEY idx_items_category_date (category_id, item_date),
  CONSTRAINT fk_items_user FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_items_category FOREIGN KEY (category_id) REFERENCES categories (category_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS claims (
  claim_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id INT UNSIGNED NOT NULL,
  claimant_id INT UNSIGNED NOT NULL,
  claim_description VARCHAR(500) NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (claim_id),
  UNIQUE KEY uq_claims_item_claimant (item_id, claimant_id),
  KEY idx_claims_claimant_created (claimant_id, created_at),
  KEY idx_claims_status_created (status, created_at),
  CONSTRAINT fk_claims_item FOREIGN KEY (item_id) REFERENCES items (item_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_claims_user FOREIGN KEY (claimant_id) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed categories only in a new or deliberately empty project database.
-- These statements are idempotent and do not seed users, reports or claims.
INSERT INTO categories (category_name, description)
SELECT 'Bags & backpacks', 'Bags, backpacks and cases'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE category_name = 'Bags & backpacks');
INSERT INTO categories (category_name, description)
SELECT 'Electronics', 'Phones, laptops and accessories'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE category_name = 'Electronics');
INSERT INTO categories (category_name, description)
SELECT 'Books & stationery', 'Books, notebooks and stationery'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE category_name = 'Books & stationery');
INSERT INTO categories (category_name, description)
SELECT 'Keys & cards', 'Keys, ID cards and access cards'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE category_name = 'Keys & cards');
INSERT INTO categories (category_name, description)
SELECT 'Drinkware', 'Bottles, cups and drink containers'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE category_name = 'Drinkware');
INSERT INTO categories (category_name, description)
SELECT 'Other', 'Items not covered by another category'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE category_name = 'Other');
