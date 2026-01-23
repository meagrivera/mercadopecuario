// ad.js (COPIAR Y PEGAR)
// ====== NOTA IMPORTANTE ======
// Si en producción "no se ven los detalles", casi seguro es que:
// 1) GitHub Pages está sirviendo un JS viejo (cache). -> ya lo forzamos con ?v=999 en ad.html
// 2) El JS está reventando por un error (y por eso solo se ve arriba).
// Este ad.js incluye un "debug overlay" visible en pantalla para saber EXACTAMENTE qué pasa.

// ========= CONFIG =========
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyIddCr3ovzxG4pcLhvzITS3vODCmDuXx1B2a50gDyJGEAwiEWtM3matwQNWkR9ta0n/exec";

// ========= HELPERS =========
function qs(name) {
  return new URL(window.location.href).searchParams.get(name);
}

function el(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const node = el(id);
  if (!node) return false;
  node.textContent = value;
  return true;
}

function setHtml(id, value) {
  const node = el(id);
  if (!node) return false;
  node.innerHTML = value;
  return true;
}

function driveToDirect(urlOrId) {
  if (!urlOrId) return "";
  const s = String(urlOrId).trim();

  const looksLikeId = /^[a-zA-Z0-9_-]{20,}$/.test(s) && !s.includes("http");
  const m =
    s.match(/\/d\/([a-zA-Z0-9_-]{20,})\//) ||
    s.match(/[?&]id=([a-zA-Z0-9_-]{20,})/) ||
    s.match(/\/uc\?export=view&id=([a-zA-Z0-9_-]{20,})/);

  const id = looksLikeId ? s : (m && m[1] ? m[1] : "");
  if (!id) return s;

  return `https://drive.google.com/thumbnail?id=${id}&sz=w2000`;
}

function setMeta(nameOrProp, value, isProp = false) {
  const sel = isProp
    ? `meta[property="${nameOrProp}"]`
    : `meta[name="${nameOrProp}"]`;
  const meta = document.querySelector(sel);
  if (meta) meta.setAttribute("content", value);
}

function setCanonical(url) {
  const link = document.querySelector('link[rel="canonical"]');
  if (link) link.setAttribute("href", url);
}

// ===== Debug overlay (visible) =====
function ensureDebugBox() {
  let box = document.getElementById("__mp_debug");
  if (box) return box;

  box = document.createElement("div");
  box.id = "__mp_debug";
  box.style.cssText =
    "position:fixed;left:12px;bottom:12px;z-index:99999;max-width:92vw;" +
    "background:#fff;border:1px solid #ddd;border-radius:10px;padding:10px 12px;" +
    "font-family:monospace;font-size:12px;box-shadow:0 8px 20px rgba(0,0,0,.15);" +
    "white-space:pre-wrap;word-break:break-word;opacity:.92";
  box.textContent = "debug: cargando...";
  document.body.appendChild(box);
  return box;
}

function debug(msg) {
  const box = ensureDebugBox();
  box.textContent = String(msg);
}

// Carga JSONP (evita CORS)
function loadJsonp(url, cbName) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timeout cargando JSONP"));
    }, 12000);

    function cleanup() {
      clearTimeout(timeout);
      script.remove();
      try { delete window[cbName]; } catch (_) { window[cbName] = undefined; }
    }

    window[cbName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Error cargando JSONP"));
    };

    document.body.appendChild(script);
  });
}

// ========= RENDER =========
function kv(label, value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const d = document.createElement("div");
  d.className = "kv-item";
  d.innerHTML = `<b>${label}</b><span>${value}</span>`;
  return d;
}

function showError(msg) {
  setText("adTitle", "No se pudo cargar el anuncio");
  setText("adSubtitle", "Verificá el link o el ID del anuncio.");
  setHtml("adMedia", `<div class="ad-media-placeholder">Sin datos para mostrar</div>`);
  setText("privacyHint", "");

  const box = el("adError");
  if (box) {
    box.style.display = "block";
    box.textContent = msg;
  }

  const btn = el("btnWhatsapp");
  if (btn) btn.style.display = "none";

  debug("ERROR:\n" + msg);
}

function renderAdFromPayload(payload) {
  const ad = payload?.adClean || payload?.ad || {};
  const waLink = payload?.waLink || "";

  debug(
    "Render OK\n" +
    "keys(payload): " + Object.keys(payload || {}).join(", ") + "\n" +
    "keys(ad): " + Object.keys(ad || {}).join(", ")
  );

  const tipo = (ad.tipo || "").toString();
  const tipoAnimal = (ad.tipoAnimal || "").toString();

  const title = [tipoAnimal, tipo].filter(Boolean).join(" • ") || `Anuncio ${ad.id || ""}`;
  const subtitle = [ad.ubicacion, ad.raza].filter(Boolean).join(" • ") || "Mercado Pecuario • ficha pública";

  setText("adTitle", title);
  setText("adSubtitle", subtitle);

  // Media (primera foto)
  const fotosStr = (ad.fotos || "").toString();
  const first = fotosStr.split(",").map(s => s.trim()).filter(Boolean)[0];
  const imgUrl = driveToDirect(first);

  const media = el("adMedia");
  if (media) {
    media.innerHTML = "";
    if (imgUrl) {
      const img = document.createElement("img");
      img.src = imgUrl;
      img.alt = `Foto del anuncio ${ad.id || ""}`;
      img.loading = "eager";
      img.decoding = "async";
      img.onerror = () => {
        media.innerHTML = `<div class="ad-media-placeholder">No se pudo cargar la foto</div>`;
      };
      media.appendChild(img);

      setMeta("og:image", imgUrl, true);
      setMeta("twitter:image", imgUrl, false);
    } else {
      media.innerHTML = `<div class="ad-media-placeholder">Sin foto disponible</div>`;
    }
  }

  // KV
  const kvWrap = el("adKv");
  if (kvWrap) {
    kvWrap.innerHTML = "";
    const pairs = [
      ["ID", ad.id],
      ["Sexo", ad.sexo],
      ["Edad", ad.edad],
      ["Peso (kg)", ad.pesoKg],
      ["Precio (C$)", ad.precioC],
      ["Raza", ad.raza],
      ["Ubicación", ad.ubicacion],
    ];

    pairs.forEach(([k, v]) => {
      const node = kv(k, v);
      if (node) kvWrap.appendChild(node);
    });
  } else {
    debug("ERROR: No existe el div #adKv en el HTML");
  }

  // Descripción
  setText("adDesc", ad.descripcion || "—");

  // ✅ TIMESTAMP REMOVIDO COMPLETAMENTE (no tocamos adUpdated)
  // Si querés limpiar por si quedó algo, podés:
  const upd = el("adUpdated");
  if (upd) upd.textContent = "";

  // WhatsApp
  const btn = el("btnWhatsapp");
  if (btn) {
    if (waLink) {
      btn.href = waLink;
      btn.style.display = "inline-block";
      setText("privacyHint", "Privacidad: el número no se muestra. Contactá al anunciante por WhatsApp.");
    } else {
      btn.style.display = "none";
      setText("privacyHint", "");
    }
  }

  // Meta dinámico
  document.title = `Mercado Pecuario | ${title}`;
  setMeta("description", `${title}. ${subtitle}`.slice(0, 150), false);

  setMeta("og:title", `Mercado Pecuario | ${title}`, true);
  setMeta("og:description", subtitle, true);
  setMeta("twitter:title", `Mercado Pecuario | ${title}`, false);
  setMeta("twitter:description", subtitle, false);

  const canonical = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(ad.id || "")}`;
  setCanonical(canonical);
  setMeta("og:url", canonical, true);
}

// ========= LOAD =========
async function loadAd() {
  const id = qs("id");
  if (!id) {
    showError("Falta el parámetro ?id= (ej: ad.html?id=1755428275220)");
    return;
  }

  debug("Cargando anuncio...\nID=" + id);

  // 1) Intento JSON normal
  try {
    const url = `${APPS_SCRIPT_URL}?action=getAd&id=${encodeURIComponent(id)}`;
    debug("Fetch JSON...\n" + url);

    const res = await fetch(url, { method: "GET" });
    debug("Fetch status: " + res.status);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (!data || data.ok === false) throw new Error(data?.error || "Anuncio no encontrado");

    renderAdFromPayload(data);
    return;
  } catch (e) {
    debug("JSON falló, probando JSONP...\n" + String(e?.message || e));
  }

  // 2) Fallback JSONP
  try {
    const cbName = "__mpRenderAd_" + Math.random().toString(36).slice(2);
    const url =
      `${APPS_SCRIPT_URL}?action=getAd&id=${encodeURIComponent(id)}&callback=${encodeURIComponent(cbName)}`;

    debug("JSONP...\n" + url);

    const data = await loadJsonp(url, cbName);
    if (!data || data.ok === false) throw new Error(data?.error || "Anuncio no encontrado");

    renderAdFromPayload(data);
  } catch (err) {
    showError(`Error: ${String(err && err.message ? err.message : err)}`);
  }
}

document.addEventListener("DOMContentLoaded", loadAd);
