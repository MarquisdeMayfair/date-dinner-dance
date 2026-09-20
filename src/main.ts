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
    ? `<img src="${escapeHtml(image.url)}" alt="${alt}" draggable="false" decoding="async" referrerpolicy="no-referrer" data-fallback="${escapeHtml(fallback)}">`
    : `<div class="card-fallback">${escapeHtml(venue.name)}</div>`;
  return `<div class="card" data-id="${escapeHtml(venue.id)}">${img}</div>`;
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

  constructor(key: ReelKey, items: Venue[], mount: HTMLElement) {
    this.key = key;
    this.items = items;
    this.index = randomIndex(items.length);
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
    this.showReveal();
    this.bind();
  }

  get current(): Venue {
    return this.items[this.index];
  }

  get busy(): boolean {
    return this.animating;
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
    await this.animateBy(distanceCards, duration);
    this.index = index;
    this.syncOffset();
    this.showReveal();
  }

  async nudge(dir: 1 | -1): Promise<void> {
    if (this.animating || this.items.length < 2) return;
    this.hideReveal();
    const next = (this.index + dir + this.items.length) % this.items.length;
    await this.animateBy(dir, 280);
    this.index = next;
    this.syncOffset();
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

async function loadCatalog(): Promise<Catalog> {
  const response = await fetch("/venues.json", { cache: "force-cache" });
  if (!response.ok) throw new Error("Could not load venues");
  return response.json() as Promise<Catalog>;
}

function validate(catalog: Catalog): void {
  (Object.keys(catalog) as ReelKey[]).forEach((key) => {
    if (!Array.isArray(catalog[key]) || catalog[key].length === 0) {
      throw new Error(`Missing ${key} venues`);
    }
  });
}

async function boot(): Promise<void> {
  const mount = document.querySelector<HTMLElement>("#reels");
  const spin = document.querySelector<HTMLButtonElement>("#spin");
  if (!mount || !spin) return;

  const catalog = await loadCatalog();
  validate(catalog);

  const reels = (Object.keys(LABELS) as ReelKey[]).map(
    (key) => new Reel(key, catalog[key], mount),
  );

  const resize = () => reels.forEach((reel) => reel.syncOffset());
  window.addEventListener("resize", resize);

  spin.addEventListener("click", async () => {
    if (reels.some((reel) => reel.busy)) return;
    spin.disabled = true;
    spin.classList.add("is-spinning");
    await Promise.all(
      reels.map((reel, i) => {
        const next = randomIndex(reel.items.length, reel.index);
        return reel.spinTo(next, 2200 + i * 480);
      }),
    );
    spin.disabled = false;
    spin.classList.remove("is-spinning");
    if ("vibrate" in navigator) navigator.vibrate([12, 30, 18]);
  });
}

void boot().catch((error: unknown) => {
  const mount = document.querySelector("#reels");
  if (mount) {
    mount.innerHTML = `<p class="tagline">The night planner could not load. Refresh to try again.</p>`;
  }
  console.error(error);
});
