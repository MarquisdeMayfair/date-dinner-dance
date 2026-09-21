import { trackMeta } from "./pixel";
import { renderStoryCard, storyFile } from "./story";

type VenueImage = {
  url: string;
  alt?: string;
};

type VenueVerify = {
  confidence: number;
  checked_at: string;
  image_ok?: boolean;
  notes?: string;
  sources?: string[];
};

type Venue = {
  id: string;
  name: string;
  area: string;
  vibe: string;
  website?: string;
  instagram?: string;
  instagram_followers?: number;
  tripadvisor?: string;
  tripadvisor_rating?: number;
  tripadvisor_reviews?: number;
  images: VenueImage[];
  verified?: VenueVerify;
};

type Catalog = {
  date: Venue[];
  dinner: Venue[];
  dance: Venue[];
};

type ReelKey = keyof Catalog;

type City = {
  id: string;
  name: string;
};

const LABELS: Record<ReelKey, string> = {
  date: "Date",
  dinner: "Dinner",
  dance: "Dance",
};

const COPIES = 3;

const chevronUp = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 14.5 12 8.5l6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const chevronDown = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9.5 12 15.5l6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function randomIndex(count: number, avoid?: number): number {
  if (count <= 1) return 0;
  let next = Math.floor(Math.random() * count);
  if (avoid === undefined) return next;
  for (let i = 0; i < 8 && next === avoid; i += 1) {
    next = Math.floor(Math.random() * count);
  }
  return next === avoid ? (avoid + 1) % count : next;
}

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - 2 ** (-10 * t);
}

function cardHeight(windowEl: HTMLElement): number {
  return Math.round(windowEl.clientHeight);
}

const iconGlobe = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.8 2.7 4.2 5.8 4.2 9s-1.4 6.3-4.2 9c-2.8-2.7-4.2-5.8-4.2-9s1.4-6.3 4.2-9Z"/></svg>`;
const iconInstagram = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><circle cx="12" cy="12" r="3.7"/><circle cx="17.3" cy="6.7" r="1.05" fill="currentColor" stroke="none"/></svg>`;

function linkIcon(href: string, label: string, icon: string, proof = ""): string {
  const extra = proof ? `<span class="proof">${escapeHtml(proof)}</span>` : "";
  const cls = proof ? ' class="has-proof"' : "";
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"${cls} aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${icon}${extra}</a>`;
}

function compactCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value >= 1_000_000) {
    const scaled = value / 1_000_000;
    return `${scaled >= 10 ? Math.round(scaled) : scaled.toFixed(1).replace(/\.0$/, "")}m`;
  }
  if (value >= 1000) {
    const scaled = value / 1000;
    return `${scaled >= 100 ? Math.round(scaled) : scaled.toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(Math.round(value));
}

function instagramProof(venue: Venue): string {
  return compactCount(venue.instagram_followers || 0);
}

function tripadvisorProof(venue: Venue): string {
  const rating = venue.tripadvisor_rating;
  if (typeof rating !== "number" || rating < 1 || rating > 5) return "";
  const score = rating.toFixed(1);
  const reviews = compactCount(venue.tripadvisor_reviews || 0);
  return reviews ? `${score} · ${reviews}` : score;
}

const iconStar = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.6 14.5 9l6 .6-4.6 4 1.4 5.8L12 16.8 6.7 19.4 8.1 13.6 3.5 9.6l6-.6L12 3.6Z"/></svg>`;

function renderReveal(venue: Venue): string {
  const links: string[] = [];
  if (venue.website) links.push(linkIcon(venue.website, `${venue.name} website`, iconGlobe));
  if (venue.instagram) {
    const followers = instagramProof(venue);
    links.push(
      linkIcon(
        venue.instagram,
        followers ? `${venue.name} Instagram, ${followers} followers` : `${venue.name} Instagram`,
        iconInstagram,
        followers,
      ),
    );
  }
  if (venue.tripadvisor) {
    const score = tripadvisorProof(venue);
    if (score) {
      links.push(linkIcon(venue.tripadvisor, `${venue.name} Tripadvisor ${score}`, iconStar, score));
    }
  }
  return `
    <h3>${escapeHtml(venue.name)}</h3>
    ${venue.area ? `<p class="area">${escapeHtml(venue.area)}</p>` : ""}
    ${venue.vibe ? `<p class="vibe">${escapeHtml(venue.vibe)}</p>` : ""}
    ${links.length ? `<div class="links">${links.join("")}</div>` : ""}
  `;
}

function renderCard(venue: Venue): string {
  const image = venue.images[0];
  const fallback = venue.images[1]?.url || "";
  const alt = escapeHtml(image?.alt || venue.name);
  const img = image
    ? `<img alt="${alt}" draggable="false" decoding="async" referrerpolicy="no-referrer" data-src="${escapeHtml(image.url)}" data-fallback="${escapeHtml(fallback)}">`
    : `<div class="card-fallback">${escapeHtml(venue.name)}</div>`;
  return `<div class="card" data-id="${escapeHtml(venue.id)}">${img}</div>`;
}

const catalogCache = new Map<string, Catalog>();

function nightParams(cityId: string, reels: Reel[]): URLSearchParams {
  const params = new URLSearchParams();
  params.set("c", cityId);
  reels.forEach((reel) => params.set(reel.key, reel.current.id));
  return params;
}

function nightURL(cityId: string, reels: Reel[]): string {
  const url = new URL(window.location.origin + window.location.pathname);
  nightParams(cityId, reels).forEach((value, key) => url.searchParams.set(key, value));
  return url.toString();
}

function planURL(cityId: string): string {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set("c", cityId);
  return url.toString();
}

function setMeta(key: string, content: string, attr: "property" | "name" = "property") {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.append(el);
  }
  el.content = content;
}

function writeShareMeta(url: string, title: string, description: string, photo?: string) {
  const image = photo
    ? /^https?:/i.test(photo)
      ? photo
      : `${window.location.origin}${photo.startsWith("/") ? photo : `/${photo}`}`
    : `${window.location.origin}/og.png`;
  setMeta("og:url", url);
  setMeta("og:title", title);
  setMeta("og:description", description);
  setMeta("og:image", image);
  setMeta("twitter:title", title, "name");
  setMeta("twitter:description", description, "name");
  setMeta("twitter:image", image, "name");
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonical) canonical.href = url;
}

function itineraryLine(city: string): string {
  return `My perfect ${city} day`;
}

function dareLine(cityId: string, reels: Reel[]): string {
  const names = reels.map((reel) => reel.current.name).join(" · ");
  return `Hey let's go\n${names}\nYour day → ${planURL(cityId)}`;
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.left = "-9999px";
    document.body.append(field);
    field.select();
    const ok = document.execCommand("copy");
    field.remove();
    return ok;
  }
}

class Reel {
  readonly key: ReelKey;
  readonly items: Venue[];
  index: number;
  private readonly root: HTMLElement;
  private readonly windowEl: HTMLElement;
  private readonly stripEl: HTMLElement;
  private readonly revealEl: HTMLElement;
  private animating = false;
  private offset = 0;
  private resizeObserver: ResizeObserver | null = null;
  private fitFrame = 0;

  constructor(key: ReelKey, items: Venue[], mount: HTMLElement, startIndex?: number) {
    this.key = key;
    this.items = items;
    this.index = startIndex ?? randomIndex(items.length);
    this.root = document.createElement("section");
    this.root.className = "reel";
    this.root.dataset.reel = key;
    this.root.innerHTML = `
      <div class="media">
        <div class="nudges">
          <button type="button" class="nudge" data-dir="-1" aria-label="Previous ${LABELS[key]}">${chevronUp}</button>
          <button type="button" class="nudge" data-dir="1" aria-label="Next ${LABELS[key]}">${chevronDown}</button>
        </div>
        <div class="window-wrap">
          <div class="window" aria-live="polite">
            <div class="strip"></div>
          </div>
        </div>
      </div>
      <div class="copy">
        <div class="reel-label">${LABELS[key]}</div>
        <div class="reveal"></div>
      </div>
    `;
    mount.append(this.root);
    this.windowEl = this.root.querySelector(".window") as HTMLElement;
    this.stripEl = this.root.querySelector(".strip") as HTMLElement;
    this.revealEl = this.root.querySelector(".reveal") as HTMLElement;
    this.paintStrip();
    this.syncCardHeights();
    this.syncOffset();
    this.hydrateImages();
    this.showReveal();
    this.bind();
    this.resizeObserver = new ResizeObserver(() => {
      this.syncCardHeights();
      this.syncOffset();
      this.fitVibe();
    });
    this.resizeObserver.observe(this.windowEl);
    this.resizeObserver.observe(this.revealEl);
    requestAnimationFrame(() => this.layout());
  }

  get current(): Venue {
    return this.items[this.index];
  }

  get busy(): boolean {
    return this.animating;
  }

  destroy(): void {
    cancelAnimationFrame(this.fitFrame);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.root.remove();
  }

  hydrateImages(all = false): void {
    const wanted = new Set<string>();
    if (all) {
      this.items.forEach((item) => wanted.add(item.id));
    } else {
      for (let delta = -2; delta <= 2; delta += 1) {
        const item = this.items[(this.index + delta + this.items.length) % this.items.length];
        if (item) wanted.add(item.id);
      }
    }
    this.stripEl.querySelectorAll("img").forEach((img) => {
      const id = img.closest(".card")?.getAttribute("data-id");
      if (!id || !wanted.has(id) || !img.dataset.src || img.getAttribute("src")) return;
      img.src = img.dataset.src;
    });
  }

  private paintStrip(): void {
    const copies = Array.from({ length: COPIES }, () => this.items.map(renderCard).join(""));
    this.stripEl.innerHTML = copies.join("");
    this.stripEl.querySelectorAll("img").forEach((img) => {
      img.addEventListener("error", () => {
        const next = img.dataset.fallback;
        if (next) {
          img.dataset.fallback = "";
          img.src = next;
          return;
        }
        const card = img.closest(".card");
        if (!card) return;
        const name = this.items.find((item) => item.id === card.getAttribute("data-id"))?.name;
        card.innerHTML = `<div class="card-fallback">${escapeHtml(name || "")}</div>`;
      });
    });
  }

  private middleBase(): number {
    return this.items.length * Math.floor(COPIES / 2);
  }

  private syncCardHeights(): void {
    const height = cardHeight(this.windowEl);
    if (!height) return;
    this.windowEl.style.setProperty("--card-h", `${height}px`);
    this.stripEl.querySelectorAll<HTMLElement>(".card").forEach((card) => {
      card.style.height = `${height}px`;
    });
  }

  layout(): void {
    this.syncCardHeights();
    this.syncOffset();
    this.fitVibe();
  }

  private applyOffset(value: number): void {
    this.offset = value;
    const height = cardHeight(this.windowEl);
    const cycle = this.items.length * height;
    const phase = cycle === 0 ? 0 : ((value % cycle) + cycle) % cycle;
    const visual = this.middleBase() * height + phase;
    this.stripEl.style.transform = `translate3d(0, ${-visual}px, 0)`;
  }

  syncOffset(): void {
    this.stripEl.style.transition = "none";
    this.applyOffset(this.index * cardHeight(this.windowEl));
  }

  showReveal(): void {
    this.revealEl.classList.remove("is-pending");
    this.revealEl.innerHTML = renderReveal(this.current);
    this.fitVibe();
  }

  private fitVibe(): void {
    cancelAnimationFrame(this.fitFrame);
    this.fitFrame = requestAnimationFrame(() => {
      const vibe = this.revealEl.querySelector<HTMLElement>(".vibe");
      if (!vibe) return;
      vibe.style.maxHeight = "none";
      vibe.style.setProperty("-webkit-line-clamp", "8");
      const available = vibe.clientHeight;
      if (available <= 0) return;
      const range = document.createRange();
      range.selectNodeContents(vibe);
      const rects = [...range.getClientRects()].filter((rect, index, all) => {
        return all.findIndex((other) => Math.abs(other.top - rect.top) < 1) === index;
      });
      const stride = rects.length > 1 ? rects[1].top - rects[0].top : rects[0]?.height || 0;
      if (!Number.isFinite(stride) || stride <= 0) return;
      const lines = Math.max(1, Math.floor((available + 0.5) / stride));
      const boxTop = vibe.getBoundingClientRect().top;
      const next = rects[lines];
      const cap = next ? Math.floor(next.top - boxTop) : Math.floor(lines * stride);
      vibe.style.maxHeight = `${Math.max(Math.floor(stride), cap)}px`;
      vibe.style.setProperty("-webkit-line-clamp", String(lines));
      vibe.style.setProperty("line-clamp", String(lines));
    });
  }

  hideReveal(): void {
    this.revealEl.classList.add("is-pending");
  }

  async spinTo(index: number, duration: number): Promise<void> {
    if (this.animating || this.items.length < 2) {
      this.index = index;
      this.syncOffset();
      this.showReveal();
      return;
    }
    const loops = 7 + Math.floor(Math.random() * 3);
    const forward = (index - this.index + this.items.length) % this.items.length || this.items.length;
    const distanceCards = loops * this.items.length + forward;
    this.hydrateImages(true);
    await this.animateBy(distanceCards, duration);
    this.index = index;
    this.syncOffset();
    this.hydrateImages();
    this.showReveal();
  }

  async nudge(dir: 1 | -1): Promise<void> {
    if (this.animating || this.items.length < 2) return;
    this.hideReveal();
    const next = (this.index + dir + this.items.length) % this.items.length;
    await this.animateBy(dir, 280);
    this.index = next;
    this.syncOffset();
    this.hydrateImages();
    this.showReveal();
    this.root.dispatchEvent(new CustomEvent("ddd-pick", { bubbles: true }));
    if ("vibrate" in navigator) navigator.vibrate(8);
  }

  private animateBy(cards: number, duration: number): Promise<void> {
    this.animating = true;
    this.hideReveal();
    const start = this.offset;
    const end = start + cards * cardHeight(this.windowEl);
    const t0 = performance.now();
    return new Promise((resolve) => {
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / duration);
        const eased = duration > 500 ? easeOutExpo(t) : 1 - (1 - t) ** 3;
        this.applyOffset(start + (end - start) * eased);
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          this.animating = false;
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  private bind(): void {
    this.root.querySelectorAll<HTMLButtonElement>(".nudge").forEach((button) => {
      button.addEventListener("click", () => {
        const dir = Number(button.dataset.dir) === -1 ? -1 : 1;
        void this.nudge(dir);
      });
    });

    let startY = 0;
    let tracking = false;
    this.windowEl.addEventListener(
      "pointerdown",
      (event) => {
        if (this.animating) return;
        tracking = true;
        startY = event.clientY;
        this.windowEl.setPointerCapture(event.pointerId);
      },
      { passive: true },
    );
    this.windowEl.addEventListener("pointerup", (event) => {
      if (!tracking) return;
      tracking = false;
      const dy = event.clientY - startY;
      if (Math.abs(dy) < 28) return;
      void this.nudge(dy < 0 ? 1 : -1);
    });
    this.windowEl.addEventListener("pointercancel", () => {
      tracking = false;
    });
  }
}

const DATA_VER = "20260921a";

function isOsmLeftover(vibe: string): boolean {
  const text = vibe.trim();
  if (!text) return true;
  const words = text.replace(/\.$/, "").split(/\s+/);
  if (/^[A-Za-z][A-Za-z /]*\.?$/.test(text) && words.length <= 3) return true;
  if (/^(adult )?nightclub\b/i.test(text) && words.length <= 6) return true;
  if (
    /\bin (Manhattan|Brooklyn|Queens|The Bronx|Bronx|Staten Island|London|Manchester|Ibiza)\s*\.?$/i.test(text) &&
    words.length <= 6
  ) {
    return true;
  }
  return false;
}

function scrubCatalog(catalog: Catalog): Catalog {
  const next = {} as Catalog;
  (Object.keys(catalog) as ReelKey[]).forEach((key) => {
    next[key] = (catalog[key] || []).filter((venue) => venue.name && !isOsmLeftover(venue.vibe || ""));
  });
  return next;
}

async function loadCities(): Promise<City[]> {
  const response = await fetch(`/cities.json?v=${DATA_VER}`, { cache: "reload" });
  if (!response.ok) throw new Error("Could not load cities");
  const cities = (await response.json()) as City[];
  return cities.filter((city) => city.id && city.name);
}

async function loadCatalog(cityId: string): Promise<Catalog> {
  const cached = catalogCache.get(cityId);
  if (cached) return cached;
  const response = await fetch(`/data/${encodeURIComponent(cityId)}.json?v=${DATA_VER}`, { cache: "reload" });
  if (!response.ok) throw new Error(`Could not load ${cityId} venues`);
  const catalog = scrubCatalog((await response.json()) as Catalog);
  catalogCache.set(cityId, catalog);
  return catalog;
}

function prefetchCatalog(cityId: string): void {
  if (catalogCache.has(cityId)) return;
  void loadCatalog(cityId).catch(() => undefined);
}

function validate(catalog: Catalog): void {
  (Object.keys(catalog) as ReelKey[]).forEach((key) => {
    if (!Array.isArray(catalog[key]) || catalog[key].length === 0) {
      throw new Error(`Missing ${key} venues`);
    }
  });
}

function cityFromLocation(cities: City[]): string {
  const queryCity = new URLSearchParams(window.location.search).get("c")?.toLowerCase();
  if (queryCity && cities.some((city) => city.id === queryCity)) return queryCity;
  const hash = window.location.hash.replace("#", "").toLowerCase();
  if (cities.some((city) => city.id === hash)) return hash;
  try {
    const stored = localStorage.getItem("ddd-city");
    if (stored && cities.some((city) => city.id === stored)) return stored;
  } catch {
    /* ignore */
  }
  return cities[0]?.id || "ibiza";
}

function paintCityPicker(cities: City[], activeId: string): void {
  const scroller = document.querySelector<HTMLElement>("#city-scroller");
  const dots = document.querySelector<HTMLElement>("#city-dots");
  if (!scroller || !dots) return;
  scroller.innerHTML = cities
    .map(
      (city) =>
        `<div class="city-slide" role="tab" tabindex="0" data-city="${escapeHtml(city.id)}" aria-selected="${city.id === activeId}">${escapeHtml(city.name)}</div>`,
    )
    .join("");
  dots.innerHTML = cities
    .map((city) => `<span class="city-dot${city.id === activeId ? " is-on" : ""}" data-city="${escapeHtml(city.id)}"></span>`)
    .join("");
}

function cityIndexFromScroll(scroller: HTMLElement, count: number): number {
  const width = scroller.clientWidth;
  if (!width || count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(scroller.scrollLeft / width)));
}

function scrollCityIntoView(cityId: string, cities: City[], smooth = false): void {
  const scroller = document.querySelector<HTMLElement>("#city-scroller");
  if (!scroller) return;
  const index = cities.findIndex((city) => city.id === cityId);
  if (index < 0) return;
  const left = index * scroller.clientWidth;
  scroller.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
}

function nearestCityId(cities: City[]): string {
  const scroller = document.querySelector<HTMLElement>("#city-scroller");
  if (!scroller) return cities[0].id;
  return cities[cityIndexFromScroll(scroller, cities.length)]?.id || cities[0].id;
}

async function boot(): Promise<void> {
  const mount = document.querySelector<HTMLElement>("#reels");
  const spin = document.querySelector<HTMLButtonElement>("#spin");
  const scroller = document.querySelector<HTMLElement>("#city-scroller");
  if (!mount || !spin || !scroller) return;

  const cities = await loadCities();
  if (!cities.length) throw new Error("No cities configured");

  let reels: Reel[] = [];
  let cityId = cityFromLocation(cities);
  let switching = false;
  let programmatic = false;
  let pendingCity: string | null = null;
  let settleTimer = 0;
  let programTimer = 0;
  const shareBtn = document.querySelector<HTMLButtonElement>("#share");
  const dock = document.querySelector<HTMLElement>(".dock");
  const setShareVisible = (visible: boolean) => {
    if (!shareBtn) return;
    shareBtn.hidden = !visible;
    dock?.classList.toggle("has-night", visible);
  };

  const sendHit = (payload: Record<string, string | undefined>) => {
    try {
      navigator.sendBeacon("/api/hit", new Blob([JSON.stringify(payload)], { type: "application/json" }));
    } catch {
      void fetch("/api/hit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => undefined);
    }
  };

  const setDots = (id: string) => {
    document.querySelectorAll(".city-dot").forEach((dot) => {
      dot.classList.toggle("is-on", dot.getAttribute("data-city") === id);
    });
    document.querySelectorAll(".city-slide").forEach((slide) => {
      slide.setAttribute("aria-selected", String(slide.getAttribute("data-city") === id));
    });
  };

  const markProgrammatic = (smooth: boolean) => {
    programmatic = true;
    window.clearTimeout(programTimer);
    programTimer = window.setTimeout(() => {
      programmatic = false;
    }, smooth ? 450 : 80);
  };

  const loadCity = async (id: string, opts: { smooth?: boolean; fromScroll?: boolean } = {}) => {
    const city = cities.find((item) => item.id === id);
    if (!city) return;
    if (id === cityId && reels.length) {
      if (!opts.fromScroll) {
        markProgrammatic(!!opts.smooth);
        scrollCityIntoView(id, cities, opts.smooth);
      }
      return;
    }
    if (switching) {
      pendingCity = id;
      setDots(id);
      return;
    }
    switching = true;
    cityId = id;
    pendingCity = null;
    setDots(id);
    if (!opts.fromScroll) {
      markProgrammatic(!!opts.smooth);
      scrollCityIntoView(id, cities, opts.smooth);
    }
    try {
      localStorage.setItem("ddd-city", id);
    } catch {
      /* ignore */
    }
    const changingCity = reels.length > 0;
    const startIds = Object.fromEntries(
      (Object.keys(LABELS) as ReelKey[]).map((key) => [key, new URLSearchParams(window.location.search).get(key)]),
    ) as Record<ReelKey, string | null>;
    const nextURL = new URL(window.location.href);
    nextURL.searchParams.set("c", id);
    if (changingCity) {
      (["date", "dinner", "dance"] as ReelKey[]).forEach((key) => nextURL.searchParams.delete(key));
    }
    nextURL.hash = "";
    history.replaceState(null, "", `${nextURL.pathname}?${nextURL.searchParams.toString()}`);
    document.title = `date dinner dance — ${city.name}`;

    try {
      const catalog = await loadCatalog(id);
      if (cityId !== id) return;
      validate(catalog);
      reels.forEach((reel) => reel.destroy());
      mount.innerHTML = "";
      const starts = (Object.keys(LABELS) as ReelKey[]).map((key) => {
        if (changingCity) return undefined;
        const venueId = startIds[key];
        if (!venueId) return undefined;
        const index = catalog[key].findIndex((item) => item.id === venueId);
        return index >= 0 ? index : undefined;
      });
      reels = (Object.keys(LABELS) as ReelKey[]).map(
        (key, i) => new Reel(key, catalog[key], mount, starts[i]),
      );
      setShareVisible(starts.some((index) => index !== undefined));
      if (starts.every((index) => index !== undefined)) queueMicrotask(() => trackOpenOnce());
      cities.forEach((item) => prefetchCatalog(item.id));
      trackMeta("ViewContent", {
        content_name: city.name,
        content_category: "city",
        content_ids: id,
      });
      sendHit({ kind: "city", city: id });
    } finally {
      switching = false;
      const queued = pendingCity;
      pendingCity = null;
      if (queued && queued !== cityId) void loadCity(queued, { fromScroll: true });
    }
  };

  paintCityPicker(cities, cityId);
  await loadCity(cityId);

  const snapActiveCity = () => {
    markProgrammatic(false);
    scrollCityIntoView(cityId, cities, false);
    reels.forEach((reel) => reel.layout());
  };
  window.addEventListener("resize", snapActiveCity);

  const settleCity = () => {
    programmatic = false;
    const next = nearestCityId(cities);
    setDots(next);
    if (next !== cityId) void loadCity(next, { fromScroll: true });
  };

  scroller.addEventListener(
    "scroll",
    () => {
      if (!programmatic) setDots(nearestCityId(cities));
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(settleCity, 120);
    },
    { passive: true },
  );
  scroller.addEventListener("scrollend", () => {
    window.clearTimeout(settleTimer);
    settleCity();
  });

  document.querySelectorAll<HTMLButtonElement>(".city-chevron").forEach((button) => {
    button.addEventListener("click", () => {
      const dir = Number(button.dataset.dir) === -1 ? -1 : 1;
      const index = cities.findIndex((city) => city.id === cityId);
      const next = cities[(index + dir + cities.length) % cities.length];
      void loadCity(next.id, { smooth: true });
    });
  });

  const pickSlide = (city: string | undefined) => {
    if (!city) return;
    void loadCity(city, { smooth: true });
  };

  let pointerX = 0;
  let dragged = false;
  scroller.addEventListener("pointerdown", (event) => {
    pointerX = event.clientX;
    dragged = false;
  });
  scroller.addEventListener(
    "pointermove",
    (event) => {
      if (Math.abs(event.clientX - pointerX) > 8) dragged = true;
    },
    { passive: true },
  );

  scroller.addEventListener("click", (event) => {
    if (dragged) {
      event.preventDefault();
      dragged = false;
      return;
    }
    const slide = (event.target as HTMLElement).closest<HTMLElement>(".city-slide");
    pickSlide(slide?.dataset.city);
  });

  scroller.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const slide = (event.target as HTMLElement).closest<HTMLElement>(".city-slide");
    if (!slide?.dataset.city) return;
    event.preventDefault();
    pickSlide(slide.dataset.city);
  });

  const cityName = () => cities.find((city) => city.id === cityId)?.name || cityId;

  const trackNight = (kind: "open" | "share" | "spin", channel?: string) => {
    if (reels.length < 3) return;
    sendHit({
      kind,
      channel,
      city: cityId,
      date: reels.find((reel) => reel.key === "date")?.current.id,
      dinner: reels.find((reel) => reel.key === "dinner")?.current.id,
      dance: reels.find((reel) => reel.key === "dance")?.current.id,
    });
  };

  const trackOpenOnce = () => {
    if (reels.length < 3) return;
    const key = `ddd-open:${cityId}|${reels.map((reel) => reel.current.id).join("|")}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* still count this open */
    }
    trackNight("open");
  };

  const writeNightURL = () => {
    if (!reels.length) return;
    const url = nightURL(cityId, reels);
    history.replaceState(null, "", url.replace(window.location.origin, ""));
    writeShareMeta(
      url,
      itineraryLine(cityName()),
      `${reels.map((reel) => reel.current.name).join(" · ")} — Hey let's go`,
      reels.find((reel) => reel.key === "dinner")?.current.images[0]?.url || reels[0]?.current.images[0]?.url,
    );
  };

  spin.addEventListener("click", async () => {
    if (switching || reels.some((reel) => reel.busy)) return;
    spin.disabled = true;
    spin.classList.add("is-spinning");
    reels.forEach((reel) => reel.hydrateImages(true));
    await Promise.all(
      reels.map((reel, i) => {
        const next = randomIndex(reel.items.length, reel.index);
        return reel.spinTo(next, 2200 + i * 480);
      }),
    );
    spin.disabled = false;
    spin.classList.remove("is-spinning");
    writeNightURL();
    setShareVisible(true);
    trackNight("spin");
    trackMeta("Spin", { city: cityId, content_category: "city" }, true);
    if ("vibrate" in navigator) navigator.vibrate([12, 30, 18]);
  });

  const sheet = document.querySelector<HTMLElement>("#share-sheet");
  const shareTitle = document.querySelector("#share-title");
  const sharePicks = document.querySelector("#share-picks");
  const shareStatus = document.querySelector("#share-status");

  const setStatus = (text: string) => {
    if (shareStatus) shareStatus.textContent = text;
  };

  const storyPreview = document.querySelector<HTMLImageElement>("#share-story-preview");
  let storyBlob: Blob | null = null;
  let storyKey = "";

  const picksForStory = () =>
    reels.map((reel) => ({
      label: LABELS[reel.key],
      name: reel.current.name,
      area: reel.current.area,
      imageUrl: reel.current.images[0]?.url,
    }));

  const ensureStoryCard = async (): Promise<File> => {
    const key = `${cityId}|${reels.map((reel) => reel.current.id).join("|")}`;
    if (!storyBlob || storyKey !== key) {
      setStatus("Making your story…");
      storyBlob = await renderStoryCard(cityName(), picksForStory());
      storyKey = key;
      if (storyPreview) {
        if (storyPreview.src.startsWith("blob:")) URL.revokeObjectURL(storyPreview.src);
        storyPreview.src = URL.createObjectURL(storyBlob);
        storyPreview.hidden = false;
      }
    }
    return storyFile(storyBlob, cityName());
  };

  const downloadStory = (file: File) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  };

  const inInstagram = () => /Instagram/i.test(navigator.userAgent);

  const showStorySheet = (status: string) => {
    if (shareTitle) shareTitle.textContent = "Hey let's go";
    if (sharePicks) sharePicks.textContent = reels.map((reel) => reel.current.name).join(" · ");
    setStatus(status);
    if (sheet) sheet.hidden = false;
  };

  const closeSheet = () => {
    if (sheet) sheet.hidden = true;
  };

  const heyLetsGo = async () => {
    if (!shareBtn || shareBtn.hidden || !reels.length || reels.some((reel) => reel.busy)) return;
    shareBtn.disabled = true;
    const line = dareLine(cityId, reels);
    const copied = await copyText(line);
    trackMeta(
      "HeyLetsGo",
      {
        city: cityId,
        content_name: reels.map((reel) => reel.current.name).join(" · "),
      },
      true,
    );
    try {
      const file = await ensureStoryCard();
      if (inInstagram()) {
        trackNight("share", "instagram");
        showStorySheet(
          copied
            ? "Copied. Hold the picture, add it to your story, then paste."
            : "Hold the picture and add it to your story.",
        );
        return;
      }
      const payload: ShareData = { files: [file], title: "Hey let's go", text: line };
      if (navigator.canShare?.(payload)) {
        await navigator.share(payload);
        trackNight("share", "native");
        return;
      }
      downloadStory(file);
      trackNight("share", "copy");
      showStorySheet(
        copied
          ? "Copied. Send that line. Save the picture if you want it on a story."
          : "Picture saved. Send datedinnerdance.com with the three names.",
      );
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError") return;
      trackNight("share", "copy");
      showStorySheet(copied ? "Copied. Send that line." : "Could not copy. Send datedinnerdance.com.");
    } finally {
      shareBtn.disabled = false;
    }
  };

  shareBtn?.addEventListener("click", () => {
    void heyLetsGo();
  });
  mount.addEventListener("ddd-pick", () => {
    setShareVisible(true);
    writeNightURL();
  });
  sheet?.addEventListener("click", (event) => {
    if (event.target === sheet || (event.target as HTMLElement).closest("[data-close-sheet]")) {
      closeSheet();
    }
  });
}

void boot().catch((error: unknown) => {
  const mount = document.querySelector("#reels");
  if (mount) {
    mount.innerHTML = `<p class="tagline">The night planner could not load. Refresh to try again.</p>`;
  }
  console.error(error);
});
