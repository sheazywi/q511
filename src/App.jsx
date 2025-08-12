import React, { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipForward, SkipBack, RefreshCw, Filter, Search, Shuffle, ExternalLink, MapPin, Timer, Image as ImageIcon, Video as VideoIcon, AlertTriangle, Clock, Globe, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Papa from "papaparse";

/**
 * Québec 511 – Cameras Slideshow (no-iframe, proxy‑friendly)
 *
 * You saw “Zen can’t open this page…” because the site sends
 * X-Frame-Options / CSP frame-ancestors that block embedding pages.
 * Fix: I removed the <iframe> fallback completely. We now use only:
 *  - HLS (.m3u8) via hls.js (when Live is ON)
 *  - JPEG snapshots that auto-refresh (default)
 * If both still fail, we show a button to open the original in a new tab.
 */

const DEFAULT_TZ = "America/Toronto";
// Proxy-aware base (dev/prod). In dev, point Vite/Netlify/Vercel to rewrite `/q511/*` → https://www.quebec511.info/*
const ORIGIN = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_Q511_BASE)
  ? import.meta.env.VITE_Q511_BASE
  : (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname.endsWith('.local'))
      ? '/q511'
      : 'https://www.quebec511.info');

const ENDPOINTS = {
  geojson:
    "https://ws.mapserver.transports.gouv.qc.ca/swtq?service=wfs&version=2.0.0&request=getfeature&typename=ms:infos_cameras&outfile=Camera&srsname=EPSG:4326&outputformat=geojson",
  csv:
    "https://ws.mapserver.transports.gouv.qc.ca/swtq?service=wfs&version=2.0.0&request=getfeature&typename=ms:infos_cameras&outfile=Camera&outputformat=csv",
};

function normalizeCamera(r) {
  return {
    id: String(r.IDEcamera || r.idecamera || r.id || ""),
    number: String(r.NumeroCamera || r.numerocamera || ""),
    nameFr: (r.DescriptionLocalisationFr || "").trim(),
    nameEn: (r.DescriptionLocalisationEn || "").trim(),
    since: (r.DateDebutDiffusion || "").trim(),
    route: String(r.NumeroRoute || "").trim(),
    region: (r.NomRegionDiffusion || "").trim(),
    border: (r.NomPosteFrontalier || "").trim(),
    bridge: (r.NomPontFrontalier || "").trim(),
    url: (r.URL_FLUX_DONNEE || r.url_flux_donnee || r.url || "").trim(),
    // some records include a direct image url (French key)
    imgDirect: (r["url-image-en-direct"] || r.url_image_en_direct || "").trim?.() || "",
    lat: r.lat,
    lon: r.lon,
  };
}

function useCameras() {
  const [cameras, setCameras] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const gjRes = await fetch(ENDPOINTS.geojson, { cache: "no-store" });
        if (gjRes.ok) {
          const gj = await gjRes.json();
          const items = (gj.features || []).map((f) => {
            const p = f.properties || {};
            const [lon, lat] = f.geometry?.coordinates || [undefined, undefined];
            return normalizeCamera({ ...p, lat, lon });
          });
          if (!cancelled) {
            setCameras(items);
            setRegions(Array.from(new Set(items.map((c) => c.region))).sort());
            setLoading(false);
          }
          return;
        }
        const res = await fetch(ENDPOINTS.csv, { cache: "no-store" });
        if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
        const text = await res.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        const items = parsed.data.map((row) => normalizeCamera(row));
        if (!cancelled) {
          setCameras(items);
          setRegions(Array.from(new Set(items.map((c) => c.region))).sort());
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError("Failed to load cameras (maybe CORS). Try a dev proxy or build-time fetch.");
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return { cameras, regions, loading, error, reload: () => window.location.reload() };
}

function RegionFilter({ regions, value, onChange }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2"><Filter size={16}/> {value || "All regions"}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-auto">
        <DropdownMenuLabel>Filter by region</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onChange("")}>All regions</DropdownMenuItem>
        {regions.map((r) => (
          <DropdownMenuItem key={r} onClick={() => onChange(r)}>{r}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function extractIdFromFenetre(url) {
  try {
    const u = new URL(url);
    const id = u.searchParams.get("id");
    return id ? String(id) : "";
  } catch {
    return "";
  }
}

function buildVariants(camera, salt = 0) {
  const fen = camera?.url || "";
  const id = extractIdFromFenetre(fen);
  if (!id) return {};
  const withSalt = (u) => (u ? `${u}${u.includes("?") ? "&" : "?"}_rs=${salt}` : u);
  const primarySnap = camera?.imgDirect || `${ORIGIN}/Images/Cameras/Quebec/cam/${id}.jpg`;
  return {
    id,
    snap: withSalt(primarySnap), // primary (dataset-provided or path)
    jpg: withSalt(`${ORIGIN}/Carte/Fenetres/camera.ashx?id=${id}&format=jpg`), // alt
    m3u8: withSalt(`${ORIGIN}/Carte/Fenetres/camera.ashx?id=${id}&format=m3u8`), // optional live
    html: withSalt(fen),
  };
}

function formatInZone(d, tz, hour24 = true) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: !hour24,
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function MediaPane({ camera, tz, hour24, onLoaded, refreshMs = 1500, live = false, restartSec = 5 }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [salt, setSalt] = useState(0); // forces URL refresh
  const variants = useMemo(() => buildVariants(camera, salt), [camera?.id, salt]);
  const [mode, setMode] = useState(live ? "hls" : "snap"); // "hls" | "snap" | "jpg"
  const [timeInfo, setTimeInfo] = useState({ source: "", date: null });
  const now = useNow(1000);
  const [debugUrl, setDebugUrl] = useState("");
  const [dead, setDead] = useState(false);

  // reset when camera changes
  useEffect(() => {
    if (!camera) return;
    setMode(live ? "hls" : "snap");
    setTimeInfo({ source: "", date: null });
    setSalt(0);
    setDead(false);
    hlsRef.current?.destroy?.();
    hlsRef.current = null;
  }, [camera?.id, live]);

  // periodic refresh (snapshots)
  useEffect(() => {
    if (dead) return;
    if (mode !== "snap" && mode !== "jpg") return;
    const t = setInterval(() => setSalt((s) => s + 1), Math.max(500, refreshMs));
    return () => clearInterval(t);
  }, [mode, refreshMs, dead]);

  const onSnapError = () => {
    setDead((was) => {
      if (was) return true; // already dead
      if (mode === "snap") { setMode("jpg"); return false; }
      return true; // was jpg and failed → mark dead
    });
  };

  // Live HLS (optional). Requires proxy/CORS.
  useEffect(() => {
    let cancelled = false;
    async function attach() {
      if (!live || mode !== "hls" || !variants.m3u8 || !videoRef.current) return;
      try {
        const Hls = (await import("hls.js")).default;
        const hls = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 1, backBufferLength: 0 });
        hlsRef.current?.destroy?.();
        hlsRef.current = hls;
        hls.loadSource(variants.m3u8);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          try { hls.seekToLivePosition(); } catch {}
          videoRef.current?.play?.();
          setDebugUrl(variants.m3u8);
          onLoaded?.();
        });
        hls.on(Hls.Events.ERROR, () => { if (!cancelled) { setMode("snap"); setDead(false); } });
      } catch {
        if (!cancelled) { setMode("snap"); setDead(false); }
      }
    }
    attach();
    return () => { cancelled = true; };
  }, [live, mode, variants.m3u8, onLoaded]);

  // Live: bump salt + seek live edge periodically
  useEffect(() => {
    if (!live || mode !== "hls" || !restartSec) return;
    const t = setInterval(() => {
      setSalt((s) => s + 1);
      try { hlsRef.current?.seekToLivePosition?.(); } catch {}
    }, Math.max(2, restartSec) * 1000);
    return () => clearInterval(t);
  }, [live, mode, restartSec]);

  // Set time when something loads (fallback: local)
  const setLoadedNow = () => { if (!timeInfo.date) setTimeInfo({ source: "Local", date: new Date() }); onLoaded?.(); };

  const rel = useMemo(() => {
    if (!timeInfo.date) return "";
    const diff = Math.max(0, now - timeInfo.date);
    const s = Math.round(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ago`;
  }, [now, timeInfo.date]);

  return (
    <div className="relative w-full h-full bg-black">
      {live && mode === "hls" && (
        <video
          key={`m3u8-${camera.id}-${salt}`}
          ref={videoRef}
          className="w-full h-full"
          controls={false}
          autoPlay
          muted
          playsInline
          preload="auto"
        />
      )}
      {!live && !dead && (mode === "snap" || mode === "jpg") && (
        <img
          key={`${mode}-${camera.id}-${salt}`}
          src={mode === "snap" ? variants.snap : variants.jpg}
          alt={camera.nameEn || camera.nameFr || camera.id}
          className="w-full h-full object-contain bg-black"
          onLoad={setLoadedNow}
          onError={onSnapError}
        />
      )}
      {dead && (
        <div className="absolute inset-0 grid place-items-center text-white text-sm p-4">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-amber-300"><AlertTriangle size={16}/> Source blocked or unavailable</div>
            <a href={camera.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-2">
              <ExternalLink size={14}/> Open original in new tab
            </a>
          </div>
        </div>
      )}

      {/* Overlays */}
      <div className="absolute left-3 bottom-3 right-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="px-2 py-1 rounded-full bg-black/60 text-white flex items-center gap-1">
          {live && mode === "hls" ? <VideoIcon size={14} /> : <ImageIcon size={14} />} {live && mode === "hls" ? "LIVE" : dead ? "UNAVAILABLE" : "SNAPSHOT"}
        </span>
        <span className="px-2 py-1 rounded-full bg-black/60 text-white flex items-center gap-1"><MapPin size={14}/>{camera.region || "—"} · Rte {camera.route || "—"}</span>
        {timeInfo.date && (
          <span className="px-2 py-1 rounded-full bg-black/60 text-white flex items-center gap-1"><Clock size={14}/>
            {formatInZone(timeInfo.date, tz, true)}
            <span className="opacity-70 ml-1">(loaded)</span>
          </span>
        )}
        {timeInfo.date && (
          <span className="px-2 py-1 rounded-full bg-black/60 text-white">{rel}</span>
        )}
        <a href={camera.url} target="_blank" rel="noreferrer" className="px-2 py-1 rounded-full bg-black/60 text-white flex items-center gap-1 hover:bg-black/70"><ExternalLink size={14}/>Open original</a>
        {debugUrl && (
          <span className="px-2 py-1 rounded-full bg-black/50 text-white/80 hidden sm:flex items-center gap-1"><Bug size={14}/>src: {debugUrl.replace(ORIGIN, "").slice(0, 60)}…</span>
        )}
      </div>
    </div>
  );
}

function useShuffle(list, enabled) {
  return useMemo(() => {
    if (!enabled) return list;
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [list, enabled]);
}

function Slideshow({ items, dwellSec = 10, autoplay = true, shuffle = false, tz, hour24, live = false, refreshMs = 1500, restartSec = 5 }) {
  const list = useShuffle(items, shuffle);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(autoplay);
  const current = list[index % Math.max(list.length, 1)];

  useEffect(() => { setIndex(0); }, [list.length]);

  // advance
  useEffect(() => {
    if (!playing || !current) return;
    const dwellTimer = setTimeout(() => next(), Math.max(3, dwellSec) * 1000);
    return () => clearTimeout(dwellTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, index, dwellSec, current?.id]);

  const next = () => setIndex((i) => (i + 1) % Math.max(list.length, 1));
  const prev = () => setIndex((i) => (i - 1 + Math.max(list.length, 1)) % Math.max(list.length, 1));

  return (
    <div className="rounded-2xl overflow-hidden shadow ring-1 ring-black/5 bg-white">
      <div className="relative w-full aspect-video bg-black">
        {current ? (
          <MediaPane camera={current} tz={tz} hour24={hour24} live={live} refreshMs={refreshMs} restartSec={restartSec} onLoaded={() => {}} />
        ) : (
          <div className="w-full h-full grid place-items-center text-white/80 text-sm">No cameras match.</div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-center gap-3 p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prev}><SkipBack/></Button>
          <Button variant="default" size="icon" onClick={() => setPlaying((p) => !p)}>{playing ? <Pause/> : <Play/>}</Button>
          <Button variant="outline" size="icon" onClick={next}><SkipForward/></Button>
        </div>
        <div className="flex items-center gap-2 ml-0 sm:ml-4">
          <Shuffle size={16} className="opacity-70"/>
          <span className="text-sm text-muted-foreground">Shuffle in filter</span>
        </div>
        <div className="flex items-center gap-2 ml-0 sm:ml-auto w-full sm:w-[32rem]">
          <Timer size={16} className="opacity-70"/>
          <div className="flex items-center gap-2 w-72">
            <span className="text-xs text-muted-foreground w-28">Snapshot refresh</span>
            <Slider value={[refreshMs]} min={500} max={5000} step={100} onValueChange={([v]) => { /* lifted to App in real app */ }} disabled/>
            <span className="text-sm w-14 text-right">{Math.round(refreshMs/1000)}s</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { cameras, regions, loading, error, reload } = useCameras();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("Outaouais"); // default region
  const [dwellSec, setDwellSec] = useState(10);
  const [autoplay, setAutoplay] = useState(true);
  const [shuffle, setShuffle] = useState(false);
  const [tz, setTz] = useState(DEFAULT_TZ);
  const [hour24, setHour24] = useState(true);
  const [live, setLive] = useState(false); // OFF by default (snapshots)
  const [refreshMs, setRefreshMs] = useState(1500);
  const [restartSec, setRestartSec] = useState(5);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cameras.filter((c) => {
      const inRegion = !region || c.region === region;
      const hay = `${c.nameEn} ${c.nameFr} ${c.route} ${c.region} ${c.bridge} ${c.border}`.toLowerCase();
      const match = !q || hay.includes(q);
      return inRegion && match && !!c.url;
    });
  }, [cameras, region, query]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <header className="sticky top-0 z-30 backdrop-blur bg-white/75 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="text-xl font-bold tracking-tight">Québec 511 • Slideshow</div>
            <span className="text-xs text-muted-foreground">Snapshots by default · Live optional · No iframes</span>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-initial">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2" size={16} />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search road, place, bridge…" className="pl-8" />
            </div>
            <RegionFilter regions={regions} value={region} onChange={setRegion} />
            <Button variant="outline" onClick={reload} className="gap-2"><RefreshCw size={16}/>Refresh data</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Settings */}
        <Card className="shadow-sm">
          <CardContent className="p-4 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Switch checked={autoplay} onCheckedChange={setAutoplay} id="autoplay" />
                <label htmlFor="autoplay" className="text-sm">Autoplay</label>
                <div className="ml-4 flex items-center gap-2 w-64">
                  <Timer size={16} className="opacity-70"/>
                  <Slider value={[dwellSec]} min={3} max={30} step={1} onValueChange={([v]) => setDwellSec(v)} />
                  <span className="text-sm w-10 text-right">{dwellSec}s</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={shuffle} onCheckedChange={setShuffle} id="shuffle" />
                <label htmlFor="shuffle" className="text-sm flex items-center gap-1"><Shuffle size={16}/>Shuffle order</label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div className="flex items-center gap-3">
                <Switch checked={live} onCheckedChange={setLive} id="live" />
                <label htmlFor="live" className="text-sm flex items-center gap-1"><VideoIcon size={16}/>Live video (needs CORS)</label>
              </div>
              <div className="flex items-center gap-3">
                <Globe size={16} className="opacity-70"/>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">Timezone: {tz === "UTC" ? "UTC" : "America/Toronto"}</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setTz(DEFAULT_TZ)}>America/Toronto</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTz("UTC")}>UTC</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div className="flex items-center gap-2">
                <Timer size={16} className="opacity-70"/>
                <span className="text-sm">Snapshot refresh</span>
                <div className="flex items-center gap-2 w-64">
                  <Slider value={[refreshMs]} min={500} max={5000} step={100} onValueChange={([v]) => setRefreshMs(v)} />
                  <span className="text-sm w-14 text-right">{Math.round(refreshMs/1000)}s</span>
                </div>
              </div>
              {live && (
                <div className="flex items-center gap-2">
                  <Timer size={16} className="opacity-70"/>
                  <span className="text-sm">Live‑edge refresh</span>
                  <div className="flex items-center gap-2 w-64">
                    <Slider value={[restartSec]} min={2} max={20} step={1} onValueChange={([v]) => setRestartSec(v)} />
                    <span className="text-sm w-10 text-right">{restartSec}s</span>
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              No iframes (site blocks framing). Use snapshots or enable Live with a proxy.
            </div>
          </CardContent>
        </Card>

        <Slideshow items={filtered} dwellSec={dwellSec} autoplay={autoplay} shuffle={shuffle} tz={tz} hour24={hour24} live={live} refreshMs={refreshMs} restartSec={restartSec} />

        {/* Quick peek list */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.slice(0, 24).map((c) => (
            <div key={c.id} className="p-3 rounded-xl border bg-white/70">
              <div className="font-medium truncate" title={c.nameEn || c.nameFr}>{c.nameEn || c.nameFr}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1"><MapPin size={14}/>{c.region || "—"} · Route {c.route || "—"}</div>
            </div>
          ))}
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 pb-8 pt-4 text-xs text-muted-foreground">
        Data © Gouvernement du Québec – MTMD (Québec 511), CC BY 4.0. Unofficial viewer.
      </footer>
    </div>
  );
}


/*
========================================
DEV/PROD PROXY QUICK SETUP (copy & paste)
========================================

A) Local dev with Vite (vite.config.ts)
--------------------------------------
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // App builds URLs like "/q511/Carte/..." when on localhost
      '/q511': {
        target: 'https://www.quebec511.info',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/q511/, ''),
      },
      // HLS manifests often reference absolute segment paths like "/Carte/..."
      '/Carte': {
        target: 'https://www.quebec511.info',
        changeOrigin: true,
        secure: true,
      },
      '/Images': {
        target: 'https://www.quebec511.info',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})

# optional .env.local
# VITE_Q511_BASE can override the base if you deploy behind a subpath
# VITE_Q511_BASE=/q511

Run:  npm run dev
Then in the app Settings, toggle **Live video** on.

B) Netlify (netlify.toml)
-------------------------
[[redirects]]
  from = "/q511/*"
  to = "https://www.quebec511.info/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/Carte/*"
  to = "https://www.quebec511.info/Carte/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/Images/*"
  to = "https://www.quebec511.info/Images/:splat"
  status = 200
  force = true

[[headers]]
  for = "/Images/*"
  [headers.values]
  Cache-Control = "no-cache"

C) Vercel (vercel.json)
-----------------------
{
  "rewrites": [
    { "source": "/q511/:path*", "destination": "https://www.quebec511.info/:path*" },
    { "source": "/Carte/:path*", "destination": "https://www.quebec511.info/Carte/:path*" },
    { "source": "/Images/:path*", "destination": "https://www.quebec511.info/Images/:path*" }
  ],
  "headers": [
    { "source": "/Images/:path*", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }
  ]
}

D) Nginx (server block)
-----------------------
location /q511/ {
  proxy_pass https://www.quebec511.info/;
  proxy_set_header Host www.quebec511.info;
}
location /Carte/ {
  proxy_pass https://www.quebec511.info/Carte/;
  proxy_set_header Host www.quebec511.info;
}
location /Images/ {
  proxy_pass https://www.quebec511.info/Images/;
  proxy_set_header Host www.quebec511.info;
}

E) Cloudflare Pages (_redirects)
--------------------------------
/q511/*   https://www.quebec511.info/:splat   200
/Carte/*  https://www.quebec511.info/Carte/:splat  200
/Images/* https://www.quebec511.info/Images/:splat 200

Notes
-----
• No iframes: Québec 511 blocks framing with security headers.
• Stick to JPG/HLS endpoints; the proxy is only for CORS, not framing.
• If a cam still loops, it's upstream. Leave **Live video** off; snapshots will still update.
*/
