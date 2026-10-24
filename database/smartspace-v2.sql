-- Run only in a newly created, empty Paybridge database.
-- This file never drops, truncates, or copies an existing database.
CREATE TABLE schema_versions (
 version VARCHAR(40) PRIMARY KEY,
 applied_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE spaces (
 space_id VARCHAR(40) PRIMARY KEY,
 name VARCHAR(100) NOT NULL,
 description VARCHAR(500) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE packages (
 product_id VARCHAR(40) PRIMARY KEY,
 space_id VARCHAR(40) NOT NULL,
 merchant_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 name VARCHAR(200) NOT NULL,
 description VARCHAR(500) NOT NULL,
 unit_price INT NOT NULL,
 currency CHAR(3) NOT NULL DEFAULT 'KRW',
 active BOOLEAN NOT NULL DEFAULT TRUE,
 version INT NOT NULL DEFAULT 1,
 CONSTRAINT package_space FOREIGN KEY (space_id) REFERENCES spaces(space_id),
 CHECK (unit_price > 0), CHECK (currency = 'KRW')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE staff_memberships (
 user_uid VARCHAR(128) NOT NULL,
 merchant_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 role ENUM('merchant','admin') NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 PRIMARY KEY (user_uid, role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE orders (
 order_id VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 customer_id VARCHAR(128) NOT NULL,
 request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 merchant_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 amount DECIMAL(12,2) NOT NULL,
 currency CHAR(3) NOT NULL,
 status VARCHAR(20) NOT NULL,
 created_at DATETIME(3) NOT NULL,
 UNIQUE KEY customer_request (customer_id,request_id),
 INDEX merchant_created (merchant_id,created_at),
 CHECK (amount > 0), CHECK (status = 'MOCK_APPROVED')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE order_items (
 order_id VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 line_number INT NOT NULL,
 product_id VARCHAR(40) NOT NULL,
 product_name VARCHAR(200) NOT NULL,
 unit_price DECIMAL(12,2) NOT NULL,
 quantity INT NOT NULL,
 PRIMARY KEY (order_id,line_number),
 CONSTRAINT item_order FOREIGN KEY (order_id) REFERENCES orders(order_id),
 CONSTRAINT item_package FOREIGN KEY (product_id) REFERENCES packages(product_id),
 CHECK (quantity BETWEEN 1 AND 10), CHECK (unit_price > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE payments (
 payment_id VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 order_id VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
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
 UNIQUE KEY payment_order (order_id),
 CONSTRAINT payment_order_ref FOREIGN KEY (order_id) REFERENCES orders(order_id),
 INDEX merchant_created (merchant_id,created_at),
 CHECK (quantity BETWEEN 1 AND 10), CHECK (amount > 0),
 CHECK (status = 'MOCK_APPROVED')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE admin_audit_logs (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 actor_uid VARCHAR(128) NOT NULL,
 product_id VARCHAR(40) NOT NULL,
 old_active BOOLEAN NOT NULL,
 new_active BOOLEAN NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

INSERT INTO spaces (space_id,name,description)
 VALUES ('bedroom','침실','하루의 끝, 나를 위한 편안한 공간');
INSERT INTO packages (product_id,space_id,merchant_id,name,description,unit_price)
 VALUES ('bedroom-lighting','bedroom','studio-mina','편안한 밤 조명 패키지','협탁 조명과 헤드보드 간접 조명으로 완성하는 따뜻한 침실',99000);
INSERT INTO schema_versions (version) VALUES ('smartspace-v2');
