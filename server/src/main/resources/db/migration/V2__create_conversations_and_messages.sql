CREATE TABLE conversations (
    id UUID PRIMARY KEY,
    type VARCHAR(20) NOT NULL CHECK (type = 'DIRECT'),
    user_low_id UUID NOT NULL REFERENCES users(id),
    user_high_id UUID NOT NULL REFERENCES users(id),
    next_sequence BIGINT NOT NULL DEFAULT 1 CHECK (next_sequence >= 1),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT conversations_distinct_users CHECK (user_low_id <> user_high_id),
    CONSTRAINT conversations_canonical_pair CHECK (user_low_id::text < user_high_id::text),
    CONSTRAINT conversations_unique_pair UNIQUE (user_low_id, user_high_id)
);

CREATE TABLE conversation_participants (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    joined_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id),
    client_request_id UUID NOT NULL,
    server_sequence BIGINT NOT NULL CHECK (server_sequence > 0),
    payload_type VARCHAR(20) NOT NULL CHECK (payload_type = 'TEXT'),
    payload TEXT NOT NULL CHECK (length(btrim(payload)) > 0 AND length(payload) <= 4000),
    payload_fingerprint VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT messages_sequence_unique UNIQUE (conversation_id, server_sequence),
    CONSTRAINT messages_sender_request_unique UNIQUE (sender_id, client_request_id),
    CONSTRAINT messages_sender_is_participant FOREIGN KEY (conversation_id, sender_id)
        REFERENCES conversation_participants(conversation_id, user_id)
);

CREATE INDEX conversation_participants_user_idx ON conversation_participants(user_id, conversation_id);
CREATE INDEX conversations_recent_idx ON conversations(updated_at DESC, id);
CREATE INDEX messages_history_idx ON messages(conversation_id, server_sequence DESC);
