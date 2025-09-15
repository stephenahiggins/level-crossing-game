// src/scrapers/wikimedia_commons.js
// Combined logic from previous scrape2.mjs converted into a class that
// discovers Wikimedia Commons level crossing images and stores them in SQLite.
// Focus: insert into table (title, wikidata_item, url (local img path), latitude, longitude, country_code, license, source)
// We approximate country_code as null (could be derived later) and license from extmetadata LicenseShortName.

const API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT =
  "LevelCrossingsHarvester/1.0 (+https://commons.wikimedia.org/wiki/Commons:Village_pump; mailto:example@example.org)";

import { promises as fs } from "node:fs";
import path from "node:path";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
function parseLatOrLon(str) {
  if (str == null) return null;
  const s = String(str).trim();
  if (!s) return null;
  const dec = Number(s);
  if (Number.isFinite(dec)) return dec;
  const re =
    /(\d+(?:\.\d+)?)\s*[°º]\s*(\d+(?:\.\d+)?)?\s*[′']?\s*(\d+(?:\.\d+)?)?\s*[″"]?\s*([NSEW])?/i;
  const m = s.match(re);
  if (!m) return null;
  const deg = parseFloat(m[1] || "0");
  const min = parseFloat(m[2] || "0");
  const sec = parseFloat(m[3] || "0");
  let val = deg + min / 60 + sec / 3600;
  const hemi = (m[4] || "").toUpperCase();
  if (hemi === "S" || hemi === "W") val = -val;
  return Number.isFinite(val) ? val : null;
}
function stripHtml(s) {
  if (!s) return "";
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function getRetryAfterSeconds(res, fallback = 5) {
  const h = res.headers.get("retry-after");
  if (!h) return fallback;
  const n = Number(h);
  if (Number.isFinite(n)) return Math.max(1, n);
  const when = Date.parse(h);
  if (!Number.isNaN(when)) return Math.max(1, Math.ceil((when - Date.now()) / 1000));
  return fallback;
}
async function fetchWithRetry(url, init, { maxRetries = 6 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "User-Agent": USER_AGENT, ...(init && init.headers ? init.headers : {}) },
      });
      if (res.status === 429 || res.status === 503) {
        const secs = getRetryAfterSeconds(res, 5) * (attempt + 1);
        console.warn(`HTTP ${res.status}, backing off ${secs}s`);
        await sleep(secs * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const data = await res.json();
      if (data && data.error) {
        const code = data.error.code || "unknown";
        if (code === "maxlag") {
          const secs = Math.min(30, 5 * (attempt + 1));
          console.warn(`maxlag; sleeping ${secs}s ...`);
          await sleep(secs * 1000);
          continue;
        }
        throw new Error(`API error: ${code} - ${data.error.info || ""}`);
      }
      return data;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const secs = 2 ** attempt;
      console.warn(`Fetch error (${err.message}); retrying in ${secs}s`);
      await sleep(secs * 1000);
    }
  }
}
async function mwRequest(params) {
  const sp = new URLSearchParams({ format: "json", origin: "*", maxlag: "5", ...params });
  const url = `${API}?${sp.toString()}`;
  return fetchWithRetry(url, { method: "GET" });
}
async function* mwPaginate(params) {
  let cont = {};
  while (true) {
    const data = await mwRequest({ ...params, ...cont });
    yield data;
    if (!data.continue) break;
    cont = data.continue;
  }
}

function extractExtMetadata(imageinfo) {
  const ext = imageinfo?.extmetadata || {};
  const get = (k) => (ext[k] ? ext[k].value || "" : "");
  const gpsLat = parseLatOrLon(get("GPSLatitude"));
  const gpsLon = parseLatOrLon(get("GPSLongitude"));
  return {
    license_short: stripHtml(get("LicenseShortName")),
    license_url: stripHtml(get("LicenseUrl")),
    exif_gps:
      Number.isFinite(gpsLat) && Number.isFinite(gpsLon) ? { lat: gpsLat, lon: gpsLon } : null,
  };
}
function extractGeoData(page) {
  const coords = page?.coordinates || [];
  if (!coords.length) return null;
  const primary = coords.find((c) => c.primary) || coords[0];
  return { lat: primary?.lat ?? null, lon: primary?.lon ?? null, type: primary?.type ?? null };
}
function extractSDC(entity) {
  const claims = entity?.claims || {};
  const getValues = (pid) => (Array.isArray(claims[pid]) ? claims[pid] : []);
  let depictedCoord = null;
  for (const cl of getValues("P9149")) {
    const v = cl?.mainsnak?.datavalue?.value;
    if (v && Number.isFinite(v.latitude) && Number.isFinite(v.longitude)) {
      depictedCoord = { lat: v.latitude, lon: v.longitude };
      break;
    }
  }
  let povCoord = null;
  for (const cl of getValues("P1259")) {
    const v = cl?.mainsnak?.datavalue?.value;
    if (v && Number.isFinite(v.latitude) && Number.isFinite(v.longitude)) {
      povCoord = { lat: v.latitude, lon: v.longitude };
      break;
    }
  }
  return { depictedCoord, povCoord };
}
function chooseBestCoord({ depicted, pov, exif, geo }) {
  return depicted || pov || exif || geo || null;
}

export default class WikimediaCommonsScraper {
  constructor(db, storageDir, { max = 200 } = {}) {
    this.db = db;
    this.storageDir = storageDir;
    this.max = max;
    this.insert = this.db.prepare(
      `INSERT OR IGNORE INTO level_crossings (title, wikidata_item, url, latitude, longitude, country_code, license, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
  }

  async discoverTitles() {
    const discovered = new Set();
    let remaining = this.max; // Strategy: 1 depicts search (P180=Q171448), 2 category traversal Category:Level crossings
    // 1) depicts
    for await (const page of mwPaginate({
      action: "query",
      list: "search",
      srsearch: "haswbstatement:P180=Q171448",
      srnamespace: "6",
      srlimit: "50",
    })) {
      for (const hit of page?.query?.search || []) {
        if (remaining <= 0) break;
        if (!discovered.has(hit.title)) {
          discovered.add(hit.title);
          remaining--;
        }
      }
      if (remaining <= 0) break;
    }
    // 2) category traversal (shallow)
    if (remaining > 0) {
      const queue = ["Category:Level crossings"];
      const seenCat = new Set(queue);
      while (queue.length && remaining > 0) {
        const cat = queue.shift();
        for await (const page of mwPaginate({
          action: "query",
          list: "categorymembers",
          cmtitle: cat,
          cmnamespace: "6|14",
          cmlimit: "200",
        })) {
          for (const m of page?.query?.categorymembers || []) {
            if (m.ns === 6) {
              if (remaining <= 0) break;
              if (!discovered.has(m.title)) {
                discovered.add(m.title);
                remaining--;
              }
            } else if (m.ns === 14 && !seenCat.has(m.title)) {
              seenCat.add(m.title);
              queue.push(m.title);
            }
          }
          if (remaining <= 0) break;
        }
      }
    }
    return Array.from(discovered);
  }

  async fetchBatch(titles) {
    const params = {
      action: "query",
      prop: "imageinfo|coordinates",
      titles: titles.join("|"),
      iiprop: "url|size|mime|sha1|extmetadata",
      iiurlwidth: "1024",
      coprop: "type|name|dim|country|region|globe",
    };
    const data = await mwRequest(params);
    return Object.values(data?.query?.pages || {}).filter((p) => p && p.ns === 6 && !p.missing);
  }
  async fetchSDC(pageids) {
    const ids = pageids.map((id) => `M${id}`);
    const out = {};
    for (const group of chunk(ids, 50)) {
      const data = await mwRequest({
        action: "wbgetentities",
        ids: group.join("|"),
        props: "claims",
      });
      for (const [mid, obj] of Object.entries(data?.entities || {})) {
        out[mid] = obj;
      }
    }
    return out;
  }

  async scrape() {
    console.log("WikimediaCommonsScraper: discovering titles...");
    const titles = await this.discoverTitles();
    console.log(`Discovered ${titles.length} titles`);
    let imgIndex = (await fs.readdir(this.storageDir)).length;
    for (const batch of chunk(titles, 30)) {
      const pages = await this.fetchBatch(batch);
      const sdc = await this.fetchSDC(pages.map((p) => p.pageid));
      for (const page of pages) {
        const imageinfo = Array.isArray(page.imageinfo) ? page.imageinfo[0] : null;
        if (!imageinfo) continue;
        const ext = extractExtMetadata(imageinfo);
        const geo = extractGeoData(page);
        const sdcData = extractSDC(sdc[`M${page.pageid}`] || {});
        const best = chooseBestCoord({
          depicted: sdcData.depictedCoord,
          pov: sdcData.povCoord,
          exif: ext.exif_gps,
          geo,
        });
        if (!best || !Number.isFinite(best.lat) || !Number.isFinite(best.lon)) continue; // require coords
        const originalUrl = imageinfo.url;
        if (!originalUrl) continue;
        const extname = path.extname(new URL(originalUrl).pathname) || ".jpg";
        const imageFilename = `img_${imgIndex}${extname}`;
        const imagePath = path.join(this.storageDir, imageFilename);
        const localUrl = `storage/${imageFilename}`;
        try {
          const resp = await fetch(originalUrl);
          if (!resp.ok) {
            console.warn("Failed image download", originalUrl);
            continue;
          }
          const buf = Buffer.from(await resp.arrayBuffer());
          await fs.writeFile(imagePath, buf);
          this.insert.run(
            page.title,
            null,
            localUrl,
            best.lat,
            best.lon,
            null,
            ext.license_short || null,
            "wikimedia_commons"
          );
          imgIndex++;
        } catch (err) {
          console.warn("Image error", originalUrl, err.message);
        }
      }
    }
    console.log("WikimediaCommonsScraper: done.");
  }
}
