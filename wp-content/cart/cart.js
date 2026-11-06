/* Client-side shopping basket for the LESEM static catalogue.
 *
 * There is no backend. The basket is kept in localStorage and the order is
 * handed to the visitor's own mail client as a prefilled mailto: message
 * addressed to the shop owner (the same address the contact page uses).
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'lesem.cart.v1';
    var CUSTOMER_KEY = 'lesem.customer.v1';
    var SHOP_EMAIL = 'katerina@lesem.info';
    var CURRENCY = 'Kč';

    var CART_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6.2 6l1.5 7.3a1 1 0 0 0 1 .7h7.7a1 1 0 0 0 1-.8L19.3 6H6.2zM3 3h2l.6 2.9L6.2 4h14l-2.2 10.3a3 3 0 0 1-3 2.4H8.7a3 3 0 0 1-2.9-2.4L3.6 5H2a1 1 0 0 1 0-2h1z"/>' +
        '</svg>';

    var items = loadItems();
    var panel = null;
    var overlay = null;
    var toastTimer = null;
    var lastFocus = null;
    var step = 'cart';

    /* ---------- storage ---------- */

    function loadItems() {
        try {
            var raw = window.localStorage.getItem(STORAGE_KEY);
            var parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(function (it) {
                return it && typeof it.id === 'string' &&
                    typeof it.name === 'string' &&
                    typeof it.price === 'number' && it.price >= 0 &&
                    typeof it.qty === 'number' && it.qty > 0;
            }).map(function (it) {
                return {
                    id: it.id,
                    name: it.name,
                    price: it.price,
                    img: typeof it.img === 'string' ? it.img : '',
                    url: typeof it.url === 'string' ? it.url : '',
                    qty: Math.min(Math.floor(it.qty), 99)
                };
            });
        } catch (e) {
            return [];
        }
    }

    function saveItems() {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        } catch (e) {
            /* private mode / quota: the basket still works for this page view */
        }
    }

    function loadCustomer() {
        try {
            return JSON.parse(window.localStorage.getItem(CUSTOMER_KEY) || '{}') || {};
        } catch (e) {
            return {};
        }
    }

    function saveCustomer(data) {
        try {
            window.localStorage.setItem(CUSTOMER_KEY, JSON.stringify(data));
        } catch (e) { /* ignore */ }
    }

    /* ---------- formatting ---------- */

    function formatKc(value) {
        var n = Math.round(value);
        var sign = n < 0 ? '-' : '';
        var digits = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return sign + digits + '\u00a0' + CURRENCY;
    }

    function amountFrom(root) {
        if (!root) return null;
        var nodes = root.querySelectorAll('.woocommerce-Price-amount');
        if (!nodes.length) return null;
        var text = nodes[nodes.length - 1].textContent.replace(/\s|\u00a0/g, '');
        text = text.replace(/[^\d.,]/g, '');
        if (text.indexOf(',') !== -1) text = text.split(',')[0];
        text = text.replace(/\./g, '');
        var value = parseInt(text, 10);
        return isFinite(value) ? value : null;
    }

    function absolutePath(url) {
        try {
            var resolved = new URL(url, window.location.href);
            return resolved.pathname + resolved.search;
        } catch (e) {
            return url;
        }
    }

    function total() {
        return items.reduce(function (sum, it) { return sum + it.price * it.qty; }, 0);
    }

    function itemsLabel(n) {
        if (n === 1) return '1 položka';
        if (n >= 2 && n <= 4) return n + ' položky';
        return n + ' položek';
    }

    function count() {
        return items.reduce(function (sum, it) { return sum + it.qty; }, 0);
    }

    /* ---------- basket operations ---------- */

    function add(product, qty) {
        if (!product || !product.id || !(product.price >= 0)) return;
        qty = Math.max(1, Math.min(99, Math.floor(qty || product.qty || 1)));
        var existing = null;
        for (var i = 0; i < items.length; i++) {
            if (items[i].id === product.id) { existing = items[i]; break; }
        }
        if (existing) {
            existing.qty = Math.min(99, existing.qty + qty);
            if (product.img && !existing.img) existing.img = product.img;
        } else {
            items.push({
                id: product.id,
                name: String(product.name || 'Produkt'),
                price: Math.round(product.price),
                img: product.img || '',
                url: product.url || product.id,
                qty: qty
            });
        }
        saveItems();
        render();
        announce('Přidáno do košíku: ' + (product.name || '') + ' (' + formatKc(product.price) + ')');
        showToast('Přidáno do košíku');
    }

    function setQty(id, qty) {
        qty = Math.floor(qty);
        if (qty <= 0) return remove(id);
        for (var i = 0; i < items.length; i++) {
            if (items[i].id === id) {
                items[i].qty = Math.min(99, qty);
                break;
            }
        }
        saveItems();
        render();
    }

    function remove(id) {
        items = items.filter(function (it) { return it.id !== id; });
        saveItems();
        render();
    }

    function clear() {
        items = [];
        saveItems();
        render();
    }

    /* ---------- DOM helpers ---------- */

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function announce(message) {
        var live = document.getElementById('lesem-cart-live');
        if (live) live.textContent = message;
    }

    function showToast(message) {
        var toast = document.getElementById('lesem-cart-toast');
        if (!toast) {
            toast = el('div', 'lesem-toast');
            toast.id = 'lesem-cart-toast';
            toast.setAttribute('role', 'status');
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('is-visible');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(function () {
            toast.classList.remove('is-visible');
        }, 1900);
    }

    /* ---------- drawer construction ---------- */

    function buildPanel() {
        overlay = el('div', 'lesem-cart-overlay');
        overlay.setAttribute('data-lesem-cart-close', '');
        document.body.appendChild(overlay);

        panel = el('aside', 'lesem-cart');
        panel.id = 'lesem-cart-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', 'lesem-cart-title');
        panel.setAttribute('aria-hidden', 'true');

        var header = el('div', 'lesem-cart-header');
        var title = el('h2', null, 'Košík');
        title.id = 'lesem-cart-title';
        var close = el('button', 'lesem-cart-close', '\u00d7');
        close.type = 'button';
        close.setAttribute('aria-label', 'Zavřít košík');
        close.setAttribute('data-lesem-cart-close', '');
        header.appendChild(title);
        header.appendChild(close);

        var body = el('div', 'lesem-cart-body');
        var list = el('ul', 'lesem-cart-items');
        list.id = 'lesem-cart-items';
        var empty = el('p', 'lesem-cart-empty', 'Košík je zatím prázdný.');
        empty.id = 'lesem-cart-empty';
        body.appendChild(list);
        body.appendChild(empty);

        var footer = el('div', 'lesem-cart-footer');

        /* step 1: basket */
        var summaryStep = el('div', 'lesem-cart-step is-active');
        summaryStep.setAttribute('data-lesem-step', 'cart');
        var totalRow = el('div', 'lesem-cart-total');
        totalRow.appendChild(el('span', null, 'Celkem'));
        var totalValue = el('strong', null, formatKc(0));
        totalValue.id = 'lesem-cart-total';
        totalRow.appendChild(totalValue);
        var checkout = el('button', 'lesem-cart-primary', 'Pokračovat k objednávce');
        checkout.type = 'button';
        checkout.id = 'lesem-cart-checkout';
        var clearBtn = el('button', 'lesem-cart-secondary', 'Vyprázdnit košík');
        clearBtn.type = 'button';
        clearBtn.id = 'lesem-cart-clear';
        summaryStep.appendChild(totalRow);
        summaryStep.appendChild(checkout);
        summaryStep.appendChild(clearBtn);

        /* step 2: details */
        var formStep = el('form', 'lesem-cart-step lesem-cart-form');
        formStep.setAttribute('data-lesem-step', 'form');
        formStep.id = 'lesem-cart-form';
        formStep.setAttribute('novalidate', '');
        var summary = el('p', 'lesem-cart-summary');
        summary.id = 'lesem-cart-summary';
        formStep.appendChild(summary);
        formStep.appendChild(field('Jméno a příjmení *', 'text', 'jmeno', 'name', true));
        formStep.appendChild(field('E-mail *', 'email', 'email', 'email', true));
        formStep.appendChild(field('Telefon', 'tel', 'telefon', 'tel', false));
        formStep.appendChild(field('Poznámka', 'textarea', 'poznamka', 'off', false));
        var submit = el('button', 'lesem-cart-submit', 'Odeslat objednávku e-mailem');
        submit.type = 'submit';
        var back = el('button', 'lesem-cart-secondary', 'Zpět do košíku');
        back.type = 'button';
        back.id = 'lesem-cart-back';
        var hint = el('p', 'lesem-cart-hint',
            'Otevře se Váš e-mailový klient se zprávou pro ' + SHOP_EMAIL +
            '. Z tohoto webu se nic neodesílá ani neukládá na serveru.');
        formStep.appendChild(submit);
        formStep.appendChild(back);
        formStep.appendChild(hint);

        /* step 3: confirmation */
        var sentStep = el('div', 'lesem-cart-step lesem-cart-sent');
        sentStep.setAttribute('data-lesem-step', 'sent');
        sentStep.appendChild(el('p', null, 'Otevřeli jsme Váš e-mailový klient.'));
        sentStep.appendChild(el('p', 'lesem-cart-hint',
            'Pokud se neotevřel, zkontrolujte prosím nastavení e-mailu, nebo napište přímo na ' + SHOP_EMAIL + '.'));
        var clearAfter = el('button', 'lesem-cart-secondary', 'Vyprázdnit košík');
        clearAfter.type = 'button';
        clearAfter.id = 'lesem-cart-clear-sent';
        sentStep.appendChild(clearAfter);

        footer.appendChild(summaryStep);
        footer.appendChild(formStep);
        footer.appendChild(sentStep);

        var scroll = el('div', 'lesem-cart-scroll');
        scroll.appendChild(body);
        scroll.appendChild(footer);

        panel.appendChild(header);
        panel.appendChild(scroll);

        var live = el('p', 'lesem-sr');
        live.id = 'lesem-cart-live';
        live.setAttribute('aria-live', 'polite');
        panel.appendChild(live);

        document.body.appendChild(panel);
        bindPanelEvents();
        fillCustomer();
    }

    function field(labelText, type, name, autocomplete, required) {
        var label = el('label', null, labelText);
        var input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
        input.name = name;
        if (type === 'textarea') {
            input.rows = 3;
        } else {
            input.type = type;
        }
        if (autocomplete && autocomplete !== 'off') input.setAttribute('autocomplete', autocomplete);
        if (required) input.required = true;
        label.appendChild(input);
        return label;
    }

    function fillCustomer() {
        var saved = loadCustomer();
        ['jmeno', 'email', 'telefon'].forEach(function (name) {
            var input = panel.querySelector('[name="' + name + '"]');
            if (input && saved[name]) input.value = saved[name];
        });
    }

    function bindPanelEvents() {
        overlay.addEventListener('click', close);

        panel.addEventListener('click', function (event) {
            var target = event.target;
            if (target.closest('[data-lesem-cart-close]')) {
                close();
                return;
            }
            if (target.id === 'lesem-cart-clear' || target.id === 'lesem-cart-clear-sent') {
                clear();
                if (target.id === 'lesem-cart-clear-sent') setStep('cart');
                return;
            }
            if (target.id === 'lesem-cart-checkout') {
                setStep('form');
                return;
            }
            if (target.id === 'lesem-cart-back') {
                setStep('cart');
                return;
            }
            var qtyBtn = target.closest('[data-lesem-qty]');
            if (qtyBtn) {
                var id = qtyBtn.getAttribute('data-id');
                var action = qtyBtn.getAttribute('data-lesem-qty');
                var current = items.filter(function (it) { return it.id === id; })[0];
                if (!current) return;
                if (action === 'inc') setQty(id, current.qty + 1);
                else if (action === 'dec') setQty(id, current.qty - 1);
                else if (action === 'remove') remove(id);
            }
        });

        panel.querySelector('#lesem-cart-form').addEventListener('submit', function (event) {
            event.preventDefault();
            var form = event.currentTarget;
            if (!items.length) return;
            if (!form.reportValidity()) return;
            var data = {
                jmeno: form.jmeno.value.trim(),
                email: form.email.value.trim(),
                telefon: form.telefon.value.trim(),
                poznamka: form.poznamka.value.trim()
            };
            saveCustomer({ jmeno: data.jmeno, email: data.email, telefon: data.telefon });
            setStep('sent');
            window.location.href = buildMailto(data);
        });
    }

    function setStep(next) {
        if (step === next) return;
        step = next;
        var steps = panel.querySelectorAll('[data-lesem-step]');
        for (var i = 0; i < steps.length; i++) {
            steps[i].classList.toggle('is-active', steps[i].getAttribute('data-lesem-step') === next);
        }
        var body = panel.querySelector('.lesem-cart-body');
        if (body) body.style.display = (next === 'cart') ? '' : 'none';
        if (next === 'form') {
            var first = panel.querySelector('#lesem-cart-form input');
            if (first) first.focus();
        }
    }

    function open() {
        if (!panel) buildPanel();
        lastFocus = document.activeElement;
        panel.classList.add('is-open');
        overlay.classList.add('is-open');
        panel.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('lesem-cart-open');
        setStep('cart');
        render();
        var closeBtn = panel.querySelector('.lesem-cart-close');
        if (closeBtn) closeBtn.focus();
        document.addEventListener('keydown', onKeydown);
    }

    function close() {
        if (!panel) return;
        panel.classList.remove('is-open');
        overlay.classList.remove('is-open');
        panel.setAttribute('aria-hidden', 'true');
        document.documentElement.classList.remove('lesem-cart-open');
        document.removeEventListener('keydown', onKeydown);
        if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    }

    function onKeydown(event) {
        if (event.key === 'Escape') {
            close();
            return;
        }
        if (event.key !== 'Tab') return;
        var focusable = panel.querySelectorAll(
            'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])');
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    /* ---------- rendering ---------- */

    function render() {
        updateBadges();
        if (!panel) return;
        var list = panel.querySelector('#lesem-cart-items');
        var empty = panel.querySelector('#lesem-cart-empty');
        var totalEl = panel.querySelector('#lesem-cart-total');
        var checkout = panel.querySelector('#lesem-cart-checkout');
        var clearBtn = panel.querySelector('#lesem-cart-clear');
        var submit = panel.querySelector('.lesem-cart-submit');

        list.textContent = '';
        items.forEach(function (it) {
            list.appendChild(renderItem(it));
        });

        var isEmpty = items.length === 0;
        empty.style.display = isEmpty ? '' : 'none';
        list.style.display = isEmpty ? 'none' : '';
        totalEl.textContent = formatKc(total());
        checkout.disabled = isEmpty;
        clearBtn.style.display = isEmpty ? 'none' : '';
        submit.disabled = isEmpty;
        var summary = panel.querySelector('#lesem-cart-summary');
        if (summary) {
            summary.textContent = itemsLabel(items.length) + ' · celkem ' + formatKc(total());
        }

        if (isEmpty && step !== 'cart') setStep('cart');
    }

    function renderItem(it) {
        var row = el('li', 'lesem-cart-item');
        row.setAttribute('data-id', it.id);

        var img = document.createElement('img');
        img.className = 'lesem-cart-thumb';
        img.alt = '';
        img.loading = 'lazy';
        img.src = it.img;
        row.appendChild(img);

        var info = el('div', 'lesem-cart-info');
        var name = el('a', 'lesem-cart-name', it.name);
        name.href = /^\//.test(it.url || '') ? it.url : '#';
        info.appendChild(name);
        info.appendChild(el('div', 'lesem-cart-unit', formatKc(it.price) + ' / ks'));

        var qty = el('div', 'lesem-cart-qty');
        qty.appendChild(qtyButton('\u2212', 'dec', it.id, 'Snížit počet'));
        qty.appendChild(el('span', null, String(it.qty)));
        qty.appendChild(qtyButton('+', 'inc', it.id, 'Zvýšit počet'));
        var removeBtn = el('button', 'lesem-cart-remove', 'Odebrat');
        removeBtn.type = 'button';
        removeBtn.setAttribute('data-lesem-qty', 'remove');
        removeBtn.setAttribute('data-id', it.id);
        removeBtn.setAttribute('aria-label', 'Odebrat ' + it.name + ' z košíku');
        qty.appendChild(removeBtn);
        info.appendChild(qty);
        row.appendChild(info);

        row.appendChild(el('div', 'lesem-cart-line', formatKc(it.price * it.qty)));
        return row;
    }

    function qtyButton(label, action, id, aria) {
        var btn = el('button', null, label);
        btn.type = 'button';
        btn.setAttribute('data-lesem-qty', action);
        btn.setAttribute('data-id', id);
        btn.setAttribute('aria-label', aria);
        return btn;
    }

    function updateBadges() {
        var badges = document.querySelectorAll('.lesem-cart-count');
        var n = count();
        for (var i = 0; i < badges.length; i++) {
            badges[i].textContent = String(n);
            if (n > 0) {
                badges[i].removeAttribute('hidden');
            } else {
                badges[i].setAttribute('hidden', '');
            }
        }
    }

    /* ---------- page wiring ---------- */

    function injectNav() {
        var menu = document.getElementById('menu-hlavni-menu');
        if (!menu || menu.querySelector('.lesem-cart-nav')) return;
        var li = el('li', 'menu-item lesem-cart-nav');
        var link = el('a');
        link.href = '#';
        link.setAttribute('role', 'button');
        link.setAttribute('aria-label', 'Otevřít košík');
        link.innerHTML = CART_ICON + '<span>Košík</span>';
        var badge = el('span', 'lesem-cart-count', '0');
        badge.setAttribute('aria-hidden', 'true');
        badge.setAttribute('hidden', '');
        link.appendChild(badge);
        link.addEventListener('click', function (event) {
            event.preventDefault();
            open();
        });
        li.appendChild(link);
        menu.appendChild(li);
    }

    function injectFab() {
        if (document.querySelector('.lesem-cart-fab')) return;
        var fab = el('button', 'lesem-cart-fab');
        fab.type = 'button';
        fab.setAttribute('aria-label', 'Otevřít košík');
        fab.innerHTML = CART_ICON;
        var badge = el('span', 'lesem-cart-count', '0');
        badge.setAttribute('aria-hidden', 'true');
        badge.setAttribute('hidden', '');
        fab.appendChild(badge);
        fab.addEventListener('click', open);
        document.body.appendChild(fab);
    }

    function productFromCard(card) {
        var link = card.querySelector('a.shop-item-title-link') ||
            card.querySelector('.card-title a') ||
            card.querySelector('.card-image a');
        if (!link) return null;
        var priceRoot = card.querySelector('.price');
        var price = amountFrom(priceRoot);
        if (price === null) return null;
        var title = link.getAttribute('title') || link.textContent.trim();
        var img = card.querySelector('img');
        return {
            id: absolutePath(link.getAttribute('href')),
            name: title,
            price: price,
            img: img ? absolutePath(img.getAttribute('src')) : '',
            url: absolutePath(link.getAttribute('href'))
        };
    }

    function enhanceCards() {
        var cards = document.querySelectorAll('li.product');
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            if (card.querySelector('.lesem-add')) continue;
            var product = productFromCard(card);
            if (!product) continue;
            var stats = card.querySelector('.footer .stats');
            var footer = card.querySelector('.footer') || card;
            var btn = el('button', 'lesem-add');
            btn.type = 'button';
            btn.innerHTML = CART_ICON;
            btn.setAttribute('aria-label', 'Přidat do košíku: ' + product.name);
            btn.setAttribute('title', 'Přidat do košíku');
            bindAdd(btn, product);
            (stats || footer).appendChild(btn);
        }
    }

    function enhanceSingle() {
        var title = document.querySelector('.product_title');
        var summary = document.querySelector('.summary.entry-summary');
        if (!title || !summary || summary.querySelector('.lesem-add-single')) return;
        var priceRoot = summary.querySelector('p.price');
        var price = amountFrom(priceRoot);
        if (price === null) return;
        var img = document.querySelector('.woocommerce-product-gallery img') ||
            summary.querySelector('img');
        var product = {
            id: window.location.pathname,
            name: title.textContent.trim(),
            price: price,
            img: img ? absolutePath(img.getAttribute('src')) : '',
            url: window.location.pathname
        };
        var btn = el('button', 'lesem-add-single');
        btn.type = 'button';
        btn.innerHTML = CART_ICON + '<span>Přidat do košíku</span>';
        btn.setAttribute('aria-label', 'Přidat do košíku: ' + product.name);
        bindAdd(btn, product);
        var anchor = summary.querySelector('.product_meta') || summary.querySelector('.stock');
        if (anchor && anchor.parentNode) {
            anchor.parentNode.insertBefore(btn, anchor);
        } else {
            summary.appendChild(btn);
        }
    }

    function bindAdd(btn, product) {
        btn.addEventListener('click', function () {
            add(product, 1);
            btn.classList.add('is-added');
            window.setTimeout(function () { btn.classList.remove('is-added'); }, 900);
        });
    }

    /* ---------- order message ---------- */

    function buildMailto(customer) {
        customer = customer || {};
        var lines = [
            'Dobrý den,',
            '',
            'mám zájem o toto zboží z webu lesem.info:',
            ''
        ];
        items.forEach(function (it, index) {
            lines.push((index + 1) + ') ' + it.name);
            lines.push('   ' + it.qty + ' ks × ' + formatKc(it.price) +
                ' = ' + formatKc(it.qty * it.price));
        });
        lines.push('');
        lines.push('Celkem: ' + formatKc(total()));
        lines.push('');
        if (customer.jmeno) lines.push('Jméno: ' + customer.jmeno);
        if (customer.email) lines.push('E-mail: ' + customer.email);
        if (customer.telefon) lines.push('Telefon: ' + customer.telefon);
        if (customer.poznamka) lines.push('Poznámka: ' + customer.poznamka);
        lines.push('');
        lines.push('Odesláno z webu lesem.info');
        var subject = 'Objednávka z webu lesem.info';
        return 'mailto:' + SHOP_EMAIL +
            '?subject=' + encodeURIComponent(subject) +
            '&body=' + encodeURIComponent(lines.join('\r\n'));
    }

    /* ---------- init ---------- */

    function init() {
        injectNav();
        injectFab();
        enhanceCards();
        enhanceSingle();
        updateBadges();

        window.addEventListener('storage', function (event) {
            if (event.key === STORAGE_KEY) {
                items = loadItems();
                render();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.lesemCart = {
        add: add,
        remove: remove,
        setQty: setQty,
        clear: clear,
        items: function () { return items.map(function (it) { return Object.assign({}, it); }); },
        total: total,
        count: count,
        open: open,
        close: close,
        buildMailto: buildMailto,
        storageKey: STORAGE_KEY
    };
}());
