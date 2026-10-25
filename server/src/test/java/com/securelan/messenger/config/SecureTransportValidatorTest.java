package com.securelan.messenger.config;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

class SecureTransportValidatorTest {
    @Test void permitsPlaintextOnlyOnLoopback() {
        assertDoesNotThrow(() -> new SecureTransportValidator("127.0.0.1", false).afterPropertiesSet());
        assertDoesNotThrow(() -> new SecureTransportValidator("::1", false).afterPropertiesSet());
        assertDoesNotThrow(() -> new SecureTransportValidator("localhost", false).afterPropertiesSet());
    }
    @Test void rejectsPlaintextLanAndWildcardBindings() {
        assertThrows(IllegalStateException.class, () -> new SecureTransportValidator("192.168.1.100", false).afterPropertiesSet());
        assertThrows(IllegalStateException.class, () -> new SecureTransportValidator("0.0.0.0", false).afterPropertiesSet());
    }
    @Test void permitsLanBindingWithTls() {
        assertDoesNotThrow(() -> new SecureTransportValidator("0.0.0.0", true).afterPropertiesSet());
        assertDoesNotThrow(() -> new SecureTransportValidator("securelan.local", true).afterPropertiesSet());
    }
}
