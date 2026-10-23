CREATE TABLE IF NOT EXISTS orders (
 order_id VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 customer_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
 request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 merchant_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 amount DECIMAL(12,2) NOT NULL, currency CHAR(3) NOT NULL,
 status VARCHAR(20) NOT NULL, created_at DATETIME(3) NOT NULL,
 UNIQUE KEY customer_request (customer_id,request_id),
 INDEX merchant_created (merchant_id,created_at), CHECK (amount>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS order_items (
 order_id VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 line_number INT NOT NULL, product_id VARCHAR(40) NOT NULL,
 product_name VARCHAR(200) NOT NULL, unit_price DECIMAL(12,2) NOT NULL,
 quantity INT NOT NULL, PRIMARY KEY (order_id,line_number),
 CONSTRAINT order_items_order FOREIGN KEY (order_id) REFERENCES orders(order_id),
 CHECK (quantity BETWEEN 1 AND 10), CHECK (unit_price>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
