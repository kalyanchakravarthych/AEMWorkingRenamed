/* VSC Header (cmp-header) — disclosure navigation, mobile menu toggle, skip link.
   Pattern: WAI-ARIA APG "Disclosure Navigation Menu".
   - Click / Enter / Space toggles a dropdown; only one open at a time.
   - Esc closes the open dropdown (or the mobile panel) and returns focus.
   - ArrowDown on a trigger opens it and focuses the first link;
     ArrowUp/ArrowDown/Home/End move between links inside an open dropdown.
   - Focus leaving a dropdown, or a click outside the header, closes it. */
(function () {
    "use strict";

    var uid = 0;
    var MOBILE_QUERY = "(max-width: 899.98px)";

    function nextId(prefix) {
        uid += 1;
        return prefix + "-" + uid;
    }

    function ensureId(el, prefix) {
        if (!el.id) {
            el.id = nextId(prefix);
        }
        return el.id;
    }

    /* Point the skip link at the page's main content. Removes the link if
       nothing suitable exists so it never targets a missing anchor. */
    function wireSkipLink(root) {
        var skip = root.querySelector("[data-cmp-header-skip]");
        if (!skip) {
            return;
        }
        var target = document.getElementById("main-content") ||
            document.querySelector("main, [role='main']") ||
            document.querySelector(".cmp-twocolgrid__col--right");
        if (!target) {
            skip.parentNode.removeChild(skip);
            return;
        }
        if (!target.id) {
            target.id = "main-content";
        }
        skip.setAttribute("href", "#" + target.id);
        if (!target.hasAttribute("tabindex")) {
            target.setAttribute("tabindex", "-1");
        }
        skip.addEventListener("click", function () {
            /* Some browsers scroll but do not move focus for in-page links. */
            window.setTimeout(function () { target.focus(); }, 0);
        });
    }

    function init(root) {
        if (!root || root.__cmpHeaderInit) {
            return;
        }
        root.__cmpHeaderInit = true;

        var triggers = Array.prototype.slice.call(root.querySelectorAll("[data-cmp-header-trigger]"));
        var toggle = root.querySelector("[data-cmp-header-toggle]");
        var panel = root.querySelector("[data-cmp-header-panel]");
        var mq = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;

        function menuOf(trigger) { return trigger.nextElementSibling; }
        function linksOf(menu) { return Array.prototype.slice.call(menu.querySelectorAll("a[href]")); }

        function close(trigger, returnFocus) {
            if (trigger.getAttribute("aria-expanded") !== "true") {
                return;
            }
            trigger.setAttribute("aria-expanded", "false");
            menuOf(trigger).hidden = true;
            if (returnFocus) {
                trigger.focus();
            }
        }

        function closeAll(except) {
            triggers.forEach(function (t) {
                if (t !== except) {
                    close(t, false);
                }
            });
        }

        function open(trigger, focusFirst) {
            closeAll(trigger);
            trigger.setAttribute("aria-expanded", "true");
            var menu = menuOf(trigger);
            menu.hidden = false;
            if (focusFirst) {
                var links = linksOf(menu);
                if (links.length) {
                    links[0].focus();
                }
            }
        }

        function openTrigger() {
            for (var i = 0; i < triggers.length; i++) {
                if (triggers[i].getAttribute("aria-expanded") === "true") {
                    return triggers[i];
                }
            }
            return null;
        }

        /* ---------- Dropdown triggers ---------- */
        triggers.forEach(function (trigger) {
            var menu = menuOf(trigger);
            if (!menu) {
                return;
            }
            trigger.setAttribute("aria-controls", ensureId(menu, "cmp-header-menu"));

            trigger.addEventListener("click", function () {
                if (trigger.getAttribute("aria-expanded") === "true") {
                    close(trigger, false);
                } else {
                    open(trigger, false);
                }
            });

            trigger.addEventListener("keydown", function (e) {
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    open(trigger, true);
                }
            });

            menu.addEventListener("keydown", function (e) {
                var links = linksOf(menu);
                var i = links.indexOf(document.activeElement);
                if (i < 0) {
                    return;
                }
                var next = null;
                if (e.key === "ArrowDown") {
                    next = links[(i + 1) % links.length];
                } else if (e.key === "ArrowUp") {
                    next = links[(i - 1 + links.length) % links.length];
                } else if (e.key === "Home") {
                    next = links[0];
                } else if (e.key === "End") {
                    next = links[links.length - 1];
                }
                if (next) {
                    e.preventDefault();
                    next.focus();
                }
            });

            /* Close when keyboard focus leaves this item entirely. */
            trigger.parentNode.addEventListener("focusout", function (e) {
                if (e.relatedTarget && !trigger.parentNode.contains(e.relatedTarget)) {
                    close(trigger, false);
                }
            });
        });

        /* ---------- Mobile menu toggle ---------- */
        function setPanel(isOpen, returnFocus) {
            if (!toggle || !panel) {
                return;
            }
            toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
            panel.classList.toggle("cmp-header__nav--open", isOpen);
            if (!isOpen) {
                closeAll(null);
                if (returnFocus) {
                    toggle.focus();
                }
            }
        }

        function onBreakpointChange(ev) {
            if (!ev.matches) {
                setPanel(false, false);
            }
        }

        if (toggle && panel) {
            toggle.setAttribute("aria-controls", ensureId(panel, "cmp-header-panel"));
            toggle.addEventListener("click", function () {
                setPanel(toggle.getAttribute("aria-expanded") !== "true", false);
            });
            /* Leaving the mobile breakpoint resets the panel state. */
            if (mq) {
                if (mq.addEventListener) {
                    mq.addEventListener("change", onBreakpointChange);
                } else if (mq.addListener) {
                    mq.addListener(onBreakpointChange);
                }
            }
        }

        /* ---------- Escape + outside click ---------- */
        root.addEventListener("keydown", function (e) {
            if (e.key !== "Escape" && e.key !== "Esc") {
                return;
            }
            var current = openTrigger();
            if (current) {
                e.preventDefault();
                close(current, true);
            } else if (toggle && toggle.getAttribute("aria-expanded") === "true") {
                e.preventDefault();
                setPanel(false, true);
            }
        });

        document.addEventListener("click", function (e) {
            if (!root.contains(e.target)) {
                closeAll(null);
            }
        });

        wireSkipLink(root);
    }

    function boot() {
        document.querySelectorAll("[data-cmp-header]").forEach(init);
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
}());
