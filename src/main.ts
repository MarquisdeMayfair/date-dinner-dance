type VenueImage = {
  url: string;
  alt?: string;
};

type Venue = {
  id: string;
  name: string;
  area: string;
  vibe: string;
  website?: string;
  instagram?: string;
  images: VenueImage[];
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
  return windowEl.getBoundingClientRect().height;
}

function linkChip(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function renderReveal(venue: Venue): string {
  const links: string[] = [];
  if (venue.website) links.push(linkChip(venue.website, "Website"));
  if (venue.instagram) links.push(linkChip(venue.instagram, "Instagram"));
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

  constructor(key: ReelKey, items: Venue[], mount: HTMLElement, startIndex?: number) {
    this.key = key;
    this.items = items;
    this.index = startIndex ?? randomIndex(items.length);
    this.root = document.createElement("section");
    this.root.className = "reel";
    this.root.dataset.reel = key;
    this.root.innerHTML = `
      <div class="reel-label">${LABELS[key]}</div>
      <div class="nudges">
        <button type="button" class="nudge" data-dir="-1" aria-label="Previous ${LABELS[key]}">${chevronUp}</button>
        <button type="button" class="nudge" data-dir="1" aria-label="Next ${LABELS[key]}">${chevronDown}</button>
      </div>
      <div class="window-wrap">
        <div class="window" aria-live="polite">
          <div class="strip"></div>
        </div>
      </div>
      <div class="reveal"></div>
    `;
    mount.append(this.root);
    this.windowEl = this.root.querySelector(".window") as HTMLElement;
    this.stripEl = this.root.querySelector(".strip") as HTMLElement;
    this.revealEl = this.root.querySelector(".reveal") as HTMLElement;
    this.paintStrip();
    this.syncOffset();
    this.hydrateImages();
    this.showReveal();
    this.bind();
  }

  get current(): Venue {
    return this.items[this.index];
  }

  get busy(): boolean {
    return this.animating;
  }

  destroy(): void {
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

async function loadCities(): Promise<City[]> {
  const response = await fetch("/cities.json", { cache: "force-cache" });
  if (!response.ok) throw new Error("Could not load cities");
  const cities = (await response.json()) as City[];
  return cities.filter((city) => city.id && city.name);
}

async function loadCatalog(cityId: string): Promise<Catalog> {
  const cached = catalogCache.get(cityId);
  if (cached) return cached;
  const response = await fetch(`/data/${encodeURIComponent(cityId)}.json`, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Could not load ${cityId} venues`);
  const catalog = (await response.json()) as Catalog;
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

function startIndexFor(catalog: Catalog, key: ReelKey): number | undefined {
  const id = new URLSearchParams(window.location.search).get(key);
  if (!id) return undefined;
  const index = catalog[key].findIndex((item) => item.id === id);
  return index >= 0 ? index : undefined;
}

function paintCityPicker(cities: City[], activeId: string): void {
  const scroller = document.querySelector<HTMLElement>("#city-scroller");
  const dots = document.querySelector<HTMLElement>("#city-dots");
  if (!scroller || !dots) return;
  scroller.innerHTML = cities
    .map(
      (city) =>
        `<button type="button" class="city-slide" role="tab" data-city="${escapeHtml(city.id)}" aria-selected="${city.id === activeId}">${escapeHtml(city.name)}</button>`,
    )
    .join("");
  dots.innerHTML = cities
    .map((city) => `<span class="city-dot${city.id === activeId ? " is-on" : ""}" data-city="${escapeHtml(city.id)}"></span>`)
    .join("");
}

function scrollCityIntoView(cityId: string, smooth = false): void {
  const slide = document.querySelector<HTMLElement>(`.city-slide[data-city="${cityId}"]`);
  slide?.scrollIntoView({ inline: "center", block: "nearest", behavior: smooth ? "smooth" : "instant" });
}

function nearestCityId(cities: City[]): string {
  const scroller = document.querySelector<HTMLElement>("#city-scroller");
  if (!scroller) return cities[0].id;
  const center = scroller.scrollLeft + scroller.clientWidth / 2;
  const slides = [...scroller.querySelectorAll<HTMLElement>(".city-slide")];
  let best = cities[0].id;
  let bestDist = Number.POSITIVE_INFINITY;
  slides.forEach((slide) => {
    const mid = slide.offsetLeft + slide.offsetWidth / 2;
    const dist = Math.abs(mid - center);
    if (dist < bestDist) {
      bestDist = dist;
      best = slide.dataset.city || best;
    }
  });
  return best;
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
  let ignoreScroll = false;

  const setDots = (id: string) => {
    document.querySelectorAll(".city-dot").forEach((dot) => {
      dot.classList.toggle("is-on", dot.getAttribute("data-city") === id);
    });
    document.querySelectorAll(".city-slide").forEach((slide) => {
      slide.setAttribute("aria-selected", String(slide.getAttribute("data-city") === id));
    });
  };

  const loadCity = async (id: string, smooth = false) => {
    if (switching || reels.some((reel) => reel.busy)) return;
    const city = cities.find((item) => item.id === id);
    if (!city) return;
    if (id === cityId && reels.length) {
      scrollCityIntoView(id, smooth);
      return;
    }
    switching = true;
    ignoreScroll = true;
    cityId = id;
    setDots(id);
    scrollCityIntoView(id, smooth);
    try {
      localStorage.setItem("ddd-city", id);
    } catch {
      /* ignore */
    }
    const nextURL = new URL(window.location.href);
    nextURL.searchParams.set("c", id);
    (["date", "dinner", "dance"] as ReelKey[]).forEach((key) => nextURL.searchParams.delete(key));
    nextURL.hash = "";
    history.replaceState(null, "", `${nextURL.pathname}?${nextURL.searchParams.toString()}`);
    document.title = `Date · Dinner · Dance — ${city.name}`;

    try {
      const catalog = await loadCatalog(id);
      validate(catalog);
      reels.forEach((reel) => reel.destroy());
      mount.innerHTML = "";
      reels = (Object.keys(LABELS) as ReelKey[]).map(
        (key) => new Reel(key, catalog[key], mount, startIndexFor(catalog, key)),
      );
      cities.forEach((item) => prefetchCatalog(item.id));
    } finally {
      switching = false;
      window.setTimeout(() => {
        ignoreScroll = false;
      }, 220);
    }
  };

  paintCityPicker(cities, cityId);
  await loadCity(cityId);

  const resize = () => reels.forEach((reel) => reel.syncOffset());
  window.addEventListener("resize", resize);

  let scrollTick = 0;
  scroller.addEventListener(
    "scroll",
    () => {
      if (ignoreScroll) return;
      window.clearTimeout(scrollTick);
      scrollTick = window.setTimeout(() => {
        if (ignoreScroll) return;
        const next = nearestCityId(cities);
        if (next !== cityId) void loadCity(next);
      }, 80);
    },
    { passive: true },
  );

  document.querySelectorAll<HTMLButtonElement>(".city-chevron").forEach((button) => {
    button.addEventListener("click", () => {
      const dir = Number(button.dataset.dir) === -1 ? -1 : 1;
      const index = cities.findIndex((city) => city.id === cityId);
      const next = cities[(index + dir + cities.length) % cities.length];
      void loadCity(next.id, true);
    });
  });

  scroller.addEventListener("click", (event) => {
    const slide = (event.target as HTMLElement).closest<HTMLElement>(".city-slide");
    if (!slide?.dataset.city) return;
    void loadCity(slide.dataset.city, true);
  });

  const writeNightURL = () => {
    if (!reels.length) return;
    history.replaceState(null, "", nightURL(cityId, reels).replace(window.location.origin, ""));
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
    if ("vibrate" in navigator) navigator.vibrate([12, 30, 18]);
  });

  const sheet = document.querySelector<HTMLElement>("#share-sheet");
  const shareBtn = document.querySelector<HTMLButtonElement>("#share");
  const shareTitle = document.querySelector("#share-title");
  const sharePicks = document.querySelector("#share-picks");
  const shareStatus = document.querySelector("#share-status");
  const cityName = () => cities.find((city) => city.id === cityId)?.name || cityId;

  const setStatus = (text: string) => {
    if (shareStatus) shareStatus.textContent = text;
  };

  const openSheet = () => {
    if (!sheet || !reels.length) return;
    writeNightURL();
    if (shareTitle) shareTitle.textContent = `A ${cityName()} night`;
    if (sharePicks) {
      sharePicks.textContent = reels.map((reel) => reel.current.name).join(" · ");
    }
    setStatus("");
    sheet.hidden = false;
  };

  const closeSheet = () => {
    if (sheet) sheet.hidden = true;
  };

  shareBtn?.addEventListener("click", openSheet);
  sheet?.addEventListener("click", (event) => {
    if (event.target === sheet || (event.target as HTMLElement).closest("[data-close-sheet]")) {
      closeSheet();
    }
  });

  document.querySelector("#share-native")?.addEventListener("click", async () => {
    const url = nightURL(cityId, reels);
    const text = `Date · Dinner · Dance — ${cityName()}\n${reels.map((reel) => reel.current.name).join(" · ")}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Date · Dinner · Dance", text, url });
        setStatus("Shared.");
        return;
      }
    } catch {
      /* user cancelled or share failed */
    }
    const ok = await copyText(`${text}\n${url}`);
    setStatus(ok ? "Link copied — paste it in a DM or Story." : "Could not share. Copy the URL from the address bar.");
  });

  document.querySelector("#share-copy")?.addEventListener("click", async () => {
    const ok = await copyText(nightURL(cityId, reels));
    setStatus(ok ? "Link copied." : "Copy failed.");
  });

  document.querySelector("#share-dm")?.addEventListener("click", async () => {
    const url = nightURL(cityId, reels);
    const ok = await copyText(`Tonight: ${reels.map((reel) => reel.current.name).join(" · ")}\n${url}`);
    window.open("https://www.instagram.com/direct/new/", "_blank", "noopener,noreferrer");
    setStatus(ok ? "Link copied. Paste it in the DM." : "Open Instagram and paste the page URL.");
  });

  document.querySelector("#share-story")?.addEventListener("click", async () => {
    const url = nightURL(cityId, reels);
    const text = `${cityName()} night: ${reels.map((reel) => reel.current.name).join(" · ")}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Date · Dinner · Dance", text, url });
        setStatus("Pick Instagram in the share sheet, then Story.");
        return;
      }
    } catch {
      /* cancelled */
    }
    const ok = await copyText(url);
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
    setStatus(ok ? "Link copied. Add it as a Story link sticker." : "Copy the URL, then add a link sticker in Instagram.");
  });

  document.querySelector("#subscribe-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = (document.querySelector("#subscribe-email") as HTMLInputElement | null)?.value.trim() || "";
    const handle = (document.querySelector("#subscribe-handle") as HTMLInputElement | null)?.value.trim() || "";
    if (!email) return;
    const payload = { email, handle, city: cityId, at: new Date().toISOString() };
    try {
      localStorage.setItem("ddd-subscribe", JSON.stringify(payload));
    } catch {
      /* ignore */
    }
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("subscribe failed");
      setStatus("You’re on the list.");
    } catch {
      setStatus("Saved on this phone. We’ll add the list when the server is connected.");
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
