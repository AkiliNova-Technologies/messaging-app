# syntax=docker/dockerfile:1.7
FROM ubuntu:24.04 AS build
RUN apt-get update && \
    apt-get install --no-install-recommends -y ca-certificates openjdk-21-jdk-headless && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN --mount=type=cache,target=/root/.m2 \
    ./mvnw -q -DskipTests dependency:go-offline
COPY src/ src/
RUN --mount=type=cache,target=/root/.m2 \
    ./mvnw -q -DskipTests package && \
    cp target/messenger-*.jar /workspace/securelan-server.jar

FROM ubuntu:24.04 AS runtime
RUN apt-get update && \
    apt-get install --no-install-recommends -y ca-certificates curl openjdk-21-jre-headless && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd --system --gid 10001 securelan && \
    useradd --system --uid 10001 --gid securelan --home-dir /app --shell /usr/sbin/nologin securelan
WORKDIR /app
COPY --from=build --chown=securelan:securelan /workspace/securelan-server.jar ./securelan-server.jar
USER 10001:10001
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=25.0 -XX:+ExitOnOutOfMemoryError" \
    SERVER_PORT=8080 \
    SERVER_SSL_ENABLED=true \
    SERVER_SSL_KEY_STORE=/run/secrets/server.p12 \
    HEALTHCHECK_HOST=securelan.example.invalid
HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=5 \
  CMD curl --fail --silent --show-error --cacert /run/secrets/ca.crt.pem \
      --resolve "${HEALTHCHECK_HOST}:8080:127.0.0.1" \
      "https://${HEALTHCHECK_HOST}:8080/actuator/health/readiness" >/dev/null || exit 1
ENTRYPOINT ["java", "-jar", "/app/securelan-server.jar"]
