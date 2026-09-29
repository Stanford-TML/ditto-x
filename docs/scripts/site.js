// DITTO-X page behaviour: carousels, play-when-visible videos, BibTeX copy.

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function safePlay(video) {
  const p = video.play();
  if (p && p.catch) p.catch(() => {});
}

// ---- Videos marked data-autoplay play while on screen, pause when not. ------
const visible = new Set();
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const v = e.target;
    if (e.isIntersecting) visible.add(v); else visible.delete(v);
    syncVideo(v);
  }
}, { threshold: 0.35 });

function syncVideo(v) {
  const slide = v.closest(".task-brief");
  const activeSlide = !slide || slide.classList.contains("is-active");
  if (visible.has(v) && activeSlide && !reduceMotion) safePlay(v); else v.pause();
}

document.querySelectorAll("video[data-autoplay]").forEach((v) => io.observe(v));

// ---- Carousels (tabs + arrows + scroll-snap track). --------
document.querySelectorAll("[data-carousel]").forEach((root) => {
  const track = root.querySelector(".deployment-list");
  const slides = [...track.querySelectorAll(".task-brief")];
  const tabs = [...root.querySelectorAll(".deployment-tabs button")];
  const prev = root.querySelector("[data-prev]");
  const next = root.querySelector("[data-next]");
  const pos = root.querySelector("output");
  let active = 0;

  function setActive(i) {
    active = i;
    slides.forEach((s, j) => s.classList.toggle("is-active", j === i));
    tabs.forEach((t, j) => t.setAttribute("aria-pressed", String(j === i)));
    track.classList.toggle("at-end", i === slides.length - 1 && slides.length > 1);
    prev.disabled = i === 0;
    next.disabled = i === slides.length - 1;
    pos.textContent = `${i + 1} / ${slides.length}`;
    slides.forEach((s) => s.querySelectorAll("video").forEach(syncVideo));
  }

  function goTo(i) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    track.scrollTo({ left: slides[i].offsetLeft - slides[0].offsetLeft, behavior: reduceMotion ? "auto" : "smooth" });
    setActive(i);
  }

  tabs.forEach((t, i) => t.addEventListener("click", () => goTo(i)));
  // Clicking the peeking (inactive) slide brings it forward; clicks on the active one pass through.
  slides.forEach((sl, i) => sl.addEventListener("click", (e) => {
    if (!sl.classList.contains("is-active")) { e.preventDefault(); goTo(i); }
  }));
  prev.addEventListener("click", () => goTo(active - 1));
  next.addEventListener("click", () => goTo(active + 1));
  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); goTo(active + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); goTo(active - 1); }
  });

  // Swiping: the slide nearest the track's left edge becomes active.
  let t;
  track.addEventListener("scroll", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const x = track.scrollLeft + slides[0].offsetLeft;
      let best = 0;
      slides.forEach((s, j) => { if (Math.abs(s.offsetLeft - x) < Math.abs(slides[best].offsetLeft - x)) best = j; });
      if (best !== active) setActive(best);
    }, 90);
  });

  setActive(0);
});

// ---- Copy BibTeX (public build only). ----------------------------------------
const copy = document.querySelector(".copy-bibtex");
if (copy) {
  copy.addEventListener("click", async () => {
    const status = document.querySelector(".copy-citation-status");
    try {
      await navigator.clipboard.writeText(document.getElementById("dittox-bibtex").textContent);
      status.textContent = "Copied";
    } catch { status.textContent = "Copy failed"; }
    setTimeout(() => { status.textContent = ""; }, 2000);
  });
}

// ---- Table of contents: always shown (ditto.css); mark the chapter being read. ----
// (Wide screens: fixed panel on the left. Narrower: sticky bar above the article — style.css.)
{
  const toc = document.querySelector(".contents");
  const links = [...document.querySelectorAll(".contents a")];
  const sections = links.map((a) => document.querySelector(a.hash)).filter(Boolean);
  const layout = document.querySelector(".article-layout");
  let queued = false;
  const update = () => {
    queued = false;
    if (!toc || !layout || !sections.length) return;
    let current = sections[0];
    for (const s of sections) if (s.getBoundingClientRect().top <= 200) current = s;
    for (const a of links) {
      const on = a.hash === `#${current.id}`;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
    }
  };
  addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener("resize", update);
  update();
}

// ---- Hero: the full supplementary video, auto-previewing only its opening. ----
// Muted autoplay pauses at data-preview-end and offers "Watch the full video". Any sign the
// viewer has taken over (play after the pause, seeking, unmuting, the button) disables the stop.
{
  const v = document.getElementById("hero-video");
  const btn = document.querySelector(".hero-continue");
  if (v && btn) {
    const stopAt = parseFloat(v.dataset.previewEnd);
    let previewing = true, autoPaused = false;
    const takeOver = () => { previewing = false; btn.hidden = true; };
    v.addEventListener("timeupdate", () => {
      if (previewing && v.currentTime >= stopAt) {
        autoPaused = true;
        v.pause();
        btn.hidden = false;
      }
    });
    v.addEventListener("play", () => { if (autoPaused) takeOver(); });
    v.addEventListener("seeking", () => { if (!autoPaused || v.currentTime < stopAt - 0.5) takeOver(); });
    v.addEventListener("volumechange", () => { if (!v.muted) takeOver(); });
    btn.addEventListener("click", () => { takeOver(); safePlay(v); });
  }
}
