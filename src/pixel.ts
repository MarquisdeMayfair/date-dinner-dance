/** Public Meta Pixel id from Events Manager. */
export const META_PIXEL_ID = "4558463687764760";

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  loaded: boolean;
  version: string;
  push: Fbq;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

function install(id: string): void {
  if (window.fbq || !id) return;
  const fbq: Fbq = function (this: Fbq, ...args: unknown[]) {
    if (fbq.callMethod) {
      fbq.callMethod.apply(fbq, args);
    } else {
      fbq.queue.push(args);
    }
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.append(script);
  window.fbq("init", id);
  window.fbq("track", "PageView");
}

export function trackMeta(event: string, params?: Record<string, string>, custom = false): void {
  if (!META_PIXEL_ID) return;
  install(META_PIXEL_ID);
  window.fbq?.(custom ? "trackCustom" : "track", event, params);
}
