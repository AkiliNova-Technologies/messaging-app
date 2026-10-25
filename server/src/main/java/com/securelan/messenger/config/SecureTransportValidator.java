package com.securelan.messenger.config;

import java.net.InetAddress;
import java.net.UnknownHostException;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class SecureTransportValidator implements InitializingBean {
    private final String bindAddress;
    private final boolean tlsEnabled;

    public SecureTransportValidator(@Value("${server.address:127.0.0.1}") String bindAddress,
            @Value("${server.ssl.enabled:false}") boolean tlsEnabled) {
        this.bindAddress = bindAddress;
        this.tlsEnabled = tlsEnabled;
    }

    @Override
    public void afterPropertiesSet() {
        if (!tlsEnabled && !isLoopback(bindAddress)) {
            throw new IllegalStateException(
                    "Refusing insecure server binding: TLS must be enabled when server.address is not loopback");
        }
    }

    static boolean isLoopback(String address) {
        if (address == null || address.isBlank() || "0.0.0.0".equals(address) || "::".equals(address)) return false;
        try {
            return InetAddress.getByName(address).isLoopbackAddress();
        } catch (UnknownHostException exception) {
            return false;
        }
    }
}
