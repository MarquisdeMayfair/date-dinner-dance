#!/usr/bin/env python3
"""
Fix slugs for venues that have OSM IDs instead of proper names.
"""

import json
import os
import re
import shutil
from pathlib import Path

BASE_DIR = Path("/workspace")
PUBLIC_DIR = BASE_DIR / "public"
DATA_DIR = PUBLIC_DIR / "data"
OPT_DIR = PUBLIC_DIR / "assets" / "opt"

CATEGORIES = ["date", "dinner", "dance"]


def slugify(name: str) -> str:
    """Convert venue name to kebab-case slug."""
    slug = name.lower()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    slug = slug.strip('-')
    return slug


def needs_fix(venue_id: str) -> bool:
    """Check if venue ID is an OSM ID that should be replaced with name."""
    return venue_id.startswith('osm-')


def fix_city(city: str):
    """Fix slugs for a city."""
    json_path = DATA_DIR / f"{city}.json"
    
    if not json_path.exists():
        return
    
    print(f"\n=== Fixing {city.upper()} ===")
    
    with open(json_path, 'r') as f:
        data = json.load(f)
    
    changes = 0
    
    for category in CATEGORIES:
        if category not in data:
            continue
        
        for venue in data[category]:
            venue_id = venue.get('id', '')
            venue_name = venue.get('name', '')
            images = venue.get('images', [])
            
            if not needs_fix(venue_id):
                continue
            
            if not venue_name:
                continue
            
            old_slug = slugify(venue_id)
            new_slug = slugify(venue_name)
            
            if old_slug == new_slug:
                continue
            
            old_dir = OPT_DIR / category / old_slug
            new_dir = OPT_DIR / category / new_slug
            
            if not old_dir.exists():
                continue
            
            if new_dir.exists():
                print(f"  SKIP: Target exists: {new_slug}")
                continue
            
            print(f"  Rename: {old_slug} -> {new_slug}")
            
            # Rename directory
            shutil.move(str(old_dir), str(new_dir))
            
            # Update image URLs
            for img in images:
                old_url = img.get('url', '')
                if old_slug in old_url:
                    new_url = old_url.replace(old_slug, new_slug)
                    img['url'] = new_url
            
            changes += 1
    
    if changes > 0:
        with open(json_path, 'w') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"  Saved {changes} changes")
    else:
        print(f"  No changes needed")


def main():
    for city in ["london", "manchester"]:
        fix_city(city)


if __name__ == "__main__":
    main()
