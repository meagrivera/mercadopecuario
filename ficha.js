// ficha.js (COPIAR Y PEGAR)
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyIddCr3ovzxG4pcLhvzITS3vODCmDuXx1B2a50gDyJGEAwiEWtM3matwQNWkR9ta0n/exec";

function qs(name) {
  return new URL(window.location.href).searchParams.get(name);
}

function setMeta(nameOrProp, value, isProp = false) {
  const sel = isProp ? `meta[property="${nameOrProp}"]` : `meta[name="${nameOrProp}"]`;
  const el = document.querySelector(sel);
  if (el) el.setAttribute("content", value);
}

function setCanonical(url) {
  const link = document.querySelector('link[rel="canonical"]');
  if (link) link.setAttribute("href", url);
}

function driveToThumb(urlOrId) {
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

// JSONP (por si CORS molesta en algún entorno)
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

    window[cbName] = (data) => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error("Error cargando JSONP")); };

    document.body.appendChild(script);
  });
}

function showError(msg) {
  const box = document.getElementById("mpError");
  box.style.display = "block";
  box.textContent = msg;

  document.getElementById("mpTitle").textContent = "No se pudo cargar el anuncio";
  document.getElementById("mpSubtitle").textContent = "Verificá el link o el ID del anuncio.";
  document.getElementById("mpMedia").innerHTML = `<div class="mp-media-placeholder">Sin datos para mostrar</div>`;
  document.getElementById("btnWhatsapp").style.display = "none";
}

function render(payload) {
  const ad = payload?.adClean || payload?.ad || {};
  const waLink = payload?.waLink || "";

  const tipo = String(ad.tipo || "");
  const tipoAnimal = String(ad.tipoAnimal || "");

  const title = [tipoAnimal, tipo].filter(Boolean).join(" • ") || `Anuncio ${ad.id || ""}`;
  const subtitle = [ad.ubicacion, ad.raza].filter(Boolean).join(" • ") || "Mercado Pecuario • ficha pública";

  document.getElementById("mpTitle").textContent = title;
  document.getElementById("mpSubtitle").textContent = subtitle;

  // Media
  const fotosStr = String(ad.fotos || "");
  const first = fotosStr.split(",").map(s => s.trim()).filter(Boolean)[0];
  const imgUrl = driveToThumb(first);

  const media = document.getElementById("mpMedia");
  media.innerHTML = "";
  if (imgUrl) {
    const img = document.createElement("img");
    img.src = imgUrl;
    img.alt = `Foto del anuncio ${ad.id || ""}`;
    img.loading = "eager";
    img.decoding = "async";
    media.appendChild(img);

    setMeta("og:image", imgUrl, true);
    setMeta("twitter:image", imgUrl, false);
  } else {
    media.innerHTML = `<div class="mp-media-placeholder">Sin foto disponible</div>`;
  }

  // KV
  const kv = document.getElementById("mpKv");
  kv.innerHTML = `
    <div class="mp-kv-item"><b>ID</b><span>${ad.id ?? "—"}</span></div>
    <div class="mp-kv-item"><b>Sexo</b><span>${ad.sexo ?? "—"}</span></div>
    <div class="mp-kv-item"><b>Edad</b><span>${ad.edad ?? "—"}</span></div>
    <div class="mp-kv-item"><b>Peso (kg)</b><span>${ad.pesoKg ?? "—"}</span></div>
    <div class="mp-kv-item"><b>Precio (C$)</b><span>${ad.precioC ?? "—"}</span></div>
    <div class="mp-kv-item"><b>Raza</b><span>${ad.raza ?? "—"}</span></div>
    <div class="mp-kv-item"><b>Ubicación</b><span>${ad.ubicacion ?? "—"}</span></div>
  `;

  // Desc
  document.getElementById("mpDesc").textContent = ad.descripcion || "—";

  // WhatsApp
  const btn = document.getElementById("btnWhatsapp");
  if (waLink) {
    btn.href = waLink;
    btn.style.display = "inline-block";
    document.getElementById("privacyHint").textContent =
      "Privacidad: el número no se muestra. Contactá al anunciante por WhatsApp.";
  } else {
    btn.style.display = "none";
    document.getElementById("privacyHint").textContent = "";
  }

  // Meta
  document.title = `Mercado Pecuario | ${title}`;
  setMeta("description", `${title}. ${subtitle}`.slice(0, 150), false);
  setMeta("og:title", `Mercado Pecuario | ${title}`, true);
  setMeta("og:description", subtitle, true);
  setMeta("twitter:title", `Mercado Pecuario | ${title}`, false);
  setMeta("twitter:description", subtitle, false);

  const canonical = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(ad.id || "")}`;
  setCanonical(canonical);
  setMeta("og:url", canonical, true);

  // ocultar error si todo ok
  const err = document.getElementById("mpError");
  err.style.display = "none";
  err.textContent = "";
}

async function load() {
  const id = qs("id");
  if (!id) return showError("Falta el parámetro ?id= (ej: ficha.html?id=1755428275220)");

  // 1) JSON normal
  try {
    const url = `${APPS_SCRIPT_URL}?action=getAd&id=${encodeURIComponent(id)}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || data.ok === false) throw new Error(data?.error || "Anuncio no encontrado");
    render(data);
    return;
  } catch (_) {}

  // 2) JSONP fallback
  try {
    const cb = "__mp_" + Math.random().toString(36).slice(2);
    const url = `${APPS_SCRIPT_URL}?action=getAd&id=${encodeURIComponent(id)}&callback=${encodeURIComponent(cb)}`;
    const data = await loadJsonp(url, cb);
    if (!data || data.ok === false) throw new Error(data?.error || "Anuncio no encontrado");
    render(data);
  } catch (err) {
    showError(`Error: ${String(err && err.message ? err.message : err)}`);
  }
}

document.addEventListener("DOMContentLoaded", load);
