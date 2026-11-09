/* ==========================================================================
   ONYX — theme JavaScript
   Vanilla JS, custom elements, no dependencies. Loaded with `defer`.
   ========================================================================== */
(() => {
  'use strict';

  const theme = window.theme || {};
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const qs = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const debounce = (fn, wait = 300) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), wait); };
  };
  const fetchConfig = (body) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify(body)
  });
  const parseHTML = (html) => new DOMParser().parseFromString(html, 'text/html');

  /* ---------- Money ---------- */
  function formatMoney(cents, format = theme.moneyFormat || '${{amount}}') {
    if (typeof cents === 'string') cents = cents.replace('.', '');
    cents = parseInt(cents, 10) || 0;
    const fmt = (n, decimals, thousands = ',', dec = '.') => {
      const fixed = (n / 100).toFixed(decimals);
      const [whole, frac] = fixed.split('.');
      return whole.replace(/\B(?=(\d{3})+(?!\d))/g, thousands) + (frac ? dec + frac : '');
    };
    return format.replace(/\{\{\s*(\w+)\s*\}\}/, (_, key) => {
      switch (key) {
        case 'amount': return fmt(cents, 2);
        case 'amount_no_decimals': return fmt(cents, 0);
        case 'amount_with_comma_separator': return fmt(cents, 2, '.', ',');
        case 'amount_no_decimals_with_comma_separator': return fmt(cents, 0, '.', ',');
        case 'amount_with_apostrophe_separator': return fmt(cents, 2, "'", '.');
        case 'amount_with_space_separator': return fmt(cents, 2, ' ', ',');
        case 'amount_no_decimals_with_space_separator': return fmt(cents, 0, ' ', ',');
        default: return fmt(cents, 2);
      }
    });
  }
  theme.formatMoney = formatMoney;

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(message) {
    const el = qs('[data-toast]');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2800);
  }
  theme.toast = toast;

  /* ---------- Focus trap ---------- */
  const FOCUSABLE = 'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), iframe';
  let trapHandler = null;
  function trapFocus(container, initial) {
    releaseFocus();
    const nodes = () => qsa(FOCUSABLE, container).filter((n) => n.offsetParent !== null || n === document.activeElement);
    trapHandler = (e) => {
      if (e.key !== 'Tab') return;
      const list = nodes();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trapHandler);
    requestAnimationFrame(() => (initial || nodes()[0] || container).focus({ preventScroll: true }));
  }
  function releaseFocus() {
    if (trapHandler) document.removeEventListener('keydown', trapHandler);
    trapHandler = null;
  }

  /* ==========================================================================
     Drawer (menu, cart, filters)
     ========================================================================== */
  class OnyxDrawer extends HTMLElement {
    connectedCallback() {
      this.addEventListener('click', (e) => { if (e.target.closest('[data-drawer-close]')) this.close(); });
      this.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
      this.setAttribute('aria-hidden', 'true');
    }
    open(trigger) {
      if (this.classList.contains('is-open')) return;
      this.trigger = trigger || document.activeElement;
      this.classList.add('is-open');
      this.removeAttribute('aria-hidden');
      this.panel = qs('.drawer__panel', this);
      if (this.panel) this.panel.removeAttribute('inert');
      document.body.classList.add('scroll-lock');
      qsa(`[aria-controls="${this.id}"]`).forEach((b) => b.setAttribute('aria-expanded', 'true'));
      trapFocus(this, qs('[data-drawer-focus]', this));
      this.dispatchEvent(new CustomEvent('drawer:open'));
    }
    close() {
      if (!this.classList.contains('is-open')) return;
      this.classList.remove('is-open');
      this.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('scroll-lock');
      qsa(`[aria-controls="${this.id}"]`).forEach((b) => b.setAttribute('aria-expanded', 'false'));
      releaseFocus();
      if (this.trigger && this.trigger.focus) this.trigger.focus({ preventScroll: true });
    }
  }
  customElements.define('onyx-drawer', OnyxDrawer);

  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-drawer-open]');
    if (!opener) return;
    const drawer = document.getElementById(opener.getAttribute('aria-controls'));
    if (!drawer || typeof drawer.open !== 'function') return; // fall back to link href
    e.preventDefault();
    drawer.open(opener);
  });

  /* ==========================================================================
     Header: sticky behaviour + mega menu
     ========================================================================== */
  class OnyxHeader extends HTMLElement {
    connectedCallback() {
      this.wrapper = this.closest('.header-wrapper') || this;
      this.hideOnScroll = this.dataset.hideOnScroll === 'true';
      this.lastY = window.scrollY;
      this.onScroll = this.onScroll.bind(this);
      window.addEventListener('scroll', this.onScroll, { passive: true });
      this.setHeight();
      if ('ResizeObserver' in window) new ResizeObserver(() => this.setHeight()).observe(this.wrapper);
      this.initMenus();
    }
    setHeight() {
      const h = this.wrapper.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--header-offset', `${Math.round(h)}px`);
    }
    onScroll() {
      const y = window.scrollY;
      this.wrapper.classList.toggle('is-scrolled', y > 8);
      if (this.hideOnScroll && !qs('.nav__item.is-open', this)) {
        const hide = y > this.lastY && y > 300;
        this.wrapper.classList.toggle('is-hidden', hide);
        document.documentElement.style.setProperty('--header-offset', hide ? '0px' : `${Math.round(this.wrapper.offsetHeight)}px`);
      }
      this.lastY = y;
    }
    initMenus() {
      const items = qsa('.nav__item[data-has-menu]', this);
      const hoverable = window.matchMedia('(hover: hover)');
      items.forEach((item) => {
        const btn = qs('.nav__link', item);
        let timer;
        const open = () => { items.forEach((i) => i !== item && this.closeItem(i)); item.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); };
        item.addEventListener('mouseenter', () => { if (!hoverable.matches) return; clearTimeout(timer); timer = setTimeout(open, 80); });
        item.addEventListener('mouseleave', () => { if (!hoverable.matches) return; clearTimeout(timer); timer = setTimeout(() => this.closeItem(item), 160); });
        btn.addEventListener('click', (e) => {
          if (btn.tagName === 'A' && item.classList.contains('is-open')) return; // second click follows link
          e.preventDefault();
          item.classList.contains('is-open') ? this.closeItem(item) : open();
        });
        item.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && item.classList.contains('is-open')) { this.closeItem(item); btn.focus(); }
        });
        item.addEventListener('focusout', (e) => { if (!item.contains(e.relatedTarget)) this.closeItem(item); });
      });
      document.addEventListener('click', (e) => { if (!this.contains(e.target)) items.forEach((i) => this.closeItem(i)); });
    }
    closeItem(item) {
      item.classList.remove('is-open');
      const btn = qs('.nav__link', item);
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
  }
  customElements.define('onyx-header', OnyxHeader);

  /* ==========================================================================
     Announcement rotator
     ========================================================================== */
  class OnyxAnnouncement extends HTMLElement {
    connectedCallback() {
      this.items = qsa('.announcement__item', this);
      if (this.items.length < 2) return;
      this.index = 0;
      const speed = (parseInt(this.dataset.speed, 10) || 5) * 1000;
      this.timer = setInterval(() => { if (!this.matches(':hover, :focus-within')) this.go(1); }, speed);
      qsa('[data-dir]', this).forEach((b) => b.addEventListener('click', () => this.go(parseInt(b.dataset.dir, 10))));
    }
    disconnectedCallback() { clearInterval(this.timer); }
    go(dir) {
      this.items[this.index].classList.remove('is-active');
      this.items[this.index].setAttribute('aria-hidden', 'true');
      this.index = (this.index + dir + this.items.length) % this.items.length;
      this.items[this.index].classList.add('is-active');
      this.items[this.index].removeAttribute('aria-hidden');
    }
  }
  customElements.define('onyx-announcement', OnyxAnnouncement);

  /* ==========================================================================
     Search modal + predictive search
     ========================================================================== */
  class OnyxSearch extends HTMLElement {
    connectedCallback() {
      this.input = qs('input[type="search"]', this);
      this.results = qs('[data-predictive-results]', this);
      this.addEventListener('click', (e) => { if (e.target.closest('[data-search-close]')) this.close(); });
      this.addEventListener('keydown', (e) => this.onKeydown(e));
      if (this.input) this.input.addEventListener('input', debounce(() => this.search(), 220));
      this.cache = new Map();
    }
    open(trigger) {
      this.trigger = trigger;
      this.classList.add('is-open');
      this.removeAttribute('aria-hidden');
      document.body.classList.add('scroll-lock');
      trapFocus(this, this.input);
      qsa('[data-search-open]').forEach((b) => b.setAttribute('aria-expanded', 'true'));
    }
    close() {
      this.classList.remove('is-open');
      this.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('scroll-lock');
      releaseFocus();
      qsa('[data-search-open]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
      if (this.trigger) this.trigger.focus({ preventScroll: true });
    }
    onKeydown(e) {
      if (e.key === 'Escape') { this.close(); return; }
      if (!['ArrowDown', 'ArrowUp'].includes(e.key) || !this.results) return;
      const options = qsa('[role="option"]', this.results);
      if (!options.length) return;
      e.preventDefault();
      let i = options.findIndex((o) => o.getAttribute('aria-selected') === 'true');
      if (i > -1) options[i].setAttribute('aria-selected', 'false');
      i = e.key === 'ArrowDown' ? (i + 1) % options.length : (i - 1 + options.length) % options.length;
      options[i].setAttribute('aria-selected', 'true');
      options[i].focus();
    }
    async search() {
      const term = this.input.value.trim();
      if (!this.results) return;
      if (term.length < 2) { this.results.innerHTML = ''; this.results.hidden = true; this.input.setAttribute('aria-expanded', 'false'); return; }
      const url = `${theme.routes.predictiveSearch}?q=${encodeURIComponent(term)}&section_id=predictive-search&resources[type]=product,collection,query&resources[limit]=6&resources[options][unavailable_products]=last`;
      try {
        let html = this.cache.get(url);
        if (!html) {
          this.results.setAttribute('aria-busy', 'true');
          const res = await fetch(url);
          if (!res.ok) throw new Error(res.status);
          const text = await res.text();
          const fragment = qs('#shopify-section-predictive-search', parseHTML(text));
          html = fragment ? fragment.innerHTML : '';
          this.cache.set(url, html);
        }
        if (this.input.value.trim() !== term) return;
        this.results.innerHTML = html;
        this.results.hidden = false;
        this.input.setAttribute('aria-expanded', 'true');
      } catch (err) {
        this.results.hidden = true;
      } finally {
        this.results.removeAttribute('aria-busy');
      }
    }
  }
  customElements.define('onyx-search', OnyxSearch);

  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-search-open]');
    if (!opener) return;
    const modal = qs('onyx-search');
    if (!modal) return;
    e.preventDefault();
    modal.open(opener);
  });

  /* ==========================================================================
     Cart
     ========================================================================== */
  const Cart = {
    sectionIds() {
      const ids = new Set(qsa('[data-cart-section]').map((el) => el.dataset.cartSection));
      ids.add('cart-icon-bubble');
      if (theme.cartType === 'drawer') ids.add('cart-drawer');
      return Array.from(ids);
    },
    sectionKey(id) {
      const el = qs(`[data-cart-section="${id}"]`);
      return (el && el.dataset.sectionKey) || id;
    },
    render(sections) {
      if (!sections) return;
      this.sectionIds().forEach((id) => {
        const html = sections[this.sectionKey(id)];
        if (!html) return;
        const doc = parseHTML(html);
        const fresh = qs(`[data-cart-section="${id}"]`, doc);
        qsa(`[data-cart-section="${id}"]`).forEach((target) => {
          if (fresh) target.innerHTML = fresh.innerHTML;
        });
      });
      document.dispatchEvent(new CustomEvent('cart:updated'));
    },
    requestSections() {
      return this.sectionIds().map((id) => this.sectionKey(id));
    },
    async add(formData) {
      formData.append('sections', this.requestSections().join(','));
      formData.append('sections_url', window.location.pathname);
      const res = await fetch(`${theme.routes.cartAdd}.js`, { method: 'POST', headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: formData });
      const data = await res.json();
      if (!res.ok || data.status) throw new Error(data.description || data.message || theme.strings.cartError);
      this.render(data.sections);
      return data;
    },
    async change(line, quantity) {
      const res = await fetch(`${theme.routes.cartChange}.js`, fetchConfig({ line, quantity, sections: this.requestSections(), sections_url: window.location.pathname }));
      const data = await res.json();
      if (!res.ok || data.status) throw new Error(data.description || data.message || theme.strings.cartError);
      this.render(data.sections);
      return data;
    },
    async update(body) {
      const res = await fetch(`${theme.routes.cartUpdate}.js`, fetchConfig({ ...body, sections: this.requestSections(), sections_url: window.location.pathname }));
      const data = await res.json();
      if (!res.ok || data.status) throw new Error(data.description || data.message || theme.strings.cartError);
      this.render(data.sections);
      return data;
    },
    openDrawer(trigger) {
      const drawer = document.getElementById('CartDrawer');
      if (drawer && theme.cartType === 'drawer') drawer.open(trigger);
      else window.location.href = theme.routes.cart;
    }
  };
  theme.Cart = Cart;

  /* Add-to-cart forms (product page + quick add) */
  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('form[data-product-form]');
    if (!form) return;
    if (theme.cartType !== 'drawer' && !form.hasAttribute('data-ajax-always')) return; // native submit to /cart
    e.preventDefault();
    const btn = qs('[type="submit"]', form);
    const errorEl = qs('[data-form-error]', form.closest('[data-product-root]') || form);
    if (btn.getAttribute('aria-disabled') === 'true' || btn.disabled) return;
    btn.classList.add('is-loading');
    btn.setAttribute('aria-busy', 'true');
    if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }
    try {
      await Cart.add(new FormData(form));
      if (theme.cartType === 'drawer') Cart.openDrawer(btn);
      else toast(theme.strings.added);
    } catch (err) {
      if (errorEl) { errorEl.textContent = err.message; errorEl.hidden = false; }
      else toast(err.message);
    } finally {
      btn.classList.remove('is-loading');
      btn.removeAttribute('aria-busy');
    }
  });

  /* Cart line quantity + removal (drawer and page) */
  const changeLine = async (lineEl, quantity) => {
    const line = parseInt(lineEl.dataset.line, 10);
    lineEl.classList.add('is-loading');
    const errorEl = qs('[data-cart-error]', lineEl.closest('[data-cart-section]') || document);
    try {
      const data = await Cart.change(line, quantity);
      const item = data.items.find((i) => i.key === lineEl.dataset.key);
      if (item && quantity > item.quantity && errorEl) {
        errorEl.textContent = theme.strings.quantityError.replace('[quantity]', item.quantity);
        errorEl.hidden = false;
      }
    } catch (err) {
      lineEl.classList.remove('is-loading');
      if (errorEl) { errorEl.textContent = err.message; errorEl.hidden = false; }
    }
  };
  const debouncedChange = debounce(changeLine, 350);

  document.addEventListener('click', (e) => {
    const remove = e.target.closest('[data-cart-remove]');
    if (remove) {
      e.preventDefault();
      changeLine(remove.closest('[data-line]'), 0);
      return;
    }
    const step = e.target.closest('[data-qty-step]');
    if (step) {
      e.preventDefault();
      const wrap = step.closest('.qty');
      const input = qs('input', wrap);
      const min = parseInt(input.min || '0', 10);
      const max = input.max ? parseInt(input.max, 10) : Infinity;
      const next = Math.min(max, Math.max(min, (parseInt(input.value, 10) || 0) + parseInt(step.dataset.qtyStep, 10)));
      input.value = next;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  document.addEventListener('change', (e) => {
    const input = e.target.closest('[data-line] .qty input');
    if (!input) return;
    const q = Math.max(0, parseInt(input.value, 10) || 0);
    debouncedChange(input.closest('[data-line]'), q);
  });

  /* Discount codes (Cart AJAX API `discount` parameter) */
  const currentCodes = () => qsa('[data-discount-code]').map((el) => el.dataset.discountCode).filter((v, i, a) => a.indexOf(v) === i);
  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('form[data-discount-form]');
    if (!form) return;
    e.preventDefault();
    const input = qs('input', form);
    const code = input.value.trim();
    if (!code) return;
    const btn = qs('button', form);
    btn.classList.add('is-loading');
    const scope = form.closest('[data-cart-section]');
    try {
      const codes = currentCodes();
      if (!codes.map((c) => c.toLowerCase()).includes(code.toLowerCase())) codes.push(code);
      const data = await Cart.update({ discount: codes.join(',') });
      const applied = (data.discount_codes || []).find((d) => d.code.toLowerCase() === code.toLowerCase());
      const errorEl = qs('[data-discount-error]', (scope && document.querySelector(`[data-cart-section="${scope.dataset.cartSection}"]`)) || document);
      if (errorEl && (!applied || !applied.applicable)) {
        errorEl.textContent = errorEl.dataset.invalidText;
        errorEl.hidden = false;
      }
    } catch (err) {
      toast(err.message);
    } finally {
      btn.classList.remove('is-loading');
    }
  });
  document.addEventListener('click', async (e) => {
    const rm = e.target.closest('[data-discount-remove]');
    if (!rm) return;
    e.preventDefault();
    const codes = currentCodes().filter((c) => c !== rm.dataset.discountRemove);
    try { await Cart.update({ discount: codes.join(',') }); } catch (err) { toast(err.message); }
  });

  /* Order note */
  document.addEventListener('input', debounce((e) => {
    const note = e.target.closest('[data-cart-note]');
    if (!note) return;
    fetch(`${theme.routes.cartUpdate}.js`, fetchConfig({ note: note.value }));
  }, 500));

  /* ==========================================================================
     Product: variant picker, gallery, sticky ATC
     ========================================================================== */
  class OnyxProduct extends HTMLElement {
    connectedCallback() {
      const json = qs('script[data-product-json]', this);
      if (!json) return;
      this.data = JSON.parse(json.textContent);
      this.form = qs('form[data-product-form]', this);
      this.idInput = this.form && qs('input[name="id"]', this.form);
      this.addEventListener('change', (e) => { if (e.target.closest('[data-option-index]')) this.onOptionChange(); });
      const initial = this.currentVariant();
      this.updateAvailability(initial);
      this.togglePaymentButton(!!(initial && initial.available));
      if (initial && initial.featured_media_id) {
        const gallery = qs('onyx-gallery', this);
        if (gallery && gallery.goToMedia) requestAnimationFrame(() => gallery.goToMedia(initial.featured_media_id, true));
      }
      this.initSticky();
    }
    selectedOptions() {
      return qsa('fieldset[data-option-index], [data-option-index].select', this)
        .sort((a, b) => a.dataset.optionIndex - b.dataset.optionIndex)
        .map((el) => (el.tagName === 'SELECT' ? el.value : (qs('input:checked', el) || {}).value));
    }
    currentVariant() {
      const id = this.idInput ? parseInt(this.idInput.value, 10) : null;
      return this.data.variants.find((v) => v.id === id);
    }
    onOptionChange() {
      const options = this.selectedOptions();
      const variant = this.data.variants.find((v) => v.options.every((o, i) => o === options[i]));
      qsa('fieldset[data-option-index]', this).forEach((fs) => {
        const label = qs('[data-selected-value]', fs);
        const checked = qs('input:checked', fs);
        if (label && checked) label.textContent = checked.value;
      });
      this.updateAvailability(variant, options);
      this.render(variant);
    }
    updateAvailability(variant, options = this.selectedOptions()) {
      // Mark option values that don't produce an available variant with the other current selections.
      qsa('fieldset[data-option-index]', this).forEach((fs) => {
        const index = parseInt(fs.dataset.optionIndex, 10);
        qsa('input', fs).forEach((input) => {
          const test = options.slice();
          test[index] = input.value;
          const match = this.data.variants.find((v) => v.options.every((o, i) => o === test[i]));
          input.classList.toggle('is-unavailable', !match || !match.available);
        });
      });
    }
    render(variant) {
      const btns = qsa('[data-add-button]', this.closest('[data-product-root]') || this);
      const btnLabels = qsa('[data-add-label]', this.closest('[data-product-root]') || this);
      if (!variant) {
        btns.forEach((b) => { b.disabled = true; });
        btnLabels.forEach((l) => (l.textContent = theme.strings.unavailable));
        this.setStock(null);
        this.togglePaymentButton(false);
        return;
      }
      if (this.idInput) {
        this.idInput.value = variant.id;
        this.idInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      qsa('form[data-product-form] input[name="id"]', this.closest('[data-product-root]') || this).forEach((i) => (i.value = variant.id));
      btns.forEach((b) => { b.disabled = !variant.available; });
      btnLabels.forEach((l) => (l.textContent = variant.available ? theme.strings.addToCart : theme.strings.soldOut));
      this.togglePaymentButton(variant.available);

      // Price
      qsa('[data-price]', this.closest('[data-product-root]') || this).forEach((el) => {
        const onSale = variant.compare_at_price && variant.compare_at_price > variant.price;
        el.classList.toggle('price--sale', !!onSale);
        let html = `<span class="price__current">${formatMoney(variant.price)}</span>`;
        if (onSale) {
          html += `<s class="price__compare"><span class="visually-hidden">${el.dataset.regularLabel || ''}</span>${formatMoney(variant.compare_at_price)}</s>`;
          if (el.dataset.showSave === 'true') {
            const pct = Math.round(((variant.compare_at_price - variant.price) * 100) / variant.compare_at_price);
            html += `<span class="price__save">${(el.dataset.saveTemplate || '-[pct]%').replace('[pct]', pct).replace('[amount]', formatMoney(variant.compare_at_price - variant.price))}</span>`;
          }
        }
        if (variant.unit_price_html) html += `<span class="price__unit">${variant.unit_price_html}</span>`;
        el.innerHTML = html;
      });

      // SKU
      qsa('[data-sku]', this).forEach((el) => { el.textContent = variant.sku || ''; el.closest('[data-sku-wrap]') && (el.closest('[data-sku-wrap]').hidden = !variant.sku); });

      this.setStock(variant);

      // Media
      if (variant.featured_media_id) {
        const gallery = qs('onyx-gallery', this.closest('[data-product-root]') || document);
        if (gallery) gallery.goToMedia(variant.featured_media_id);
      }

      // URL
      if (this.dataset.updateUrl !== 'false') {
        const url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url.toString());
      }
    }
    setStock(variant) {
      const el = qs('[data-stock]', this.closest('[data-product-root]') || this);
      if (!el) return;
      el.classList.remove('stock--low', 'stock--out');
      if (!variant) { el.hidden = true; return; }
      el.hidden = false;
      if (!variant.available) { el.classList.add('stock--out'); el.textContent = theme.strings.soldOut; return; }
      const threshold = parseInt(el.dataset.lowThreshold || '0', 10);
      if (variant.inventory_tracked && variant.inventory_quantity > 0 && variant.inventory_quantity <= threshold) {
        el.classList.add('stock--low');
        el.innerHTML = theme.strings.lowStock.replace('[count]', variant.inventory_quantity);
      } else {
        el.textContent = theme.strings.inStock;
      }
    }
    togglePaymentButton(enabled) {
      const pb = qs('.shopify-payment-button', this);
      if (!pb) return;
      pb.hidden = !enabled;
    }
    initSticky() {
      const sticky = qs('[data-sticky-atc]', this.closest('[data-product-root]') || document);
      const target = qs('[data-add-button]', this.form || this);
      if (!sticky || !target || !('IntersectionObserver' in window)) return;
      const footer = qs('.footer');
      let pastButton = false;
      let atFooter = false;
      const update = () => {
        const show = pastButton && !atFooter;
        sticky.classList.toggle('is-visible', show);
        sticky.setAttribute('aria-hidden', show ? 'false' : 'true');
        qsa('a, button, input', sticky).forEach((n) => (show ? n.removeAttribute('tabindex') : n.setAttribute('tabindex', '-1')));
      };
      new IntersectionObserver(([entry]) => { pastButton = !entry.isIntersecting && entry.boundingClientRect.top < 0; update(); }).observe(target);
      if (footer) new IntersectionObserver(([entry]) => { atFooter = entry.isIntersecting; update(); }).observe(footer);
      update();
    }
  }
  customElements.define('onyx-product', OnyxProduct);

  class OnyxGallery extends HTMLElement {
    connectedCallback() {
      this.track = qs('.gallery__slides', this);
      if (!this.track) return;
      this.slides = qsa('.gallery__slide', this);
      this.thumbs = qsa('[data-thumb]', this);
      this.dots = qsa('[data-dot]', this);
      this.thumbs.concat(this.dots).forEach((b) => b.addEventListener('click', () => this.goTo(parseInt(b.dataset.index, 10))));
      qsa('[data-gallery-step]', this).forEach((b) => b.addEventListener('click', () => this.goTo(this.index + parseInt(b.dataset.galleryStep, 10))));
      this.index = 0;
      this.track.addEventListener('scroll', debounce(() => this.syncFromScroll(), 60), { passive: true });
      this.track.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); this.goTo(this.index + 1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); this.goTo(this.index - 1); }
      });
      this.initZoom();
    }
    syncFromScroll() {
      const w = this.track.clientWidth;
      if (!w) return;
      const i = Math.round(Math.abs(this.track.scrollLeft) / w);
      this.setActive(i);
    }
    setActive(i) {
      this.index = i;
      this.thumbs.forEach((t, n) => t.setAttribute('aria-current', n === i ? 'true' : 'false'));
      this.dots.forEach((t, n) => t.setAttribute('aria-current', n === i ? 'true' : 'false'));
      this.slides.forEach((s, n) => {
        s.setAttribute('aria-hidden', n === i ? 'false' : 'true');
        const v = qs('video', s);
        if (v && n !== i) v.pause();
      });
    }
    goTo(i, instant = false) {
      const count = this.slides.length;
      if (!count) return;
      i = (i + count) % count;
      const dir = getComputedStyle(this.track).direction === 'rtl' ? -1 : 1;
      this.track.scrollTo({ left: this.track.clientWidth * i * dir, behavior: reducedMotion.matches || instant ? 'auto' : 'smooth' });
      this.setActive(i);
    }
    goToMedia(mediaId, instant = false) {
      if (!this.slides) return;
      const i = this.slides.findIndex((s) => s.dataset.mediaId === String(mediaId));
      if (i > -1 && i !== this.index) this.goTo(i, instant);
    }
    initZoom() {
      if (!window.matchMedia('(hover: hover) and (min-width: 990px)').matches) return;
      qsa('.gallery__zoom', this).forEach((z) => {
        z.addEventListener('click', () => z.classList.toggle('is-zoomed'));
        z.addEventListener('mousemove', (e) => {
          const r = z.getBoundingClientRect();
          z.style.setProperty('--zx', `${((e.clientX - r.left) / r.width) * 100}%`);
          z.style.setProperty('--zy', `${((e.clientY - r.top) / r.height) * 100}%`);
        });
        z.addEventListener('mouseleave', () => z.classList.remove('is-zoomed'));
        z.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); z.classList.toggle('is-zoomed'); } });
      });
    }
  }
  customElements.define('onyx-gallery', OnyxGallery);

  /* Product recommendations */
  class OnyxRecommendations extends HTMLElement {
    connectedCallback() {
      if (!this.dataset.url) return;
      const load = () => fetch(this.dataset.url).then((r) => r.text()).then((text) => {
        const fresh = qs('onyx-recommendations', parseHTML(text));
        if (fresh && fresh.innerHTML.trim().length) {
          this.innerHTML = fresh.innerHTML;
          Reveal.observe(this);
          Wishlist.sync();
        } else {
          (this.closest('.shopify-section') || this).hidden = true;
        }
      }).catch(() => {});
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) { io.disconnect(); load(); } }, { rootMargin: '0px 0px 600px 0px' });
        io.observe(this);
      } else load();
    }
  }
  customElements.define('onyx-recommendations', OnyxRecommendations);

  /* ==========================================================================
     Tabs
     ========================================================================== */
  class OnyxTabs extends HTMLElement {
    connectedCallback() {
      this.tabs = qsa('[role="tab"]', this);
      this.tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => this.select(i));
        tab.addEventListener('keydown', (e) => {
          let n = null;
          if (e.key === 'ArrowRight') n = (i + 1) % this.tabs.length;
          if (e.key === 'ArrowLeft') n = (i - 1 + this.tabs.length) % this.tabs.length;
          if (e.key === 'Home') n = 0;
          if (e.key === 'End') n = this.tabs.length - 1;
          if (n !== null) { e.preventDefault(); this.select(n); this.tabs[n].focus(); }
        });
      });
    }
    select(i) {
      this.tabs.forEach((tab, n) => {
        const selected = n === i;
        tab.setAttribute('aria-selected', selected ? 'true' : 'false');
        tab.tabIndex = selected ? 0 : -1;
        const panel = document.getElementById(tab.getAttribute('aria-controls'));
        if (panel) panel.hidden = !selected;
      });
      qsa('[data-tab-link]', this).forEach((l, n) => (l.hidden = n !== i));
    }
  }
  customElements.define('onyx-tabs', OnyxTabs);

  /* ==========================================================================
     Countdown (genuine end date set by merchant)
     ========================================================================== */
  class OnyxCountdown extends HTMLElement {
    connectedCallback() {
      this.end = Date.parse(this.dataset.end);
      if (Number.isNaN(this.end)) { this.hidden = true; return; }
      this.parts = { d: qs('[data-d]', this), h: qs('[data-h]', this), m: qs('[data-m]', this), s: qs('[data-s]', this) };
      this.tick();
      this.timer = setInterval(() => this.tick(), 1000);
    }
    disconnectedCallback() { clearInterval(this.timer); }
    tick() {
      const diff = this.end - Date.now();
      if (diff <= 0) {
        clearInterval(this.timer);
        const section = this.closest('[data-hide-when-expired]');
        if (section) section.hidden = true; else this.hidden = true;
        return;
      }
      const pad = (n) => String(n).padStart(2, '0');
      const s = Math.floor(diff / 1000);
      this.parts.d.textContent = pad(Math.floor(s / 86400));
      this.parts.h.textContent = pad(Math.floor((s % 86400) / 3600));
      this.parts.m.textContent = pad(Math.floor((s % 3600) / 60));
      this.parts.s.textContent = pad(s % 60);
    }
  }
  customElements.define('onyx-countdown', OnyxCountdown);

  /* ==========================================================================
     Collection filters (Section Rendering API, no full reload)
     ========================================================================== */
  class OnyxFacets extends HTMLElement {
    connectedCallback() {
      this.sectionId = this.dataset.sectionId;
      this.onChange = debounce(this.onChange.bind(this), 450);
      this.addEventListener('change', (e) => { if (e.target.closest('form[data-facets-form]') || e.target.closest('[data-sort]')) this.onChange(e); });
      this.addEventListener('input', (e) => { if (e.target.matches('[data-price-input]')) this.onChange(e); });
      this.addEventListener('submit', (e) => { if (e.target.closest('form[data-facets-form]')) { e.preventDefault(); this.onChange(e); } });
      this.addEventListener('click', (e) => {
        const link = e.target.closest('[data-facet-link]');
        if (!link) return;
        e.preventDefault();
        const fromPagination = !!link.closest('[data-pagination]');
        this.load(new URL(link.href, window.location.origin).searchParams.toString()).then(() => {
          if (fromPagination) this.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
        });
      });
      window.addEventListener('popstate', (e) => { if (e.state && e.state.facets !== undefined) this.load(e.state.facets, false); });
    }
    onChange(e) {
      const form = (e && e.target.closest && e.target.closest('form[data-facets-form]')) || qs('form[data-facets-form]', this);
      const params = new URLSearchParams(new FormData(form));
      // Merge sort and drop empty price fields
      const sort = qs('[data-sort]', this);
      if (sort && sort.value) params.set('sort_by', sort.value);
      Array.from(params.keys()).forEach((k) => { if (params.get(k) === '') params.delete(k); });
      // Sync duplicate filter forms (drawer vs sidebar)
      this.load(params.toString());
    }
    async load(search, push = true) {
      const grid = qs('[data-collection-grid]', this);
      if (grid) grid.classList.add('is-loading');
      try {
        const res = await fetch(`${window.location.pathname}?section_id=${this.sectionId}&${search}`);
        const doc = parseHTML(await res.text());
        ['[data-collection-grid]', '[data-facets-sidebar]', '[data-facets-drawer-body]', '[data-active-filters]', '[data-product-count]', '[data-pagination]'].forEach((sel) => {
          const fresh = qs(sel, doc);
          const current = qs(sel, this);
          if (fresh && current) current.innerHTML = fresh.innerHTML;
        });
        if (push) window.history.pushState({ facets: search }, '', `${window.location.pathname}${search ? `?${search}` : ''}`);
        Reveal.observe(this);
        Wishlist.sync();
      } catch (err) {
        window.location.search = search;
      } finally {
        const g = qs('[data-collection-grid]', this);
        if (g) g.classList.remove('is-loading');
      }
    }
  }
  customElements.define('onyx-facets', OnyxFacets);

  /* ==========================================================================
     Wishlist (stored in this browser via localStorage)
     ========================================================================== */
  const Wishlist = {
    key: 'onyx:wishlist',
    get() {
      try { return JSON.parse(localStorage.getItem(this.key)) || []; } catch (e) { return []; }
    },
    set(list) {
      try { localStorage.setItem(this.key, JSON.stringify(list)); } catch (e) { /* storage unavailable */ }
      this.sync();
    },
    toggle(handle) {
      const list = this.get();
      const i = list.indexOf(handle);
      if (i > -1) list.splice(i, 1); else list.unshift(handle);
      this.set(list.slice(0, 60));
      return i === -1;
    },
    sync() {
      const list = this.get();
      qsa('[data-wishlist-toggle]').forEach((b) => {
        const on = list.includes(b.dataset.handle);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.setAttribute('aria-label', `${on ? theme.strings.wishlistRemove : theme.strings.wishlistAdd}${b.dataset.title ? `: ${b.dataset.title}` : ''}`);
        const label = qs('[data-wishlist-label]', b);
        if (label) label.textContent = on ? theme.strings.wishlistRemove : theme.strings.wishlistAdd;
      });
      qsa('[data-wishlist-count]').forEach((c) => { c.textContent = list.length || ''; c.dataset.count = list.length; });
    }
  };
  theme.Wishlist = Wishlist;
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-wishlist-toggle]');
    if (!b) return;
    e.preventDefault();
    const added = Wishlist.toggle(b.dataset.handle);
    toast(added ? theme.strings.wishlistAdd + ' ✓' : theme.strings.wishlistRemove + ' ✓');
    const page = b.closest('onyx-wishlist-page');
    if (page && !added) page.render();
  });

  class OnyxWishlistPage extends HTMLElement {
    connectedCallback() { this.render(); }
    async render() {
      const grid = qs('[data-wishlist-grid]', this);
      const empty = qs('[data-wishlist-empty]', this);
      const list = Wishlist.get();
      if (!list.length) { grid.innerHTML = ''; empty.hidden = false; return; }
      empty.hidden = true;
      grid.innerHTML = list.map(() => '<div class="skeleton" style="aspect-ratio:.72"></div>').join('');
      const cards = await Promise.all(list.map((handle) =>
        fetch(`${theme.routes.root.replace(/\/$/, '')}/products/${encodeURIComponent(handle)}?view=card`)
          .then((r) => (r.ok ? r.text() : ''))
          .catch(() => '')
      ));
      const valid = cards.filter((html) => html.trim().length);
      grid.innerHTML = valid.join('');
      if (!valid.length) empty.hidden = false;
      Wishlist.sync();
    }
  }
  customElements.define('onyx-wishlist-page', OnyxWishlistPage);

  /* ==========================================================================
     Share
     ========================================================================== */
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-share]');
    if (!b) return;
    e.preventDefault();
    const data = { title: b.dataset.title || document.title, url: b.dataset.url || window.location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(data.url); toast(theme.strings.copied); }
    } catch (err) { /* cancelled */ }
  });

  /* ==========================================================================
     Reveal on scroll
     ========================================================================== */
  const Reveal = {
    io: null,
    observe(root = document) {
      const els = qsa('.reveal:not(.is-visible)', root);
      if (!document.body.classList.contains('has-motion') || reducedMotion.matches || !('IntersectionObserver' in window)) {
        els.forEach((el) => el.classList.add('is-visible'));
        return;
      }
      if (!this.io) {
        this.io = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) { entry.target.classList.add('is-visible'); this.io.unobserve(entry.target); }
          });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
      }
      els.forEach((el) => this.io.observe(el));
    }
  };

  /* ==========================================================================
     Init + theme editor support
     ========================================================================== */
  const init = () => {
    Reveal.observe();
    Wishlist.sync();
    if (window.matchMedia('(max-width: 749px)').matches) qsa('.footer details[open]').forEach((d) => d.removeAttribute('open'));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  document.addEventListener('shopify:section:load', (e) => { Reveal.observe(e.target); Wishlist.sync(); });
  document.addEventListener('shopify:block:select', (e) => {
    const slide = e.target.closest('.announcement__item');
    if (slide) slide.classList.add('is-active');
  });
  document.addEventListener('cart:updated', () => Wishlist.sync());
})();
