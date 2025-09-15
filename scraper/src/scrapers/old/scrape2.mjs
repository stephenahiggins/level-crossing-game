/**
 * level_crossings.mjs
 *
 * Node 18+ / pure ESM. No deps. Uses global fetch.
 *
 * Finds Wikimedia Commons images of “level crossings” using:
 *  1) SDC depicts (P180=Q171448) search (CirrusSearch)
 *  2) Category traversal from Category:Level crossings (+ subcats)
 *  3) Multilingual text search backstop
 *
 * For each file (ns=6), enriches metadata from:
 *  A) imageinfo (+ExtMetadata, thumbnails)
 *  B) GeoData coordinates (prop=coordinates / page-level)
 *  C) Structured Data on Commons (MediaInfo via wbgetentities)
 *
 * Outputs:
 *   - JSONL: one record per line
 *   - CSV: normalized schema (arrays are ;-joined)
 *
 * CLI:
 *   node level_crossings.mjs [--max N] [--out basename] [--resume] [--concurrency N] [--maxDepth N] [--debugOne "File:..."]
 *
 * Examples:
 *   node level_crossings.mjs
 *   node level_crossings.mjs --max 2000 --concurrency 6
 *   node level_crossings.mjs --resume --out lc_dump
 *   node level_crossings.mjs --debugOne "File:Level crossing - geograph.org.uk - 155268.jpg"
 *
 * Validation quick-test (expects at least one coord source each):
 *   --debugOne with any of:
 *     File:Level crossing - geograph.org.uk - 155268.jpg
 *     File:California Crossing - geograph.org.uk - 556928.jpg
 *     File:Glauburg Stockheim Level crossing Railway Nidderau 20250609 a.png
 */

// ------------------------------- Config & CLI -------------------------------

const API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT =
  'LevelCrossingsHarvester/1.0 (+https://commons.wikimedia.org/wiki/Commons:Village_pump; mailto:example@example.org)';

const argv = parseArgs(process.argv.slice(2));
const OUT_BASE = argv.out ?? 'level_crossings';
const MAX_RESULTS = toInt(argv.max, Infinity);
const RESUME = !!argv.resume;
const CONCURRENCY = Math.max(1, toInt(argv.concurrency, 4));
const MAX_DEPTH = Math.max(0, toInt(argv.maxDepth, 6));
const DEBUG_ONE = argv.debugOne ? String(argv.debugOne) : null;

const OUT_JSONL = `${OUT_BASE}.jsonl`;
const OUT_CSV = `${OUT_BASE}.csv`;

import fs from 'node:fs';
import path from 'node:path';

// ------------------------------ Utility helpers ----------------------------

function parseArgs(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith('--')) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

function toInt(v, dflt) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  // Normalize newlines
  s = s.replace(/\r?\n/g, '\n');
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function stripHtml(s) {
  if (!s) return '';
  // Very light HTML stripping for ExtMetadata fields like Artist, Description
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// Parse possible DMS or decimal strings from ExtMetadata GPS fields
function parseLatOrLon(str) {
  if (str == null) return null;
  const s = String(str).trim();
  if (!s) return null;

  // Decimal?
  const dec = Number(s);
  if (Number.isFinite(dec)) return dec;

  // DMS like: 51° 30′ 26.64″ N  or 0° 7′ 39.7″ W
  const re =
    /(\d+(?:\.\d+)?)\s*[°º]\s*(\d+(?:\.\d+)?)?\s*[′']?\s*(\d+(?:\.\d+)?)?\s*[″"]?\s*([NSEW])?/i;
  const m = s.match(re);
  if (!m) return null;
  const deg = parseFloat(m[1] ?? '0');
  const min = parseFloat(m[2] ?? '0');
  const sec = parseFloat(m[3] ?? '0');
  let val = deg + (min / 60) + (sec / 3600);
  const hemi = (m[4] ?? '').toUpperCase();
  if (hemi === 'S' || hemi === 'W') val = -val;
  return Number.isFinite(val) ? val : null;
}

function encodeTitleForUrl(title) {
  // Make a MediaWiki page URL
  return 'https://commons.wikimedia.org/wiki/' + title.replace(/ /g, '_');
}

function uniquePush(arr, ...vals) {
  for (const v of vals) if (v != null && !arr.includes(v)) arr.push(v);
}

function getRetryAfterSeconds(res, fallback = 5) {
  const h = res.headers.get('retry-after');
  if (!h) return fallback;
  const n = Number(h);
  if (Number.isFinite(n)) return Math.max(1, n);
  // HTTP-date variant
  const when = Date.parse(h);
  if (!Number.isNaN(when)) return Math.max(1, Math.ceil((when - Date.now()) / 1000));
  return fallback;
}

// Simple pooled runner
async function promisePool(items, limit, fn) {
  const results = [];
  let idx = 0;
  const workers = Array(Math.min(limit, items.length))
    .fill(0)
    .map(async () => {
      while (idx < items.length) {
        const i = idx++;
        results[i] = await fn(items[i], i);
      }
    });
  await Promise.all(workers);
  return results;
}

// ----------------------------- API request layer ---------------------------

async function fetchWithRetry(url, init, {maxRetries = 6} = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          'User-Agent': USER_AGENT,
          ...(init && init.headers ? init.headers : {}),
        },
      });
      if (res.status === 429 || res.status === 503) {
        const secs = getRetryAfterSeconds(res, 5) * (attempt + 1);
        console.warn(`HTTP ${res.status}, backing off ${secs}s`);
        await sleep(secs * 1000);
        continue;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      const data = await res.json();
      if (data && data.error) {
        const code = data.error.code || 'unknown';
        // Respect maxlag
        if (code === 'maxlag') {
          const secs = Math.min(30, 5 * (attempt + 1));
          console.warn(`maxlag; sleeping ${secs}s ...`);
          await sleep(secs * 1000);
          continue;
        }
        throw new Error(`API error: ${code} - ${data.error.info ?? ''}`);
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
  const sp = new URLSearchParams({
    format: 'json',
    origin: '*',
    maxlag: '5',
    ...params,
  });
  const url = `${API}?${sp.toString()}`;
  return fetchWithRetry(url, {method: 'GET'});
}

async function* mwPaginate(params, contKeys = ['continue']) {
  let cont = {};
  while (true) {
    const data = await mwRequest({...params, ...cont});
    yield data;
    if (!data.continue) break;
    cont = data.continue;
  }
}

// -------------------------- Discovery: find File pages ---------------------

async function discoverAllFileTitles() {
  const discovered = new Map(); // title -> origin tag
  let hardCap = MAX_RESULTS;

  // 1) SDC depicts search
  if (hardCap > 0) {
    const got = await sdcDepictsSearch(discovered, hardCap);
    console.log(`SDC depicts: +${got} files`);
    hardCap = Math.max(0, hardCap - got);
  }

  // 2) Category traversal
  if (hardCap > 0) {
    const got = await categoryTraversal(discovered, hardCap);
    console.log(`Categories: +${got} files`);
    hardCap = Math.max(0, hardCap - got);
  }

  // 3) Text search backstop (multilingual)
  if (hardCap > 0) {
    const got = await textSearchBackstop(discovered, hardCap);
    console.log(`Text search: +${got} files`);
    hardCap = Math.max(0, hardCap - got);
  }

  return discovered;
}

async function sdcDepictsSearch(discovered, remainingCap) {
  let added = 0;
  const base = {
    action: 'query',
    list: 'search',
    srsearch: 'haswbstatement:P180=Q171448', // level crossing
    srnamespace: '6', // files
    srlimit: '50',
  };
  for await (const page of mwPaginate(base)) {
    const arr = page?.query?.search ?? [];
    for (const hit of arr) {
      const title = hit.title;
      if (!discovered.has(title)) {
        discovered.set(title, 'sdc_depicts');
        added++;
        if (added >= remainingCap) return added;
      }
    }
  }
  return added;
}

async function categoryTraversal(discovered, remainingCap) {
  let added = 0;
  const start = 'Category:Level crossings';
  const queue = [{title: start, depth: 0}];
  const seenCats = new Set([start]);

  while (queue.length && added < remainingCap) {
    const {title, depth} = queue.shift();

    // Fetch categorymembers for this category
    for await (const page of mwPaginate({
      action: 'query',
      list: 'categorymembers',
      cmtitle: title,
      cmnamespace: '6|14', // files and categories
      cmlimit: '500',
    })) {
      const members = page?.query?.categorymembers ?? [];
      for (const m of members) {
        if (m.ns === 6) {
          const fileTitle = m.title;
          if (!discovered.has(fileTitle)) {
            discovered.set(fileTitle, 'category');
            added++;
            if (added >= remainingCap) return added;
          }
        } else if (m.ns === 14) {
          const catTitle = m.title;
          if (!seenCats.has(catTitle) && depth < MAX_DEPTH) {
            seenCats.add(catTitle);
            queue.push({title: catTitle, depth: depth + 1});
          }
        }
      }
    }
  }
  return added;
}

async function textSearchBackstop(discovered, remainingCap) {
  let added = 0;
  const phrases = [
    '"level crossing"',
    '"grade crossing"',
    '"railroad crossing"',
    'Bahnübergang',
    '"passage à niveau"',
    '"paso a nivel"',
  ];
  for (const q of phrases) {
    if (added >= remainingCap) break;
    for await (const page of mwPaginate({
      action: 'query',
      list: 'search',
      srsearch: q,
      srnamespace: '6',
      srlimit: '50',
    })) {
      const arr = page?.query?.search ?? [];
      for (const hit of arr) {
        const title = hit.title;
        if (!discovered.has(title)) {
          discovered.set(title, 'text_search');
          added++;
          if (added >= remainingCap) break;
        }
      }
    }
  }
  return added;
}

// --------------------------- Enrichment: per page --------------------------

async function fetchBatchPageDataByTitles(titles) {
  // Use prop=imageinfo|coordinates|categories to minimize calls
  // imageinfo: url, size, mime, sha1, extmetadata; thumbnail 1024px wide
  // coordinates: page-level coords if any
  // categories: visible (non-hidden) categories
  const params = {
    action: 'query',
    prop: 'imageinfo|coordinates|categories',
    titles: titles.join('|'),
    // imageinfo fields
    iiprop: 'url|size|mime|sha1|extmetadata',
    iiurlwidth: '1024',
    // categories
    clshow: '!hidden',
    cllimit: 'max',
    // coordinates
    coprop: 'type|name|dim|country|region|globe',
    colimit: 'max',
  };
  const data = await mwRequest(params);
  const pages = Object.values(data?.query?.pages ?? {});
  return pages;
}

async function fetchBatchMediaInfoByPageids(pageids) {
  const ids = pageids.map((id) => `M${id}`);
  const out = {};
  for (const group of chunk(ids, 50)) {
    const data = await mwRequest({
      action: 'wbgetentities',
      ids: group.join('|'),
      props: 'claims|labels',
    });
    const ents = data?.entities ?? {};
    for (const [mid, obj] of Object.entries(ents)) {
      out[mid] = obj;
    }
  }
  return out;
}

function extractExtMetadata(imageinfo) {
  const ext = imageinfo?.extmetadata || {};
  const get = (k) => (ext[k] ? ext[k].value ?? '' : '');
  const gpsLat = parseLatOrLon(get('GPSLatitude'));
  const gpsLon = parseLatOrLon(get('GPSLongitude'));
  return {
    description: stripHtml(get('ImageDescription')),
    author: stripHtml(get('Artist') || get('Credit')),
    credit: stripHtml(get('Credit')),
    license_short: stripHtml(get('LicenseShortName')),
    license_url: stripHtml(get('LicenseUrl')),
    usage_terms: stripHtml(get('UsageTerms')),
    attribution_required: String(get('AttributionRequired') ?? '').toLowerCase(),
    copyrighted: String(get('Copyrighted') ?? '').toLowerCase(),
    date_taken: stripHtml(get('DateTimeOriginal') || get('DateTime')),
    exif_gps: (Number.isFinite(gpsLat) && Number.isFinite(gpsLon))
      ? {lat: gpsLat, lon: gpsLon}
      : null,
  };
}

function extractGeoData(page) {
  // prop=coordinates (could be multiple; choose primary)
  const coords = page?.coordinates ?? [];
  if (!coords.length) return {geodata: null};
  const primary = coords.find((c) => c.primary) || coords[0];
  return {
    geodata: {
      lat: primary?.lat ?? null,
      lon: primary?.lon ?? null,
      type: primary?.type ?? null,
      primary: !!primary?.primary,
    },
  };
}

function extractCategories(page) {
  const cats = page?.categories ?? [];
  return cats.map((c) => c.title);
}

function extractSDCClaims(entity) {
  // We want P180 (depicts), P9149 (coordinates of depicted place), P1259 (point of view),
  // plus some author-ish fields (P2093 author name string, P4174 Wikimedia username),
  // and maybe P571/P580/P585 (time/inception) if present.
  const claims = entity?.claims ?? {};
  const depictsQids = [];
  const coordDepicted = []; // P9149
  const coordPOV = []; // P1259
  const authors = [];

  const getValues = (pid) => Array.isArray(claims[pid]) ? claims[pid] : [];

  // P180
  for (const cl of getValues('P180')) {
    const id = cl?.mainsnak?.datavalue?.value?.id;
    if (id) depictsQids.push(id);
  }

  // P9149: coordinates of depicted place (globecoordinate)
  for (const cl of getValues('P9149')) {
    const v = cl?.mainsnak?.datavalue?.value;
    if (v && Number.isFinite(v.latitude) && Number.isFinite(v.longitude)) {
      coordDepicted.push({lat: v.latitude, lon: v.longitude, globe: v.globe ?? null});
    }
  }

  // P1259: coordinates of the point of view (globecoordinate)
  for (const cl of getValues('P1259')) {
    const v = cl?.mainsnak?.datavalue?.value;
    if (v && Number.isFinite(v.latitude) && Number.isFinite(v.longitude)) {
      coordPOV.push({lat: v.latitude, lon: v.longitude, globe: v.globe ?? null});
    }
  }

  // P2093 author name string
  for (const cl of getValues('P2093')) {
    const v = cl?.mainsnak?.datavalue?.value;
    if (v && typeof v === 'string') authors.push(v);
  }

  // P4174 Wikimedia username
  for (const cl of getValues('P4174')) {
    const v = cl?.mainsnak?.datavalue?.value;
    if (v && typeof v === 'string') authors.push(v);
  }

  // Dates if present (in case it helps)
  const dateSnaks = [...getValues('P571'), ...getValues('P580'), ...getValues('P585')];
  const dates = [];
  for (const cl of dateSnaks) {
    const v = cl?.mainsnak?.datavalue?.value;
    if (v?.time) dates.push(v.time); // raw WbTime like '+2020-06-09T00:00:00Z'
  }

  return {
    depictsQids: Array.from(new Set(depictsQids)),
    sdc_depicted_coords: coordDepicted.length ? coordDepicted[0] : null,
    sdc_pov_coords: coordPOV.length ? coordPOV[0] : null,
    sdc_authors: Array.from(new Set(authors)),
    sdc_dates: dates,
  };
}

function chooseBestCoords({sdc_depicted, sdc_pov, exif_gps, geodata}) {
  if (sdc_depicted) return {lat: sdc_depicted.lat, lon: sdc_depicted.lon, source: 'sdc_depicted'};
  if (sdc_pov) return {lat: sdc_pov.lat, lon: sdc_pov.lon, source: 'sdc_pov'};
  if (exif_gps) return {lat: exif_gps.lat, lon: exif_gps.lon, source: 'exif_gps'};
  if (geodata) return {lat: geodata.lat, lon: geodata.lon, source: 'geodata'};
  return {lat: null, lon: null, source: null};
}

function buildRecord(page, sdc) {
  const title = page.title;
  const pageid = page.pageid;
  const page_url = encodeTitleForUrl(title);
  const imageinfo = Array.isArray(page.imageinfo) ? page.imageinfo[0] : null;

  // Imageinfo/ExtMetadata
  let mime = null, width = null, height = null, sha1 = null;
  let thumb_url = null, original_url = null;
  let ext = {};
  if (imageinfo) {
    mime = imageinfo.mime ?? null;
    width = imageinfo.width ?? null;
    height = imageinfo.height ?? null;
    sha1 = imageinfo.sha1 ?? null;
    original_url = imageinfo.url ?? null;
    thumb_url = imageinfo.thumburl ?? null;
    ext = extractExtMetadata(imageinfo);
  }

  // GeoData
  const {geodata} = extractGeoData(page);
  const categories = extractCategories(page);

  // Structured Data
  const sdcData = extractSDCClaims(sdc);
  const coord_sources = {
    sdc_depicted: sdcData.sdc_depicted_coords,
    sdc_pov: sdcData.sdc_pov_coords,
    exif_gps: ext.exif_gps,
    geodata,
  };
  const best = chooseBestCoords({
    sdc_depicted: coord_sources.sdc_depicted,
    sdc_pov: coord_sources.sdc_pov,
    exif_gps: coord_sources.exif_gps,
    geodata: coord_sources.geodata,
  });

  // Author preference: SDC > ExtMetadata Artist/Credit
  const author = (sdcData.sdc_authors?.length ? sdcData.sdc_authors.join('; ') : null) || ext.author || null;
  const date_taken = (sdcData.sdc_dates?.[0] ?? null) || ext.date_taken || null;

  return {
    title,
    pageid,
    page_url,
    categories,
    depicts_qids: sdcData.depictsQids,
    best_lat: best.lat,
    best_lon: best.lon,
    coord_source: best.source,
    coord_sources,
    description: ext.description || null,
    author,
    credit: ext.credit || null,
    license_short: ext.license_short || null,
    license_url: ext.license_url || null,
    usage_terms: ext.usage_terms || null,
    attribution_required: ext.attribution_required || null,
    copyrighted: ext.copyrighted || null,
    date_taken,
    mime,
    width,
    height,
    sha1,
    thumb_url,
    original_url,
  };
}

// ------------------------------ Resume support -----------------------------

function resumeSeenFromJsonl(file) {
  const seen = new Set();
  if (!RESUME) return seen;
  if (!fs.existsSync(file)) return seen;

  const data = fs.readFileSync(file, 'utf8');
  for (const line of data.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    try {
      const obj = JSON.parse(s);
      if (obj?.pageid != null) seen.add(obj.pageid);
    } catch {
      // ignore broken lines
    }
  }
  console.log(`Resume: loaded ${seen.size} previously written records from ${file}`);
  return seen;
}

function ensureCsvHeader(file, columns) {
  const exists = fs.existsSync(file);
  if (!exists) {
    fs.writeFileSync(file, columns.map(csvEscape).join(',') + '\n');
  }
}

// ------------------------------- Main routine ------------------------------

const CSV_COLUMNS = [
  'title',
  'pageid',
  'page_url',
  'categories',
  'depicts_qids',
  'best_lat',
  'best_lon',
  'coord_source',
  'description',
  'author',
  'credit',
  'license_short',
  'license_url',
  'copyrighted',
  'date_taken',
  'mime',
  'width',
  'height',
  'sha1',
  'thumb_url',
  'original_url',
];

async function writeCsvRow(file, rec) {
  const row = [
    rec.title,
    rec.pageid,
    rec.page_url,
    rec.categories?.join('; ') ?? '',
    rec.depicts_qids?.join('; ') ?? '',
    rec.best_lat ?? '',
    rec.best_lon ?? '',
    rec.coord_source ?? '',
    rec.description ?? '',
    rec.author ?? '',
    rec.credit ?? '',
    rec.license_short ?? '',
    rec.license_url ?? '',
    rec.copyrighted ?? '',
    rec.date_taken ?? '',
    rec.mime ?? '',
    rec.width ?? '',
    rec.height ?? '',
    rec.sha1 ?? '',
    rec.thumb_url ?? '',
    rec.original_url ?? '',
  ].map(csvEscape);
  fs.appendFileSync(file, row.join(',') + '\n');
}

async function fetchAndWriteAll(discovered) {
  // Open JSONL for append (create if missing)
  const jsonlFD = fs.openSync(OUT_JSONL, RESUME && fs.existsSync(OUT_JSONL) ? 'a' : 'w');
  ensureCsvHeader(OUT_CSV, CSV_COLUMNS);

  const seenPageids = resumeSeenFromJsonl(OUT_JSONL);
  const licenseCounts = new Map();
  const originCounts = {sdc_depicts: 0, category: 0, text_search: 0};
  let wrote = seenPageids.size;
  let coordYes = 0;

  // titles → origin (discovery method)
  const titles = Array.from(discovered.keys());
  const origins = discovered;

  // Fetch in batches to reduce API calls: 40 titles per batch (safe)
  const titleChunks = chunk(titles, 40);

  // Prepare partial summary for origins
  for (const [title, origin] of origins.entries()) {
    if (originCounts[origin] != null) originCounts[origin]++;
  }

  // Process batches concurrently (but keep memory reasonable)
  let processed = 0;
  for (let i = 0; i < titleChunks.length; i += CONCURRENCY) {
    const slice = titleChunks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      slice.map(async (group) => {
        // 1) prop=imageinfo|coordinates|categories
        const pages = await fetchBatchPageDataByTitles(group);
        const validPages = pages.filter((p) => p && p.ns === 6); // files only
        if (!validPages.length) return [];

        // 2) SDC MediaInfo for these pageids
        const pageids = validPages.map((p) => p.pageid);
        const sdcMap = await fetchBatchMediaInfoByPageids(pageids);

        // Build records per page
        const recs = [];
        for (const page of validPages) {
          // Dedup on resume by pageid
          if (seenPageids.has(page.pageid)) continue;

          const mid = `M${page.pageid}`;
          const sdcEnt = sdcMap[mid] || {};
          const rec = buildRecord(page, sdcEnt);

          // Track coord coverage
          if (Number.isFinite(rec.best_lat) && Number.isFinite(rec.best_lon)) coordYes++;

          // Track license
          if (rec.license_short) {
            licenseCounts.set(
              rec.license_short,
              (licenseCounts.get(rec.license_short) ?? 0) + 1
            );
          }

          // Write JSONL
          fs.writeFileSync(jsonlFD, JSON.stringify(rec) + '\n');
          // Write CSV
          await writeCsvRow(OUT_CSV, rec);

          seenPageids.add(page.pageid);
          recs.push(rec);
        }
        return recs;
      })
    );

    processed += results.reduce((a, r) => a + r.length, 0);

    // Persist progress every ~500 files (JSONL/CSV are already appended; just log)
    if (processed && processed % 500 === 0) {
      console.log(`Progress: wrote ${processed} new records so far...`);
    }
  }

  fs.closeSync(jsonlFD);

  // Final summary
  const totalNew = processed;
  const totalAll = seenPageids.size;
  const coordPct = totalNew ? ((coordYes / totalNew) * 100).toFixed(1) : '0.0';

  const topLicenses = Array.from(licenseCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' | ');

  console.log('---- SUMMARY ----');
  console.log(`Discovery totals (titles encountered): SDC ${originCounts.sdc_depicts}, Category ${originCounts.category}, Text ${originCounts.text_search}`);
  console.log(`New records written this run: ${totalNew}`);
  console.log(`Total records present in ${OUT_JSONL}: ${totalAll}`);
  console.log(`% with coordinates (this run): ${coordPct}%`);
  console.log(`Top licenses: ${topLicenses || '(none found)'}`);
}

// ------------------------------- Debug / single ----------------------------

async function debugOne(title) {
  console.log(`DebugOne for: ${title}`);
  // Normalize: ensure it starts with "File:"
  const t = title.startsWith('File:') ? title : `File:${title}`;

  const pages = await fetchBatchPageDataByTitles([t]);
  if (!pages.length || pages[0].missing) {
    console.error('Page not found or not a file.');
    return;
  }
  const page = pages[0];
  const sdc = (await fetchBatchMediaInfoByPageids([page.pageid]))[`M${page.pageid}`] || {};
  const rec = buildRecord(page, sdc);

  // Basic assertion: at least one coord source present
  const hasAnyCoord =
    (rec.coord_sources?.sdc_depicted) ||
    (rec.coord_sources?.sdc_pov) ||
    (rec.coord_sources?.exif_gps) ||
    (rec.coord_sources?.geodata);
  if (!hasAnyCoord) {
    console.warn('WARN: No coordinates found from any source for this file.');
  }

  console.log(JSON.stringify(rec, null, 2));
}

// ----------------------------------- Run -----------------------------------

(async () => {
  try {
    if (DEBUG_ONE) {
      await debugOne(DEBUG_ONE);
      return;
    }

    console.log('Discovering file titles...');
    const discovered = await discoverAllFileTitles();
    console.log(`Discovered titles: ${discovered.size}`);

    await fetchAndWriteAll(discovered);
  } catch (err) {
    console.error('Fatal:', err);
    process.exitCode = 1;
  }
})();
