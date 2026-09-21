export type StoryPick = {
  label: string;
  name: string;
  area: string;
  imageUrl?: string;
};

const W = 1080;
const H = 1920;
const INK = "#171312";
const INK_SOFT = "#241F1D";
const CREAM = "#FFF6EC";
const CORAL = "#FF5A3D";
const YELLOW = "#FFC93C";
const TEAL = "#12B39B";

const CHIPS: Record<string, { bg: string; fg: string }> = {
  date: { bg: CORAL, fg: CREAM },
  dinner: { bg: YELLOW, fg: INK },
  dance: { bg: TEAL, fg: CREAM },
};

function tryLoad(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadCover(url?: string): Promise<HTMLImageElement | null> {
  if (!url) return null;
  const proxied = `/api/img?u=${encodeURIComponent(url)}`;
  return (await tryLoad(proxied)) || tryLoad(url);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function coverDraw(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let next = text;
  while (next.length > 1 && ctx.measureText(`${next}…`).width > maxWidth) {
    next = next.slice(0, -1);
  }
  return `${next}…`;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fillDots(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, gap: number) {
  const colours = [CORAL, YELLOW, TEAL];
  colours.forEach((colour, i) => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(x + size / 2 + i * (size + gap), y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function fillChip(ctx: CanvasRenderingContext2D, label: string, x: number, y: number) {
  const chip = CHIPS[label.toLowerCase()] || CHIPS.date;
  ctx.font = "600 22px Jost, system-ui, sans-serif";
  ctx.letterSpacing = "0.2em";
  const text = label.toUpperCase();
  const textW = ctx.measureText(text).width;
  const padX = 20;
  const h = 42;
  const w = textW + padX * 2;
  ctx.fillStyle = chip.bg;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = chip.fg;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX, y + h / 2);
  ctx.letterSpacing = "0";
  ctx.textBaseline = "alphabetic";
  return h;
}

export async function renderStoryCard(city: string, picks: StoryPick[]): Promise<Blob> {
  await document.fonts.ready.catch(() => undefined);
  const images = await Promise.all(picks.map((pick) => loadCover(pick.imageUrl)));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw the story card");

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);

  fillDots(ctx, 64, 72, 24, 14);

  ctx.fillStyle = CREAM;
  ctx.font = "800 92px 'Bricolage Grotesque', system-ui, sans-serif";
  ctx.letterSpacing = "-0.035em";
  ctx.textAlign = "left";
  const headline = `my perfect ${city} day`;
  const lines = wrapText(ctx, headline, 880);
  lines.forEach((line, i) => {
    ctx.fillText(line, 64, 198 + i * 86);
  });
  ctx.letterSpacing = "0";

  const cardX = 64;
  const cardW = 952;
  const gap = 24;
  const cardsTop = 198 + lines.length * 86 + 28;
  const ctaTop = H - 250 - 138;
  const cardH = Math.min(360, Math.floor((ctaTop - cardsTop - gap * 2) / 3));

  picks.forEach((pick, i) => {
    const y = cardsTop + i * (cardH + gap);
    ctx.save();
    roundRect(ctx, cardX, y, cardW, cardH, 28);
    ctx.clip();
    if (images[i]) {
      coverDraw(ctx, images[i] as HTMLImageElement, cardX, y, cardW, cardH);
      const shade = ctx.createLinearGradient(cardX, y + cardH * 0.38, cardX, y + cardH);
      shade.addColorStop(0, "rgba(23, 19, 18, 0)");
      shade.addColorStop(1, "rgba(23, 19, 18, 0.88)");
      ctx.fillStyle = shade;
      ctx.fillRect(cardX, y, cardW, cardH);
    } else {
      ctx.fillStyle = INK_SOFT;
      ctx.fillRect(cardX, y, cardW, cardH);
    }
    ctx.restore();

    const textX = cardX + 36;
    let textY = y + cardH - 32;
    if (pick.area) {
      ctx.fillStyle = "rgba(255, 246, 236, 0.75)";
      ctx.font = "500 24px Jost, system-ui, sans-serif";
      ctx.letterSpacing = "0.14em";
      ctx.textAlign = "left";
      ctx.fillText(fitText(ctx, pick.area.toUpperCase(), cardW - 72), textX, textY);
      ctx.letterSpacing = "0";
      textY -= 40;
    }
    ctx.fillStyle = CREAM;
    ctx.font = "500 52px Jost, system-ui, sans-serif";
    ctx.fillText(fitText(ctx, pick.name, cardW - 72), textX, textY);
    fillChip(ctx, pick.label, textX, textY - 106);
  });

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 40px Jost, system-ui, sans-serif";
  ctx.letterSpacing = "0";
  const cta = "Hey let's go";
  const ctaW = ctx.measureText(cta).width + 124;
  const ctaH = 100;
  const ctaX = (W - ctaW) / 2;
  const ctaY = H - 250 - ctaH - 38;
  ctx.fillStyle = CORAL;
  roundRect(ctx, ctaX, ctaY, ctaW, ctaH, ctaH / 2);
  ctx.fill();
  ctx.fillStyle = CREAM;
  ctx.fillText(cta, W / 2, ctaY + ctaH / 2);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255, 246, 236, 0.65)";
  ctx.font = "600 22px Jost, system-ui, sans-serif";
  ctx.letterSpacing = "0.16em";
  ctx.fillText("DATEDINNERDANCE.COM", W / 2, ctaY + ctaH + 34);
  ctx.letterSpacing = "0";

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not make the story image");
  return blob;
}

export function storyFile(blob: Blob, city: string): File {
  const slug = city.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return new File([blob], `my-perfect-${slug}-day.png`, { type: "image/png" });
}
