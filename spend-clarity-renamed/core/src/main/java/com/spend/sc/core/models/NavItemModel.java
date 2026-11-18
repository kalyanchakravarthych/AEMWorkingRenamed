package com.spend.sc.core.models;

import java.util.Collections;
import java.util.List;

import org.apache.sling.api.resource.Resource;
import org.apache.sling.models.annotations.DefaultInjectionStrategy;
import org.apache.sling.models.annotations.Model;
import org.apache.sling.models.annotations.injectorspecific.ChildResource;
import org.apache.sling.models.annotations.injectorspecific.ValueMapValue;

@Model(
    adaptables = Resource.class,
    defaultInjectionStrategy = DefaultInjectionStrategy.OPTIONAL
)
public class NavItemModel {

    @ValueMapValue
    private String text;

    @ValueMapValue
    private String link;

    @ChildResource(name = "nestedNavItems")
    private List<NestedNavItemModel> nestedNavItems;

    public String getText() {
        return text;
    }

    public String getLink() {
        return link;
    }

    /**
     * Link ready for an href (see {@link HeaderModel#toUrl(String)}).
     */
    public String getUrl() {
        return HeaderModel.toUrl(link);
    }

    public List<NestedNavItemModel> getNestedNavItems() {
        return nestedNavItems != null ? Collections.unmodifiableList(nestedNavItems) : Collections.emptyList();
    }

    public boolean isHasNestedItems() {
        return nestedNavItems != null && !nestedNavItems.isEmpty();
    }
}
