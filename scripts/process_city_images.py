#!/usr/bin/env python3
"""
Process city venue images to 4:5 portrait WebP format.

For each venue:
1. Take the first suitable image (prefer local, then download remote)
2. Center-crop to 4:5 aspect ratio
3. Convert to 720x900 WebP (quality 78)
4. Save to public/assets/opt/{category}/{slug}/01.webp
5. Update JSON with new local path
"""

import json
import os
import subprocess
import sys
import re
import shutil
from pathlib import Path
from urllib.parse import urlparse

# Configuration
BASE_DIR = Path("/workspace")
PUBLIC_DIR = BASE_DIR / "public"
DATA_DIR = PUBLIC_DIR / "data"
OPT_DIR = PUBLIC_DIR / "assets" / "opt"
STOCK_DIR = PUBLIC_DIR / "stock"
ASSETS_DIR = PUBLIC_DIR / "assets"

CONVERT_SCRIPT = BASE_DIR / "scripts" / "convert-image.sh"

CATEGORIES = ["date", "dinner", "dance"]
CITIES = ["ibiza", "nyc", "london", "manchester"]

# Stats tracking
stats = {
    "processed": 0,
    "failed": [],
    "skipped": [],
    "by_city": {}
}


def slugify(name: str) -> str:
    """Convert venue name/id to kebab-case slug."""
    # Use id if provided, otherwise convert name
    slug = name.lower()
    # Remove special characters and replace spaces with hyphens
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    slug = slug.strip('-')
    return slug


def resolve_local_path(url: str) -> Path | None:
    """Resolve a local URL path to filesystem path."""
    if not url.startswith('/'):
        return None
    
    # Remove leading slash and join with public dir
    rel_path = url.lstrip('/')
    full_path = PUBLIC_DIR / rel_path
    
    if full_path.exists():
        return full_path
    return None


def is_remote_url(url: str) -> bool:
    """Check if URL is a remote HTTP(S) URL."""
    return url.startswith('http://') or url.startswith('https://')


def find_best_image(images: list, venue_id: str) -> tuple[str | None, bool]:
    """
    Find the best source image for conversion.
    Returns (source_path_or_url, is_local)
    Prefers local files over remote URLs.
    """
    if not images:
        return None, False
    
    # First pass: look for local files
    for img in images:
        url = img.get('url', '')
        if not url:
            continue
        
        local_path = resolve_local_path(url)
        if local_path:
            return str(local_path), True
    
    # Second pass: use first remote URL
    for img in images:
        url = img.get('url', '')
        if is_remote_url(url):
            # Skip problematic URLs (tiny images, logos, etc.)
            if any(x in url.lower() for x in ['logo', 'icon', 'favicon', 'avatar', 'badge']):
                continue
            return url, False
    
    return None, False


def process_image(source: str, output_path: Path, is_local: bool) -> bool:
    """
    Process a single image using the convert script.
    Returns True if successful.
    """
    # Create output directory
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    try:
        result = subprocess.run(
            [str(CONVERT_SCRIPT), source, str(output_path)],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            print(f"  ERROR: {result.stderr.strip()}")
            return False
        
        # Verify output exists and has reasonable size
        if not output_path.exists():
            print(f"  ERROR: Output file not created")
            return False
        
        size_kb = output_path.stat().st_size // 1024
        if size_kb < 5:
            print(f"  WARNING: Suspiciously small file: {size_kb} KB")
        
        return True
        
    except subprocess.TimeoutExpired:
        print(f"  ERROR: Timeout processing image")
        return False
    except Exception as e:
        print(f"  ERROR: {e}")
        return False


def process_venue(venue: dict, category: str, city: str) -> dict | None:
    """
    Process a single venue's images.
    Returns updated image entry or None if failed.
    """
    venue_id = venue.get('id', '')
    venue_name = venue.get('name', venue_id)
    images = venue.get('images', [])
    
    # Create slug from id (or name if no id)
    slug = slugify(venue_id if venue_id else venue_name)
    
    if not slug:
        print(f"  SKIP: No valid slug for venue")
        return None
    
    # Find best source image
    source, is_local = find_best_image(images, venue_id)
    
    if not source:
        print(f"  SKIP: No usable image for {venue_name}")
        return None
    
    # Target path
    output_path = OPT_DIR / category / slug / "01.webp"
    new_url = f"/assets/opt/{category}/{slug}/01.webp"
    
    # Skip if already processed
    if output_path.exists() and output_path.stat().st_size > 1000:
        print(f"  EXISTS: {new_url}")
        return {"url": new_url, "alt": images[0].get('alt', venue_name) if images else venue_name}
    
    print(f"  Processing: {venue_name} ({slug})")
    print(f"    Source: {'LOCAL' if is_local else 'REMOTE'} {source[:80]}...")
    
    if process_image(source, output_path, is_local):
        return {"url": new_url, "alt": images[0].get('alt', venue_name) if images else venue_name}
    
    return None


def process_city(city: str):
    """Process all venues in a city."""
    json_path = DATA_DIR / f"{city}.json"
    
    if not json_path.exists():
        print(f"City file not found: {json_path}")
        return
    
    print(f"\n{'='*60}")
    print(f"Processing {city.upper()}")
    print(f"{'='*60}")
    
    with open(json_path, 'r') as f:
        data = json.load(f)
    
    city_stats = {"processed": 0, "failed": 0, "skipped": 0}
    
    for category in CATEGORIES:
        if category not in data:
            continue
        
        print(f"\n--- {category.upper()} ---")
        
        venues = data[category]
        for i, venue in enumerate(venues):
            venue_name = venue.get('name', f'venue-{i}')
            
            result = process_venue(venue, category, city)
            
            if result:
                # Update venue's images to use new local path
                venue['images'] = [result]
                city_stats["processed"] += 1
                stats["processed"] += 1
            else:
                city_stats["failed"] += 1
                stats["failed"].append(f"{city}/{category}/{venue_name}")
    
    # Save updated JSON
    with open(json_path, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"\n{city.upper()} Summary: {city_stats}")
    stats["by_city"][city] = city_stats


def main():
    # Verify convert script exists
    if not CONVERT_SCRIPT.exists():
        print(f"Convert script not found: {CONVERT_SCRIPT}")
        sys.exit(1)
    
    # Process cities in priority order
    for city in CITIES:
        try:
            process_city(city)
        except Exception as e:
            print(f"ERROR processing {city}: {e}")
            import traceback
            traceback.print_exc()
    
    print(f"\n{'='*60}")
    print("FINAL SUMMARY")
    print(f"{'='*60}")
    print(f"Total processed: {stats['processed']}")
    print(f"Total failed: {len(stats['failed'])}")
    
    if stats['failed']:
        print("\nFailed venues:")
        for f in stats['failed'][:20]:
            print(f"  - {f}")
        if len(stats['failed']) > 20:
            print(f"  ... and {len(stats['failed']) - 20} more")


if __name__ == "__main__":
    main()
