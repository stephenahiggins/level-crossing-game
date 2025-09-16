run:
	node ./src/build_level_crossings_sqlite.mjs

derive-country-codes:
	node ./src/derive_country_codes.mjs

cleanup-storage:
	node ./src/cleanup_storage.mjs

clean:
	rm -rf storage level_crossings.sqlite

init:
	./run_scraper_pipeline.sh
	cd .. && node scripts/export_crossings.mjs --target backend
