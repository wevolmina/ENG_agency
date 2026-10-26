CREATE TABLE IF NOT EXISTS staff_access_requests (
  request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  user_uid VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  merchant_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  role ENUM('merchant','admin') NOT NULL,
  email VARCHAR(320) NULL, display_name VARCHAR(200) NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reason VARCHAR(300) NOT NULL DEFAULT '',
  reviewed_by VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), reviewed_at TIMESTAMP(3) NULL,
  UNIQUE KEY request_account_role (user_uid,merchant_id,role),
  KEY request_queue (merchant_id,status,created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS staff_access_request_reviews (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_uid VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  actor_uid VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  merchant_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  role ENUM('merchant','admin') NOT NULL, decision ENUM('approved','rejected') NOT NULL,
  reason VARCHAR(300) NOT NULL DEFAULT '',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY request_review_history (merchant_id,id)
) ENGINE=InnoDB;
