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

### Clean generated files
```
make clean
```

Removes the `storage/` folder and the SQLite database.
