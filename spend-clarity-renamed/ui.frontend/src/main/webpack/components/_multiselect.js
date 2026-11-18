/* VSC Multi-select (dropdown component, "multi" template).
   - The ▾ button opens/closes the option list (aria-expanded).
   - Checking an option adds a chip; a chip button removes it.
   - Esc or a click outside closes the list.
   - Callers that change the checkboxes in code dispatch "vsc:multiselect-sync"
     on the [data-cmp-multiselect] element to redraw the chips. */
(function () {
    "use strict";

    function init(root) {
        if (!root || root.__vscMultiInit) {
            return;
        }
        root.__vscMultiInit = true;

        var toggle = root.querySelector("[data-cmp-multi-toggle]");
        var list = root.querySelector("[data-cmp-multi-list]");
        var chips = root.querySelector("[data-cmp-multi-chips]");
        if (!toggle || !list || !chips) {
            return;
        }

        function boxes() {
            return Array.prototype.slice.call(list.querySelectorAll('input[type="checkbox"]'));
        }

        function setOpen(open) {
            list.hidden = !open;
            toggle.setAttribute("aria-expanded", open ? "true" : "false");
        }

        function render() {
            chips.textContent = "";
            boxes().forEach(function (box) {
                if (!box.checked) {
                    return;
                }
                var li = document.createElement("li");
                var chip = document.createElement("button");
                chip.type = "button";
                chip.className = "cmp-multi__chip";
                chip.setAttribute("data-value", box.value);
                chip.setAttribute("aria-label", "Remove " + box.value);
                chip.disabled = box.disabled;
                var x = document.createElement("span");
                x.setAttribute("aria-hidden", "true");
                x.textContent = "×";
                chip.appendChild(x);
                chip.appendChild(document.createTextNode(box.value));
                li.appendChild(chip);
                chips.appendChild(li);
            });
            toggle.disabled = boxes().every(function (b) { return b.disabled; });
        }

        toggle.addEventListener("click", function (e) {
            e.stopPropagation();
            setOpen(list.hidden);
            if (!list.hidden) {
                var first = boxes()[0];
                if (first) {
                    first.focus();
                }
            }
        });

        list.addEventListener("change", render);

        chips.addEventListener("click", function (e) {
            var chip = e.target.closest ? e.target.closest(".cmp-multi__chip") : null;
            if (!chip) {
                return;
            }
            var value = chip.getAttribute("data-value");
            boxes().forEach(function (box) {
                if (box.value === value) {
                    box.checked = false;
                    box.dispatchEvent(new Event("change", { bubbles: true }));
                }
            });
            render();
            toggle.focus();
        });

        root.addEventListener("keydown", function (e) {
            if ((e.key === "Escape" || e.key === "Esc") && !list.hidden) {
                e.stopPropagation();
                setOpen(false);
                toggle.focus();
            }
        });

        document.addEventListener("click", function (e) {
            if (!list.hidden && !root.contains(e.target)) {
                setOpen(false);
            }
        });

        root.addEventListener("vsc:multiselect-sync", function () {
            setOpen(false);
            render();
        });

        render();
    }

    function scan(node) {
        if (node.matches && node.matches("[data-cmp-multiselect]")) {
            init(node);
        }
        if (node.querySelectorAll) {
            Array.prototype.forEach.call(node.querySelectorAll("[data-cmp-multiselect]"), init);
        }
    }

    function boot() {
        scan(document);
        if (window.MutationObserver) {
            new window.MutationObserver(function (records) {
                records.forEach(function (record) {
                    Array.prototype.forEach.call(record.addedNodes, function (node) {
                        if (node.nodeType === 1) {
                            scan(node);
                        }
                    });
                });
            }).observe(document.body, { childList: true, subtree: true });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
}());
