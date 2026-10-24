-- Additive migration in the existing smartspace database. No resets or drops.
-- The migration runner verifies existing rows rather than overwriting them.
INSERT INTO spaces (space_id,name,description)
 VALUES ('kitchen','주방','사람과 문 열림을 가상으로 체험하는 주방');
INSERT INTO packages (product_id,space_id,merchant_id,name,description,unit_price)
 VALUES ('kitchen-sensing','kitchen','studio-mina','주방 센서 조명 패키지','가상 재실 센서와 문 열림 센서, 작업대 조명 체험',99000);
INSERT INTO schema_versions (version) VALUES ('kitchen-sensing-v1');
