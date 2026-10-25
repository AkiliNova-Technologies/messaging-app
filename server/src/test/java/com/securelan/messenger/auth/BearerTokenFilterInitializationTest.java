package com.securelan.messenger.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.securelan.messenger.config.SecurityConfig;
import com.securelan.messenger.health.HealthController;
import org.junit.jupiter.api.Test;
import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(HealthController.class)
@Import({SecurityConfig.class, BearerTokenFilter.class})
class BearerTokenFilterInitializationTest {
    @Autowired MockMvc mvc;
    @Autowired BearerTokenFilter filter;
    @Autowired FilterRegistrationBean<BearerTokenFilter> registration;
    @MockitoBean SessionAuthenticationService authenticationService;

    @Test
    void filterInitializesWithoutAopProxyOrDuplicateServletRegistration() {
        assertThat(AopUtils.isAopProxy(filter)).isFalse();
        assertThat(registration.isEnabled()).isFalse();
        assertThat(registration.getFilter()).isSameAs(filter);
    }

    @Test
    void healthRemainsPublicAndProtectedEndpointRequiresAuthentication() throws Exception {
        mvc.perform(get("/api/v1/health")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/auth/me")).andExpect(status().isForbidden());
    }
}
