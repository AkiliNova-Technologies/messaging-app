SELECT installed_rank, version, description, success
FROM flyway_schema_history
ORDER BY installed_rank;

SELECT 'users' AS relation, count(*) AS rows FROM users
UNION ALL SELECT 'user_sessions', count(*) FROM user_sessions
UNION ALL SELECT 'conversations', count(*) FROM conversations
UNION ALL SELECT 'conversation_participants', count(*) FROM conversation_participants
UNION ALL SELECT 'messages', count(*) FROM messages
ORDER BY relation;
