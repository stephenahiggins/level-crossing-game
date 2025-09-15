// src/scrapers/wikimedia_parql.js
import { promises as fs } from "fs";
import path from "path";

const SOURCE_WIKIMEDIA = "wikimedia";

function getSparqlQuery(limit, offset) {
  let lim = limit !== null ? `LIMIT ${limit}` : "";
  let off = offset ? `OFFSET ${offset}` : "";
  return `
    SELECT ?item ?itemLabel ?image ?coord ?countryCode WHERE {
      {
        ?item wdt:P31/wdt:P279* wd:Q171448 .
      } UNION {
        ?item wdt:P31/wdt:P279* wd:Q1669872 .
      }
      OPTIONAL { ?item wdt:P18 ?image . }
      OPTIONAL { ?item wdt:P625 ?coord . }
      OPTIONAL {
        ?item wdt:P17 ?country .
        ?country wdt:P297 ?countryCode .
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    ${lim}
    ${off}
  `;
}

function wktPointToLatLon(wkt) {
  const m = /^Point\(([-+0-9.eE]+)\s+([-+0-9.eE]+)\)$/.exec(wkt);
  if (!m) return [null, null];
  const lon = Number(m[1]);
  const lat = Number(m[2]);
  return [lat, lon];
}

function val(b, key) {
  return b?.[key]?.value ?? null;
}

class WikimediaScraper {
  constructor(db, storageDir) {
    this.db = db;
    this.storageDir = storageDir;
    this.insert = this.db.prepare(`
      INSERT OR IGNORE INTO level_crossings
        (title, wikidata_item, url, latitude, longitude, country_code, license, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }

  async scrape(limit = null) {
    console.log(`Querying WDQS (may take a few seconds)...`);
    let bindings = [];
    if (limit === null) {
      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const sparql = getSparqlQuery(pageSize, offset);
        const url =
          "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(sparql);
        console.log(`Querying: ${url}`);
        const resp = await fetch(url, {
          headers: {
            "User-Agent": "level-crossings-sqlite/1.0 (contact: you@example.com)",
          },
        });
        if (!resp.ok) {
          throw new Error(`WDQS HTTP ${resp.status} ${resp.statusText}`);
        }
        const data = await resp.json();
        const pageBindings = data?.results?.bindings ?? [];
        if (pageBindings.length === 0) break;
        bindings = bindings.concat(pageBindings);
        offset += pageSize;
      }
      console.log(`Fetched ${bindings.length} records from Wikimedia.`);
    } else {
      // ... (handling for limited queries, if needed)
    }

    let imgIndex = (await fs.readdir(this.storageDir)).length;
    for (const b of bindings) {
      const title = val(b, "itemLabel");
      const wikidata_item = val(b, "item");
      const image_url = val(b, "image");
      const coord = val(b, "coord");
      const country_code = val(b, "countryCode");
      if (!title || !wikidata_item || !image_url || !coord) continue;

      const exists = this.db
        .prepare(`SELECT 1 FROM level_crossings WHERE wikidata_item = ?`)
        .get(wikidata_item);
      if (exists) continue;

      const [latitude, longitude] = wktPointToLatLon(coord);
      if (latitude == null || longitude == null) continue;

      const ext = path.extname(new URL(image_url).pathname) || ".jpg";
      const imageFilename = `img_${imgIndex}${ext}`;
      const imagePath = path.join(this.storageDir, imageFilename);
      const localUrl = `storage/${imageFilename}`;

      try {
        const imgResp = await fetch(image_url);
        if (imgResp.ok) {
          const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
          await fs.writeFile(imagePath, imgBuffer);
          this.insert.run(
            title,
            wikidata_item,
            localUrl,
            latitude,
            longitude,
            country_code,
            "See Commons file page",
            SOURCE_WIKIMEDIA
          );
        } else {
          console.warn(`Failed to download image: ${image_url}`);
        }
      } catch (err) {
        console.warn(`Error downloading image: ${image_url}`, err);
      }
      imgIndex++;
    }
  }
}

export default WikimediaScraper;
