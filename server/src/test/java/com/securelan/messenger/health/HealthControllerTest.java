package com.securelan.messenger.health;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class HealthControllerTest {

    @Test
    void reportsServiceAsUp() {
        var response = new HealthController().health();
        assertThat(response.status()).isEqualTo("UP");
        assertThat(response.service()).isEqualTo("securelan-server");
    }
}
