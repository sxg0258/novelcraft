-- 初始数据库结构（由 Prisma migrate 自动管理）
-- 这里仅作占位，真实创建表结构由 Prisma 处理

-- 全文检索索引（Prisma migrate 不会自动创建 GIN 索引，需手动）
-- 在 Prisma migration 文件里加这段：
-- CREATE INDEX chapters_content_text_fts_idx ON chapters
--   USING GIN (to_tsvector('simple', content_text));
