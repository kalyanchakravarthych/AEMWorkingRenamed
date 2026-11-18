package com.spend.sc.core.models;

import java.util.Collections;
import java.util.List;

import org.apache.commons.lang3.StringUtils;
import org.apache.sling.api.resource.Resource;
import org.apache.sling.models.annotations.DefaultInjectionStrategy;
import org.apache.sling.models.annotations.Model;
import org.apache.sling.models.annotations.injectorspecific.ChildResource;
import org.apache.sling.models.annotations.injectorspecific.ValueMapValue;

@Model(
    adaptables = Resource.class,
    defaultInjectionStrategy = DefaultInjectionStrategy.OPTIONAL
)
public class HeaderModel {

    @ValueMapValue
    private String logoImage;

    @ValueMapValue
    private String logoAltText;

    @ValueMapValue
    private String logoLink;

    @ValueMapValue
    private String title;

    @ValueMapValue
    private String subtitle;

    @ValueMapValue
    private String userName;

    @ValueMapValue
    private String notificationCount;

    @ValueMapValue
    private String bellIconImg;

    @ValueMapValue
    private String userIconImg;

    @ChildResource(name = "navItems")
    private List<NavItemModel> navItems;

    @ChildResource(name = "loginFields")
    private List<LoginFieldModel> loginFields;

    public String getLogoImage() {
        return logoImage;
    }

    public String getLogoAltText() {
        return StringUtils.defaultIfBlank(logoAltText, "Visa");
    }

    public String getLogoLink() {
        return StringUtils.defaultIfBlank(logoLink, "#");
    }

    /**
     * Logo link ready for an href: internal page paths get the ".html" extension.
     */
    public String getLogoUrl() {
        return toUrl(logoLink);
    }

    public String getTitle() {
        return title;
    }

    public String getSubtitle() {
        return subtitle;
    }

    public String getUserName() {
        return userName;
    }

    public String getNotificationCount() {
        return notificationCount;
    }

    public String getBellIconImg() {
        return bellIconImg;
    }

    public String getUserIconImg() {
        return userIconImg;
    }

    public List<NavItemModel> getNavItems() {
        return navItems != null ? Collections.unmodifiableList(navItems) : Collections.emptyList();
    }

    public List<LoginFieldModel> getLoginFields() {
        return loginFields != null ? Collections.unmodifiableList(loginFields) : Collections.emptyList();
    }

    public String getAriaLabel() {
        if (StringUtils.isNotBlank(title)) {
            return StringUtils.isNotBlank(subtitle) ? title + " " + subtitle + " home" : title + " home";
        }
        return "Spend Clarity Enterprise home";
    }

    public String getNotificationAriaLabel() {
        if (StringUtils.isNotBlank(notificationCount)) {
            return "Notifications, " + notificationCount + " unread";
        }
        return "Notifications";
    }

    /**
     * Checks if the header component has any authored content.
     * Used by HTL placeholder to show authoring prompt in edit mode when empty.
     */
    public boolean getIsEmpty() {
        return StringUtils.isBlank(logoImage)
                && StringUtils.isBlank(title)
                && StringUtils.isBlank(subtitle)
                && StringUtils.isBlank(userName)
                && StringUtils.isBlank(bellIconImg)
                && StringUtils.isBlank(userIconImg)
                && (navItems == null || navItems.isEmpty())
                && (loginFields == null || loginFields.isEmpty());
    }

    /**
     * Turns an authored link into an href. Internal AEM page paths
     * ("/content/site/page") get ".html" appended, keeping any query or
     * fragment; DAM paths, external URLs, anchors and paths that already
     * carry an extension are returned unchanged. Blank links become "#".
     *
     * @param link the authored link
     * @return a URL safe to use as an href
     */
    public static String toUrl(String link) {
        if (StringUtils.isBlank(link)) {
            return "#";
        }
        String value = link.trim();
        if (!value.startsWith("/content/") || value.startsWith("/content/dam/")) {
            return value;
        }
        int cut = StringUtils.indexOfAny(value, '?', '#');
        String path = cut >= 0 ? value.substring(0, cut) : value;
        String rest = cut >= 0 ? value.substring(cut) : "";
        String lastSegment = StringUtils.substringAfterLast(path, "/");
        if (lastSegment.contains(".")) {
            return value;
        }
        return StringUtils.removeEnd(path, "/") + ".html" + rest;
    }
}
