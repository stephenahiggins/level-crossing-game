# Level Crossings Scraper

This project fetches level crossing data from Wikidata, downloads images, and stores metadata in a SQLite database.

## Usage

### Requirements
- Node.js 18+
- npm install (to install dependencies)


### Run the full scraper pipeline

To run the complete scraping and cleanup process, use the provided script:

```
./run_scraper_pipeline.sh
```

This will sequentially:
- Build the SQLite database from Wikidata (`build_level_crossings_sqlite.mjs`)
- Derive missing country codes (`derive_country_codes.mjs`)
- Clean up unreferenced images in `storage/` (`cleanup_storage.mjs`)

#### Requirements
- Node.js 18+
- Install dependencies with `npm install`
- Make the script executable if needed:
	```
	chmod +x run_scraper_pipeline.sh
	```

#### Environment variables
If you want to use Nominatim for reverse geocoding, set the `NOMINATIM_EMAIL` environment variable:
```
NOMINATIM_EMAIL=you@example.com ./run_scraper_pipeline.sh
```

---

#### Manual steps (advanced)

You can still run individual steps as before:

- Build database: `node src/build_level_crossings_sqlite.mjs`
- Derive country codes: `node src/derive_country_codes.mjs`
- Cleanup storage: `node src/cleanup_storage.mjs`

### Clean generated files
```
make clean
```

Removes the `storage/` folder and the SQLite database.
