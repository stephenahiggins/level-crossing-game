# Level Crossings Scraper

This project fetches level crossing data from Wikidata, downloads images, and stores metadata in a SQLite database.

## Usage

### Requirements
- Node.js 18+
- npm install (to install dependencies)

### Run the scraper
```
make run
```

This will:
- Query Wikidata for level crossings
- Download images to the `storage/` folder
- Store metadata and local image paths in `level_crossings.sqlite`
- Run a storage cleanup pass to remove any unreferenced images

### Derive missing country codes
Many scraped rows initially have a `NULL` `country_code`. You can populate these using reverse geocoding (OpenStreetMap Nominatim):
```
make derive-country-codes
```
This will:
- Look up rows where `country_code IS NULL`
- Perform a polite (≈1 req/sec) reverse geocode
- Update the table in-place

Set `NOMINATIM_EMAIL` env var to include a contact in the User-Agent per Nominatim usage policy, e.g.:
```
NOMINATIM_EMAIL=you@example.com make derive-country-codes
```

### Manual storage cleanup
You can manually re-run the storage cleanup script if desired:
```
make cleanup-storage
```
Deletes files in `storage/` not referenced by any `level_crossings.url`.

### Clean generated files
```
make clean
```

Removes the `storage/` folder and the SQLite database.
