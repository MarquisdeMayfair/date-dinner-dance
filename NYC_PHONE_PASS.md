# NYC phone-pass (2026-09-21 ~20:05 BST)

## Name-check
Audited all 30 live `/assets/opt/{cat}/{slug}/01.webp` (720×900 WebP).
Almost all dinner/dance cards were generic food or nightlife stock; most date cards were lifestyle/wrong landmark.

## Vibes
All 30 vibes already complete (not thin/empty/cut). **No vibe rewrites.**

## Photo results
See `NYC_PHONE_PASS_SOURCES.json`. Summary:
- **OK kept:** brooklyn-bridge
- **FIXED (23):** 9 date + 7 dinner + 7 dance — Wikimedia Commons (or Commons-hosted) real photos of those places, re-encoded 720×900 WebP ≤150KB
- **STILL WRONG (6):** lilia, xian-famous-foods, locanda-verde, nowadays, good-room, le-bain — no free reusable identifiable photo found tonight (no Google Places used)

## Mac deploy
This executor cannot route Shell/`CopyFromBox` to machineId `76454b17-998b-413e-a238-a1bc1166b430` (cursor local tools not exposed). Pack ready for parent/Mac:

```bash
# on Mac after CopyFromBox of nyc-phone-pass-deploy.tgz:
cd /Users/nik/Downloads/date-dinner-dance
tar -xzf /Users/nik/Downloads/nyc-phone-pass-deploy.tgz
git add public/data/nyc.json public/assets/opt/date public/assets/opt/dinner public/assets/opt/dance NYC_PHONE_PASS.md NYC_PHONE_PASS_SOURCES.json
git status -sb   # must NOT include ibiza/london/manchester
git commit -m "$(cat <<'EOF'
NYC phone-pass: replace wrong stock heroes with real venue photos

Name-check all 30 NYC cards; swap 23 mismatched stock/lifestyle heroes
for Wikimedia Commons photographs of the actual places (720x900 WebP).
Leave 6 without free reusable sources flagged image_ok=false. Vibes unchanged.
EOF
)"
npx vercel --prod --yes
```
