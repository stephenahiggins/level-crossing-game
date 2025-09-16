import flagsData from '../assets/flags_base64.json';

const flagMap = flagsData as Record<string, string>;

const fallback =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgODAiPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iODAiIGZpbGw9IiMxQTUzNUMiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSIyMiIgZmlsbD0iI0ZGRTY2RCI+PzwvdGV4dD48L3N2Zz4=';

export const getFlagBase64 = (code: string): string => flagMap[code] ?? fallback;

export const listKnownFlags = () => Object.keys(flagMap);
