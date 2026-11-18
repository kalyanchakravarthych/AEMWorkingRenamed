package com.spend.sc.core.models;

import io.wcm.testing.mock.aem.junit5.AemContext;
import io.wcm.testing.mock.aem.junit5.AemContextExtension;
import com.spend.sc.core.testcontext.AppAemContext;
import org.apache.sling.api.resource.Resource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(AemContextExtension.class)
class HeaderModelTest {

    private final AemContext context = AppAemContext.newAemContext();

    @BeforeEach
    void setUp() {
        context.addModelsForClasses(
            HeaderModel.class,
            NavItemModel.class,
            NestedNavItemModel.class,
            LoginFieldModel.class
        );
    }

    @Test
    void testEmptyHeader() {
        Resource resource = context.create().resource("/content/test-empty-header",
            "sling:resourceType", "spend-clarity/components/header");

        HeaderModel header = resource.adaptTo(HeaderModel.class);
        assertNotNull(header);
        assertTrue(header.getIsEmpty());
        assertNull(header.getLogoImage());
        assertEquals("Visa", header.getLogoAltText());
        assertEquals("#", header.getLogoLink());
        assertNull(header.getTitle());
        assertNull(header.getSubtitle());
        assertNull(header.getUserName());
        assertNull(header.getNotificationCount());
        assertNull(header.getBellIconImg());
        assertNull(header.getUserIconImg());
        assertTrue(header.getNavItems().isEmpty());
        assertTrue(header.getLoginFields().isEmpty());
    }

    @Test
    void testPopulatedHeader() {
        Map<String, Object> headerProps = new HashMap<>();
        headerProps.put("sling:resourceType", "spend-clarity/components/header");
        headerProps.put("logoImage", "/content/dam/visa/logo.png");
        headerProps.put("logoAltText", "Spend Clarity");
        headerProps.put("logoLink", "/content/visa/home.html");
        headerProps.put("title", "Spend Clarity");
        headerProps.put("subtitle", "Enterprise");
        headerProps.put("userName", "Stacey");
        headerProps.put("notificationCount", "1");
        headerProps.put("bellIconImg", "/content/dam/visa/icons/bell.svg");
        headerProps.put("userIconImg", "/content/dam/visa/icons/user.svg");

        Resource headerResource = context.create().resource("/content/test-header", headerProps);

        // Tab 2: Navigation Items (2-level nested)
        Resource navItemsParent = context.create().resource(headerResource, "navItems");
        Resource navItem1 = context.create().resource(navItemsParent, "item0",
            "text", "My Spend",
            "link", "/content/visa/my-spend");
        Resource nestedParent = context.create().resource(navItem1, "nestedNavItems");
        context.create().resource(nestedParent, "item0",
            "text", "Spend Analytics",
            "link", "/content/visa/solutions/analytics");
        context.create().resource(nestedParent, "item1",
            "text", "Payment Controls",
            "link", "/content/visa/solutions/controls");

        // Tab 3: Login Fields
        Resource loginFieldsParent = context.create().resource(headerResource, "loginFields");
        context.create().resource(loginFieldsParent, "item0",
            "text", "Sign Out",
            "link", "/system/sling/logout.html");

        HeaderModel header = headerResource.adaptTo(HeaderModel.class);
        assertNotNull(header);
        assertFalse(header.getIsEmpty());
        assertEquals("/content/dam/visa/logo.png", header.getLogoImage());
        assertEquals("Spend Clarity", header.getLogoAltText());
        assertEquals("/content/visa/home.html", header.getLogoLink());
        assertEquals("Spend Clarity", header.getTitle());
        assertEquals("Enterprise", header.getSubtitle());
        assertEquals("Stacey", header.getUserName());
        assertEquals("1", header.getNotificationCount());
        assertEquals("/content/dam/visa/icons/bell.svg", header.getBellIconImg());
        assertEquals("/content/dam/visa/icons/user.svg", header.getUserIconImg());

        // Verify Tab 2
        assertEquals(1, header.getNavItems().size());
        NavItemModel navItem = header.getNavItems().get(0);
        assertEquals("My Spend", navItem.getText());
        assertEquals("/content/visa/my-spend", navItem.getLink());
        assertTrue(navItem.isHasNestedItems());
        assertEquals(2, navItem.getNestedNavItems().size());
        assertEquals("Spend Analytics", navItem.getNestedNavItems().get(0).getText());
        assertEquals("/content/visa/solutions/analytics", navItem.getNestedNavItems().get(0).getLink());
        assertEquals("Payment Controls", navItem.getNestedNavItems().get(1).getText());

        // Verify Tab 3
        assertEquals(1, header.getLoginFields().size());
        assertEquals("Sign Out", header.getLoginFields().get(0).getText());
        assertEquals("/system/sling/logout.html", header.getLoginFields().get(0).getLink());
    }

    @Test
    void testUrlsForHrefs() {
        Resource headerResource = context.create().resource("/content/test-header-urls",
            "sling:resourceType", "spend-clarity/components/header",
            "logoLink", "/content/visa/home");
        Resource navItemsParent = context.create().resource(headerResource, "navItems");
        Resource navItem = context.create().resource(navItemsParent, "item0",
            "text", "Reports",
            "link", "/content/visa/reports");
        Resource nestedParent = context.create().resource(navItem, "nestedNavItems");
        context.create().resource(nestedParent, "item0",
            "text", "Scheduled reports",
            "link", "/content/visa/reports/scheduled");
        Resource loginFieldsParent = context.create().resource(headerResource, "loginFields");
        context.create().resource(loginFieldsParent, "item0",
            "text", "Sign out",
            "link", "/system/sling/logout.html");

        HeaderModel header = headerResource.adaptTo(HeaderModel.class);
        assertNotNull(header);
        assertEquals("/content/visa/home.html", header.getLogoUrl());
        assertEquals("/content/visa/reports.html", header.getNavItems().get(0).getUrl());
        assertEquals("/content/visa/reports/scheduled.html",
            header.getNavItems().get(0).getNestedNavItems().get(0).getUrl());
        assertEquals("/system/sling/logout.html", header.getLoginFields().get(0).getUrl());
    }

    @Test
    void testToUrl() {
        assertEquals("#", HeaderModel.toUrl(null));
        assertEquals("#", HeaderModel.toUrl("   "));
        assertEquals("/content/vsc/us/en/cards.html", HeaderModel.toUrl("/content/vsc/us/en/cards"));
        assertEquals("/content/vsc/us/en/cards.html", HeaderModel.toUrl("/content/vsc/us/en/cards/"));
        assertEquals("/content/vsc/us/en/cards.html?tab=1", HeaderModel.toUrl("/content/vsc/us/en/cards?tab=1"));
        assertEquals("/content/vsc/us/en/cards.html#top", HeaderModel.toUrl("/content/vsc/us/en/cards#top"));
        assertEquals("/content/visa/home.html", HeaderModel.toUrl("/content/visa/home.html"));
        assertEquals("/content/dam/visa/guide.pdf", HeaderModel.toUrl("/content/dam/visa/guide.pdf"));
        assertEquals("/content/dam/visa/folder", HeaderModel.toUrl("/content/dam/visa/folder"));
        assertEquals("https://www.visa.com/", HeaderModel.toUrl("https://www.visa.com/"));
        assertEquals("#", HeaderModel.toUrl("#"));
    }
}
