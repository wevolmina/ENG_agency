-- Run only in a newly created, empty Paybridge database.
-- This file never drops, truncates, or copies an existing database.
CREATE TABLE schema_versions (
 version VARCHAR(40) PRIMARY KEY,
 applied_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE TABLE spaces (
 space_id VARCHAR(40) PRIMARY KEY,
 name VARCHAR(100) NOT NULL,
 description VARCHAR(500) NOT NULL
);

CREATE TABLE packages (
 product_id VARCHAR(40) PRIMARY KEY,
 space_id VARCHAR(40) NOT NULL,
 merchant_id VARCHAR(64) NOT NULL,
 name VARCHAR(200) NOT NULL,
 description VARCHAR(500) NOT NULL,
 unit_price INT NOT NULL,
 currency CHAR(3) NOT NULL DEFAULT 'KRW',
 active BOOLEAN NOT NULL DEFAULT TRUE,
 version INT NOT NULL DEFAULT 1,
 CONSTRAINT package_space FOREIGN KEY (space_id) REFERENCES spaces(space_id),
 CHECK (unit_price > 0), CHECK (currency = 'KRW')
);

CREATE TABLE staff_memberships (
 user_uid VARCHAR(128) NOT NULL,
 merchant_id VARCHAR(64) NOT NULL,
 role VARCHAR(20) CHECK (role IN ('merchant','admin')) NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 PRIMARY KEY (user_uid, role)
);

CREATE TABLE orders (
 order_id VARCHAR(50) PRIMARY KEY,
 customer_id VARCHAR(128) NOT NULL,
 request_id CHAR(36) NOT NULL,
 request_hash CHAR(64) NOT NULL,
 merchant_id VARCHAR(64) NOT NULL,
 amount DECIMAL(12,2) NOT NULL,
 currency CHAR(3) NOT NULL,
 status VARCHAR(20) NOT NULL,
 created_at TIMESTAMP(3) NOT NULL,
 UNIQUE (customer_id,request_id),
 CHECK (amount > 0), CHECK (status = 'MOCK_APPROVED')
);

CREATE TABLE order_items (
 order_id VARCHAR(50) NOT NULL,
 line_number INT NOT NULL,
 product_id VARCHAR(40) NOT NULL,
 product_name VARCHAR(200) NOT NULL,
 unit_price DECIMAL(12,2) NOT NULL,
 quantity INT NOT NULL,
 PRIMARY KEY (order_id,line_number),
 CONSTRAINT item_order FOREIGN KEY (order_id) REFERENCES orders(order_id),
 CONSTRAINT item_package FOREIGN KEY (product_id) REFERENCES packages(product_id),
 CHECK (quantity BETWEEN 1 AND 10), CHECK (unit_price > 0)
);

CREATE TABLE payments (
 payment_id VARCHAR(50) PRIMARY KEY,
 order_id VARCHAR(50) NOT NULL,
 customer_id VARCHAR(128) NOT NULL,
 merchant_id VARCHAR(64) NOT NULL,
 product_id VARCHAR(40) NOT NULL,
 product_name VARCHAR(200) NOT NULL,
 quantity INT NOT NULL,
 amount DECIMAL(12,2) NOT NULL,
 currency CHAR(3) NOT NULL,
 status VARCHAR(20) NOT NULL,
 created_at TIMESTAMP(3) NOT NULL,
 synced_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 payload_hash CHAR(64) NOT NULL,
 UNIQUE (order_id),
 CONSTRAINT payment_order_ref FOREIGN KEY (order_id) REFERENCES orders(order_id),
 CHECK (quantity BETWEEN 1 AND 10), CHECK (amount > 0),
 CHECK (status = 'MOCK_APPROVED')
);

CREATE TABLE admin_audit_logs (
 id BIGSERIAL PRIMARY KEY,
 actor_uid VARCHAR(128) NOT NULL,
 product_id VARCHAR(40) NOT NULL,
 old_active BOOLEAN NOT NULL,
 new_active BOOLEAN NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

INSERT INTO spaces (space_id,name,description)
 VALUES ('bedroom','침실','하루의 끝, 나를 위한 편안한 공간');
INSERT INTO packages (product_id,space_id,merchant_id,name,description,unit_price)
 VALUES ('bedroom-lighting','bedroom','studio-mina','편안한 밤 조명 패키지','협탁 조명과 헤드보드 간접 조명으로 완성하는 따뜻한 침실',99000);
INSERT INTO schema_versions (version) VALUES ('smartspace-v2');

-- Additive migration in the existing smartspace database. No resets or drops.
-- The migration runner verifies existing rows rather than overwriting them.
INSERT INTO spaces (space_id,name,description)
 VALUES ('kitchen','주방','사람과 문 열림을 가상으로 체험하는 주방');
INSERT INTO packages (product_id,space_id,merchant_id,name,description,unit_price)
 VALUES ('kitchen-sensing','kitchen','studio-mina','주방 센서 조명 패키지','가상 재실 센서와 문 열림 센서, 작업대 조명 체험',99000);
INSERT INTO schema_versions (version) VALUES ('kitchen-sensing-v1');

-- Additive only. No existing records or tables are removed.
INSERT INTO spaces (space_id,name,description)
 VALUES ('desk','데스크테리어','집중을 위한 나만의 책상 공간');
INSERT INTO packages (product_id,space_id,merchant_id,name,description,unit_price)
 VALUES ('desk-focus','desk','studio-mina','데스크테리어 집중 패키지','책상 조명과 화면 안의 가상 집중 모드',79000);
INSERT INTO schema_versions (version) VALUES ('desk-focus-v1');

CREATE TABLE IF NOT EXISTS staff_access_requests (
  request_id CHAR(36) PRIMARY KEY,
  user_uid VARCHAR(128) NOT NULL,
  merchant_id VARCHAR(64) NOT NULL,
  role VARCHAR(20) CHECK (role IN ('merchant','admin')) NOT NULL,
  email VARCHAR(320) NULL, display_name VARCHAR(200) NULL,
  status VARCHAR(20) CHECK (status IN ('pending','approved','rejected')) NOT NULL DEFAULT 'pending',
  reason VARCHAR(300) NOT NULL DEFAULT '',
  reviewed_by VARCHAR(128) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), reviewed_at TIMESTAMP(3) NULL,
  UNIQUE (user_uid,merchant_id,role)
);

CREATE TABLE IF NOT EXISTS staff_access_request_reviews (
  id BIGSERIAL PRIMARY KEY,
  request_id CHAR(36) NOT NULL,
  user_uid VARCHAR(128) NOT NULL,
  actor_uid VARCHAR(128) NOT NULL,
  merchant_id VARCHAR(64) NOT NULL,
  role VARCHAR(20) CHECK (role IN ('merchant','admin')) NOT NULL, decision VARCHAR(20) CHECK (decision IN ('approved','rejected')) NOT NULL,
  reason VARCHAR(300) NOT NULL DEFAULT '',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE INDEX orders_merchant_created ON orders(merchant_id,created_at);
CREATE INDEX payments_merchant_created ON payments(merchant_id,created_at);
CREATE INDEX request_queue ON staff_access_requests(merchant_id,status,created_at);
CREATE INDEX request_review_history ON staff_access_request_reviews(merchant_id,id);
