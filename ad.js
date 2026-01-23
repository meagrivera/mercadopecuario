// ========= CONFIG =========
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyIddCr3ovzxG4pcLhvzITS3vODCmDuXx1B2a50gDyJGEAwiEWtM3matwQNWkR9ta0n/exec";
const COUNTRY_CODE = "505"; // Nicaragua

// ========= HELPERS =========
function qs(name) {
  return new URL(window.location.href).searchParams.get(name);
}

function driveToDirect(urlOrId) {
  if (!urlOrId) return "";

  const s = String(urlOrId).trim();

  // Si solo es ID:
  const looksLikeId = /^[a-zA-Z0-9_-]{20,}$/.test(s) && !s.includes("http");

  // Extraer ID de cualquier URL típica de Drive:
  const m =
    s.match(/\/d\/([a-zA-Z0-9_-]{20,})\//) ||     // /file/d/<id>/
    s.match(/[?&]id=([a-zA-Z0-9_-]{20,})/) ||     // ?id=<id>
    s.match(/\/uc\?export=view&id=([a-zA-Z0-9_-]{20,})/); // uc?export=view&id=<id>

  const id = looksLikeId ? s : (m && m[1] ? m[1] : "");

  // Si no pudimos extraer ID, devolvemos lo que venga
  if (!id) return s;

  // ✅ Mejor para <img>: thumbnail grande (Drive lo sirve bien)
  // Nota: si querés más grande, subí sz=w2000 o w3000
  return `https://drive.google.com/thumbnail?id=${id}&sz=w2000`;
}

function setMeta(nameOrProp, value, isProp = false) {
  const sel = isProp
    ? `meta[property="${nameOrProp}"]`
    : `meta[name="${nameOrProp}"]`;
  const el = document.querySelector(sel);
  if (el) el.setAttribute("content", value);
}

function setCanonical(url) {
  const link = document.querySelector('link[rel="canonical"]');
  if (link) link.setAttribute("href", url);
}

// Carga JSONP (evita CORS) y llama callback global
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
      try {
        delete window[cbName];
      } catch (_) {
        window[cbName] = undefined;
      }
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
  const box = document.getElementById("adError");
  box.style.display = "block";
  box.textContent = msg;

  document.getElementById("adTitle").textContent = "No se pudo cargar el anuncio";
  document.getElementById("adSubtitle").textContent = "Verificá el link o el ID del anuncio.";
  document.getElementById("adMedia").innerHTML =
    `<div class="ad-media-placeholder">Sin datos para mostrar</div>`;

  // ocultar botón WA si existe
  const btn = document.getElementById("btnWhatsapp");
  if (btn) btn.style.display = "none";
}

function renderAdFromPayload(payload) {
  // Payload esperado del Apps Script:
  // { ok:true, ad:{...}, adClean:{...}, waLink:"...", shareUrl:"..." }
  const ad = payload?.adClean || payload?.ad || {};
  const waLink = payload?.waLink || "";

  // Título/subtítulo
  const tipo = (ad.tipo || "").toString();
  const tipoAnimal = (ad.tipoAnimal || "").toString();

  const title = [tipoAnimal, tipo].filter(Boolean).join(" • ") || `Anuncio ${ad.id || ""}`;
  const subtitle = [ad.ubicacion, ad.raza].filter(Boolean).join(" • ") || "Mercado Pecuario • ficha pública";

  document.getElementById("adTitle").textContent = title;
  document.getElementById("adSubtitle").textContent = subtitle;

  // Media (primera foto)
  const fotosStr = (ad.fotos || "").toString();
  const first = fotosStr.split(",").map(s => s.trim()).filter(Boolean)[0];
  const imgUrl = driveToDirect(first);

  const media = document.getElementById("adMedia");
  media.innerHTML = "";
  if (imgUrl) {
    const img = document.createElement("img");
    img.src = imgUrl;
    img.alt = `Foto del anuncio ${ad.id || ""}`;
    img.loading = "eager";
    img.decoding = "async";
    media.appendChild(img);

    // OG image dinámico (nota: WhatsApp cachea OG desde server, pero igual ayuda)
    setMeta("og:image", imgUrl, true);
    setMeta("twitter:image", imgUrl, false);
  } else {
    media.innerHTML = `<div class="ad-media-placeholder">Sin foto disponible</div>`;
  }

  // KV
  const kvWrap = document.getElementById("adKv");
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

  // Descripción
  document.getElementById("adDesc").textContent = ad.descripcion || "—";

  // Updated
 if (ad.timestamp) {
 //   const dt = new Date(ad.timestamp);
 //   document.getElementById("adUpdated").textContent = `Actualizado: ${dt.toLocaleString()}`;
 // } else {
   document.getElementById("adUpdated").textContent = "";
  }

  // WhatsApp (usa waLink del backend si existe)
  const btn = document.getElementById("btnWhatsapp");
  if (btn) {
    if (waLink) {
      btn.href = waLink;
      btn.style.display = "inline-block";
      document.getElementById("privacyHint").textContent =
        "Privacidad: el número no se muestra. Contactá al anunciante por WhatsApp.";
    } else {
      btn.style.display = "none";
      document.getElementById("privacyHint").textContent = "";
    }
  }

  // Meta dinámico
  document.title = `Mercado Pecuario | ${title}`;
  setMeta("description", `${title}. ${subtitle}`.slice(0, 150), false);

  setMeta("og:title", `Mercado Pecuario | ${title}`, true);
  setMeta("og:description", subtitle, true);
  setMeta("twitter:title", `Mercado Pecuario | ${title}`, false);
  setMeta("twitter:description", subtitle, false);

  // canonical con id
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

  // 1) Intento normal JSON (si CORS lo permite)
  try {
    const url = `${APPS_SCRIPT_URL}?action=getAd&id=${encodeURIComponent(id)}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (!data || data.ok === false) throw new Error(data?.error || "Anuncio no encontrado");

    renderAdFromPayload(data);
    return;
  } catch (_) {
    // 2) Fallback JSONP (funciona local + GitHub Pages sin CORS)
  }

  try {
    const cbName = "__mpRenderAd_" + Math.random().toString(36).slice(2);
    const url = `${APPS_SCRIPT_URL}?action=getAd&id=${encodeURIComponent(id)}&callback=${encodeURIComponent(cbName)}`;
    const data = await loadJsonp(url, cbName);

    if (!data || data.ok === false) throw new Error(data?.error || "Anuncio no encontrado");

    renderAdFromPayload(data);
  } catch (err) {
    showError(`Error: ${String(err && err.message ? err.message : err)}`);
  }
}

document.addEventListener("DOMContentLoaded", loadAd);
