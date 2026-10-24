-- Additive only. No existing records or tables are removed.
INSERT INTO spaces (space_id,name,description)
 VALUES ('desk','데스크테리어','집중을 위한 나만의 책상 공간');
INSERT INTO packages (product_id,space_id,merchant_id,name,description,unit_price)
 VALUES ('desk-focus','desk','studio-mina','데스크테리어 집중 패키지','책상 조명과 화면 안의 가상 집중 모드',79000);
INSERT INTO schema_versions (version) VALUES ('desk-focus-v1');
