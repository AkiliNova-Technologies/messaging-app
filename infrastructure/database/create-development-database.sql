-- Run as a PostgreSQL administrator after creating the login role documented in README.
CREATE DATABASE securelan_dev OWNER securelan;
REVOKE ALL ON DATABASE securelan_dev FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE securelan_dev TO securelan;
