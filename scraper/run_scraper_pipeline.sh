#!/bin/zsh
set -e

echo "Running build_level_crossings_sqlite.mjs..."
node src/build_level_crossings_sqlite.mjs

echo "Running derive_country_codes.mjs..."
node src/derive_country_codes.mjs

echo "Running cleanup_storage.mjs..."
node src/cleanup_storage.mjs

echo "All scraper steps completed successfully."
