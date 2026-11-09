-- Attachment data is persisted in PostgreSQL to survive container restarts.
-- Restore/back up the database and its attachment data as one unit.
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_payload_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_payload_type_check CHECK (payload_type IN ('TEXT','ATTACHMENT'));

CREATE TABLE message_attachments (
    id UUID PRIMARY KEY,
    message_id UUID NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
    file_name VARCHAR(180) NOT NULL,
    content_type VARCHAR(160) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 8388608),
    content BYTEA NOT NULL
);
CREATE INDEX message_attachments_message_idx ON message_attachments(message_id);
