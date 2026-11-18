/* VSC Two Column Grid — aligns the left column with the header tabs.
   Left column: from "Home" (1st primary nav item) to "My spend" (2nd item).
   Works with the cmp-header and cmp-vscheader components.
   Only sets two CSS custom properties; layout stays in _twocolgrid.scss. */
(function () {
    "use strict";

    var NAV_ITEMS = ".cmp-header__nav-list > .cmp-header__nav-item, " +
        ".cmp-vscheader__nav-list > .cmp-vscheader__item";
    var TAB = ".cmp-header__nav-link, .cmp-vscheader__nav-link";
    var grids = [];
    var frame = 0;

    /* Left/right edges of a tab: its box, or its visible label (box minus padding). */
    function edges(tab, align) {
        var rect = tab.getBoundingClientRect();
        if (align === "tab") {
            return { left: rect.left, right: rect.right };
        }
        var style = window.getComputedStyle(tab);
        return {
            left: rect.left + (parseFloat(style.paddingLeft) || 0),
            right: rect.right - (parseFloat(style.paddingRight) || 0)
        };
    }

    function headerTabs() {
        var items = document.querySelectorAll(NAV_ITEMS);
        if (items.length < 2) {
            return null;
        }
        var first = items[0].querySelector(TAB);
        var second = items[1].querySelector(TAB);
        if (!first || !second) {
            return null;
        }
        /* Collapsed (mobile) header: tabs are not laid out in a row. */
        if (!first.offsetWidth || !second.offsetWidth) {
            return null;
        }
        return { first: first, second: second };
    }

    function align(grid) {
        var tabs = headerTabs();
        if (!tabs) {
            grid.style.removeProperty("--cmp-twocolgrid-start");
            grid.style.removeProperty("--cmp-twocolgrid-end");
            return;
        }
        var mode = grid.getAttribute("data-cmp-twocolgrid-align") === "label" ? "label" : "tab";
        var origin = grid.getBoundingClientRect().left;
        var start = edges(tabs.first, mode).left - origin;
        var end = edges(tabs.second, mode).right - origin;
        if (end <= start || start < 0) {
            return;
        }
        grid.style.setProperty("--cmp-twocolgrid-start", start.toFixed(2) + "px");
        grid.style.setProperty("--cmp-twocolgrid-end", end.toFixed(2) + "px");
    }

    function alignAll() {
        frame = 0;
        grids = grids.filter(function (g) { return document.documentElement.contains(g); });
        grids.forEach(align);
    }

    function schedule() {
        if (!frame) {
            frame = window.requestAnimationFrame(alignAll);
        }
    }

    function register(root) {
        var found = root.querySelectorAll ? root.querySelectorAll("[data-cmp-twocolgrid]") : [];
        var added = false;
        Array.prototype.forEach.call(found, function (grid) {
            if (grids.indexOf(grid) < 0) {
                grids.push(grid);
                added = true;
            }
        });
        if (root.matches && root.matches("[data-cmp-twocolgrid]") && grids.indexOf(root) < 0) {
            grids.push(root);
            added = true;
        }
        if (added) {
            schedule();
        }
    }

    function boot() {
        register(document);

        window.addEventListener("resize", schedule);
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(schedule);
        }
        /* Header labels or widths can change (authoring, fonts, zoom). */
        if (window.ResizeObserver) {
            var observer = new window.ResizeObserver(schedule);
            Array.prototype.forEach.call(document.querySelectorAll(NAV_ITEMS), function (item) {
                observer.observe(item);
            });
        }
        /* AEM editor re-renders components after edits (REFRESH_SELF/PAGE). */
        if (window.MutationObserver) {
            new window.MutationObserver(function (records) {
                var changed = false;
                records.forEach(function (record) {
                    Array.prototype.forEach.call(record.addedNodes, function (node) {
                        if (node.nodeType === 1) {
                            register(node);
                            changed = true;
                        }
                    });
                });
                if (changed && grids.length) {
                    schedule();
                }
            }).observe(document.body, { childList: true, subtree: true });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
}());
