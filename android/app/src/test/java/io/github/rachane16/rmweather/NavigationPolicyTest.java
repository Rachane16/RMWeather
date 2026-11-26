package io.github.rachane16.rmweather;

import org.junit.Test;
import static org.junit.Assert.*;

public class NavigationPolicyTest {
    @Test public void onlyOwnedHttpsPagesStayInApp() {
        assertTrue(NavigationPolicy.isAppPage(NavigationPolicy.HOME));
        assertTrue(NavigationPolicy.isAppPage("https://rachane16.github.io/RMWeather/index.html?v=1#map"));
        assertFalse(NavigationPolicy.isAppPage("https://rachane16.github.io/RMWeather/%2e%2e/another/"));
        for (String value : new String[]{null,"http://rachane16.github.io/RMWeather/","https://rachane16.github.io.evil.test/RMWeather/","https://rachane16.github.io/another/","https://user@rachane16.github.io/RMWeather/","https://rachane16.github.io:444/RMWeather/","file:///sdcard/a.html","javascript:alert(1)","intent://anything"})
            assertFalse(value, NavigationPolicy.isAppPage(value));
    }
    @Test public void locationIsNotGrantedToIframeOrExternalOrigins() {
        assertTrue(NavigationPolicy.isLocationOrigin("https://rachane16.github.io/"));
        assertFalse(NavigationPolicy.isLocationOrigin("https://embed.windy.com/"));
        assertFalse(NavigationPolicy.isLocationOrigin("https://rachane16.github.io.evil.test/"));
        assertFalse(NavigationPolicy.isLocationOrigin("http://rachane16.github.io/"));
    }
    @Test public void browserLinksDoNotAcceptIntentOrLocalFileSchemes() {
        assertTrue(NavigationPolicy.isExternalWebPage("https://www.windy.com/"));
        assertFalse(NavigationPolicy.isExternalWebPage("intent://windy"));
        assertFalse(NavigationPolicy.isExternalWebPage("file:///sdcard/key"));
        assertFalse(NavigationPolicy.isExternalWebPage("javascript:alert(1)"));
    }
}
