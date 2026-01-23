// ad.js (COPIAR Y PEGAR)

// ========= CONFIG =========
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyIddCr3ovzxG4pcLhvzITS3vODCmDuXx1B2a50gDyJGEAwiEWtM3matwQNWkR9ta0n/exec";

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

function kv(label, value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const d = document.createElement("div");
  d.className = "kv-item";
  d.innerHTML = `<b>${label}</b><span>${value}</span>`;
  return d;
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
}

// ========= RENDER =========
function forceDetailsVisible() {
  // Si algún CSS colapsó cosas, lo corregimos por JS (para confirmar que el problema era CSS)
  const section = document.querySelector("section.section");
  if (section) {
    section.style.display = "block";
    section.style.visibility = "visible";
    section.style.opacity = "1";
  }

  const card = document.querySelector(".ad-card");
  if (card) {
    card.style.display = "block";
    card.style.visibility = "visible";
    card.style.opacity = "1";
  }

  const grid = document.querySelector(".ad-grid");
  if (grid) {
    grid.style.display = "grid";
  }

  // Mostrar el bloque de info aunque haya CSS raro
  const info = document.querySelector(".ad-info");
  if (info) {
    info.style.display = "block";
  }
}

function diagnoseVisibility(payload, ad) {
  // Si algo está oculto, lo reportamos en adError para que lo veas sin consola
  const ids = ["adKv", "adDesc", "adMedia", "adTitle", "adSubtitle", "adError"];
  const report = [];

  ids.forEach((id) => {
    const node = el(id);
    if (!node) {
      report.push(`${id}: MISSING`);
      return;
    }
    const cs = window.getComputedStyle(node);
    report.push(`${id}: display=${cs.display}, visibility=${cs.visibility}, opacity=${cs.opacity}`);
  });

  const kvWrap = el("adKv");
  const kvText = kvWrap ? kvWrap.innerText.trim() : "";
  const desc = el("adDesc") ? el("adDesc").innerText.trim() : "";

  report.push("");
  report.push("DATA CHECK:");
  report.push(`ad.id=${ad.id}`);
  report.push(`kvLen=${kvText.length}`);
  report.push(`descLen=${desc.length}`);
  report.push(`fotosLen=${String(ad.fotos || "").length}`);

  const box = el("adError");
  if (box) {
    box.style.display = "block";
    box.textContent =
      "DEBUG (si ves esto, es problema de CSS/visibilidad):\n" +
      report.join("\n");
  }
}

function renderAdFromPayload(payload) {
  const ad = payload?.adClean || payload?.ad || {};
  const waLink = payload?.waLink || "";

  // 1) Forzar visibilidad (si esto “arregla”, era 100% CSS)
  forceDetailsVisible();

  // 2) Título/subtítulo
  const tipo = (ad.tipo || "").toString();
  const tipoAnimal = (ad.tipoAnimal || "").toString();

  const title = [tipoAnimal, tipo].filter(Boolean).join(" • ") || `Anuncio ${ad.id || ""}`;
  const subtitle = [ad.ubicacion, ad.raza].filter(Boolean).join(" • ") || "Mercado Pecuario • ficha pública";

  setText("adTitle", title);
  setText("adSubtitle", subtitle);

  // 3) Media (primera foto)
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

  // 4) KV (Detalles)
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
  }

  // 5) Descripción
  setText("adDesc", ad.descripcion || "—");

  // 6) WhatsApp
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

  // 7) Meta dinámico
  document.title = `Mercado Pecuario | ${title}`;
  setMeta("description", `${title}. ${subtitle}`.slice(0, 150), false);

  setMeta("og:title", `Mercado Pecuario | ${title}`, true);
  setMeta("og:description", subtitle, true);
  setMeta("twitter:title", `Mercado Pecuario | ${title}`, false);
  setMeta("twitter:description", subtitle, false);

  const canonical = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(ad.id || "")}`;
  setCanonical(canonical);
  setMeta("og:url", canonical, true);

  // 8) Si después de render sigue “vacío”, te muestro diagnóstico visible
  diagnoseVisibility(payload, ad);
}

// ========= LOAD =========
async function loadAd() {
  const id = qs("id");
  if (!id) {
    showError("Falta el parámetro ?id= (ej: ad.html?id=1755428275220)");
    return;
  }

  // 1) Intento JSON normal
  try {
    const url = `${APPS_SCRIPT_URL}?action=getAd&id=${encodeURIComponent(id)}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (!data || data.ok === false) throw new Error(data?.error || "Anuncio no encontrado");

    renderAdFromPayload(data);
    return;
  } catch (_) {}

  // 2) Fallback JSONP
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
