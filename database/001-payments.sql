CREATE TABLE IF NOT EXISTS payments (
  payment_id VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  customer_id VARCHAR(128) NOT NULL,
  merchant_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  product_id VARCHAR(40) NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  quantity INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency CHAR(3) NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  synced_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  INDEX merchant_created (merchant_id, created_at),
  CHECK (quantity BETWEEN 1 AND 10),
  CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
