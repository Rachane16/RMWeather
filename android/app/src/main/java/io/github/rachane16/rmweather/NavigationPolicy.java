package io.github.rachane16.rmweather;

import java.net.URI;
import java.net.URISyntaxException;

/** Keep app navigation and location grants confined to the owned HTTPS site. */
final class NavigationPolicy {
    static final String HOME = "https://rachane16.github.io/RMWeather/?app=android";
    static boolean isAppPage(String value) {
        try {
            URI uri = new URI(value);
            String path = uri.getPath();
            if (path != null) path = new URI(null, null, path, null).normalize().getPath();
            return "https".equalsIgnoreCase(uri.getScheme()) && "rachane16.github.io".equalsIgnoreCase(uri.getHost())
                && uri.getUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443)
                && path != null && path.startsWith("/RMWeather/");
        } catch (URISyntaxException | NullPointerException e) { return false; }
    }
    static boolean isLocationOrigin(String value) {
        try {
            URI uri = new URI(value);
            return "https".equalsIgnoreCase(uri.getScheme()) && "rachane16.github.io".equalsIgnoreCase(uri.getHost())
                && uri.getUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443)
                && (uri.getPath().isEmpty() || uri.getPath().equals("/"));
        } catch (URISyntaxException | NullPointerException e) { return false; }
    }
    static boolean isExternalWebPage(String value) {
        try {
            URI uri = new URI(value);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && uri.getUserInfo() == null;
        } catch (URISyntaxException | NullPointerException e) { return false; }
    }
}
