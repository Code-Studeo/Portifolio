(() => {
  const config = window.PORTFOLIO_CONFIG || { projects: [], contacts: {} };
  const projects = config.projects || [];
  const track = document.querySelector("#project-list");
  const stage = document.querySelector("#gallery-stage");
  const gallery = document.querySelector("#project-gallery");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(pointer:fine)").matches;
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const safeUrl = (value) => { try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } };
  const safeImage = (value) => safeUrl(value) || (/^(?!\/)(?!.*\.\.)(?!.*\/\/)[\w./-]+\.(?:png|jpe?g|webp|avif)$/i.test(value || "") ? value : "");
  let active = 0;
  let galleryVisible = false;
  let dragStart = null;
  let ignoreClickUntil = 0;
  let resizeTimer = 0;

  track.innerHTML = projects.map((project, index) => {
    const capture = safeImage(project.capture);
    const live = safeUrl(project.liveUrl);
    const media = capture
      ? `<img class="gallery-capture" src="${escapeHTML(capture)}" alt="Captura real de ${escapeHTML(project.title)}" loading="lazy">`
      : live
        ? `<iframe class="gallery-iframe" data-src="${escapeHTML(live)}" title="Preview ao vivo: ${escapeHTML(project.title)}" loading="lazy" tabindex="-1" referrerpolicy="strict-origin-when-cross-origin"></iframe>`
        : `<div class="gallery-art" style="--accent:${escapeHTML(project.accent)}"><span class="gallery-art-ring"></span><strong>${escapeHTML(project.mark).replace(/\n/g, "<br>")}</strong><small>PREVIEW DO SITE NÃO DISPONÍVEL</small></div>`;
    const num = String(index + 1).padStart(2, "0");
    return `<a class="gallery-item" data-index="${index}" href="${escapeHTML(live || "#")}"${live ? ' target="_blank" rel="noopener noreferrer"' : ' aria-disabled="true" tabindex="-1"'} aria-label="Abrir projeto ${escapeHTML(project.title)} em nova aba">
      <div class="gallery-window"><div class="gallery-window-inner">${media}</div><div class="gallery-window-shade"></div>
        <span class="gallery-card-index">${num} <i>/</i> ${String(projects.length).padStart(2, "0")}</span>
        <span class="gallery-card-label">${escapeHTML(project.title)}<small>${escapeHTML(project.segment)}</small></span>
        <span class="gallery-card-hint">${live ? "CLIQUE PARA ABRIR O SITE" : "PREVIEW EM CONFIGURAÇÃO"}</span>
      </div>
    </a>`;
  }).join("");

  const currentLabel = document.querySelector("#gallery-current");
  const titleLabel = document.querySelector("#gallery-title");
  const segmentLabel = document.querySelector("#gallery-segment");
  const openLink = document.querySelector("#gallery-open");
  const progress = document.querySelector("#gallery-progress");
  const progressBar = document.querySelector(".gallery-progress");
  const items = [...track.querySelectorAll(".gallery-item")];

  // The upper wheel is deliberately decorative: its cards are inert and its iframes cannot receive input.
  const wheel = document.querySelector("#project-wheel");
  const wheelRing = document.querySelector("#project-wheel-ring");
  const wheelOrbit = wheel?.querySelector(".wheel-orbit");
  const wheelCards = projects.map((project, index) => {
    const live = safeUrl(project.liveUrl);
    const card = document.createElement("div");
    card.className = "wheel-card";
    card.setAttribute("aria-hidden", "true");
    card.innerHTML = `${live ? `<iframe src="${escapeHTML(live)}" title="" tabindex="-1" loading="lazy" aria-hidden="true" referrerpolicy="strict-origin-when-cross-origin"></iframe>` : ""}<span class="wheel-card-label">${escapeHTML(project.title)}<small>${escapeHTML(project.segment)}</small></span>`;
    wheelRing.append(card);
    return card;
  });
  let wheelAngle = 0;
  let wheelArcCache = null;
  const renderWheel = (degrees = wheelAngle) => {
    if (!wheel || !wheelCards.length) return;
    const small = matchMedia("(max-width:760px)").matches;
    const scene = wheel.querySelector(".wheel-scene");
    const width = scene.clientWidth;
    const cardWidth = small ? Math.min(84, Math.max(76, width * .20)) : Math.min(230, Math.max(150, width * .14));
    const cardHeight = cardWidth * (small ? .68 : .62);
    const radiusX = Math.min(width * (small ? .46 : .30), width / 2 - cardWidth * .55);
    const radiusY = Math.min(radiusX * (small ? .92 : .52), scene.clientHeight / 2 - cardHeight * .6);
    if (!wheelArcCache || wheelArcCache.radiusX !== radiusX || wheelArcCache.radiusY !== radiusY) {
      const steps = 720;
      const samples = [{ angle: 0, distance: 0 }];
      let perimeter = 0;
      let previousX = 0;
      let previousY = -radiusY;
      for (let step = 1; step <= steps; step += 1) {
        const angle = step / steps * Math.PI * 2;
        const x = Math.sin(angle) * radiusX;
        const y = -Math.cos(angle) * radiusY;
        perimeter += Math.hypot(x - previousX, y - previousY);
        samples.push({ angle, distance: perimeter });
        previousX = x;
        previousY = y;
      }
      wheelArcCache = { radiusX, radiusY, perimeter, samples };
    }
    wheelRing.style.transform = "none";
    wheelOrbit.style.width = `${radiusX * 2}px`;
    wheelOrbit.style.height = `${radiusY * 2}px`;
    wheelCards.forEach((card, index) => {
      const target = (((index / wheelCards.length) + degrees / 360) % 1 + 1) % 1 * wheelArcCache.perimeter;
      let low = 0;
      let high = wheelArcCache.samples.length - 1;
      while (low < high) {
        const middle = (low + high) >> 1;
        if (wheelArcCache.samples[middle].distance < target) low = middle + 1;
        else high = middle;
      }
      const next = wheelArcCache.samples[low];
      const previous = wheelArcCache.samples[Math.max(0, low - 1)];
      const fraction = next.distance === previous.distance ? 0 : (target - previous.distance) / (next.distance - previous.distance);
      const angle = previous.angle + (next.angle - previous.angle) * fraction;
      const x = Math.sin(angle) * radiusX;
      const y = -Math.cos(angle) * radiusY;
      const depth = Math.sin(angle);
      const z = depth * (small ? 55 : 115);
      const scale = .9 + (depth + 1) * .05;
      card.style.width = `${cardWidth}px`;
      card.style.height = `${cardHeight}px`;
      card.style.transform = `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), ${z}px) scale(${scale})`;
      card.style.zIndex = String(Math.round((depth + 1) * 10));
      card.style.opacity = String(.72 + (depth + 1) * .14);
    });
  };
  renderWheel();
  window.addEventListener("resize", () => renderWheel(), { passive: true });

  function offsetFor(index) {
    const total = projects.length;
    let delta = (index - active + total) % total;
    if (delta > total / 2) delta -= total;
    return delta;
  }

  function activate(index, animate = true) {
    if (!projects.length) return;
    active = (index + projects.length) % projects.length;
    const project = projects[active];
    const live = safeUrl(project.liveUrl);
    const current = String(active + 1).padStart(2, "0");
    currentLabel.innerHTML = `${current} <i>/</i> ${String(projects.length).padStart(2, "0")}`;
    titleLabel.textContent = project.title;
    segmentLabel.textContent = project.segment;
    progressBar.setAttribute("aria-valuemax", String(projects.length));
    progressBar.setAttribute("aria-valuenow", String(active + 1));
    openLink.classList.toggle("gallery-open--disabled", !live);
    openLink.setAttribute("aria-disabled", String(!live));
    openLink.tabIndex = live ? 0 : -1;
    openLink.href = live || "#";
    if (!live) openLink.removeAttribute("target");
    else openLink.target = "_blank";
    const mobile = matchMedia("(max-width: 760px)").matches;
    items.forEach((item, itemIndex) => {
      const d = offsetFor(itemIndex);
      const distance = Math.abs(d);
      const direction = Math.sign(d);
      const width = stage.clientWidth;
      const xFactors = mobile ? [0, .60, 1.08, 1.38] : [0, .46, .82, 1.10];
      const scales = mobile ? [1, .72, .50, .34] : [1, .72, .52, .36];
      const depths = [60, -140, -340, -560];
      const rotations = mobile ? [0, 13, 19, 23] : [0, 14, 19, 24];
      const opacity = [1, .88, .61, .34];
      const visible = distance <= 3;
      item.style.zIndex = String(20 - distance);
      item.style.pointerEvents = visible ? "auto" : "none";
      item.setAttribute("aria-current", itemIndex === active ? "true" : "false");
      item.classList.toggle("gallery-item--active", itemIndex === active);
      item.classList.toggle("gallery-item--side", itemIndex !== active);
      const frame = item.querySelector(".gallery-window");
      frame.style.setProperty("--parallax-x", "0px");
      frame.style.setProperty("--parallax-y", "0px");
      const iframe = item.querySelector(".gallery-iframe");
      if (iframe && distance === 0 && !iframe.hasAttribute("src")) iframe.src = iframe.dataset.src;
      else if (iframe && mobile && distance > 0 && iframe.hasAttribute("src")) iframe.removeAttribute("src");
      else if (iframe && !mobile && distance <= 2 && !iframe.hasAttribute("src")) iframe.src = iframe.dataset.src;
      const position = {
        x: direction * width * xFactors[Math.min(distance, 3)],
        y: distance ? distance * (mobile ? 6 : 8) : 0,
        z: depths[Math.min(distance, 3)],
        rotateY: -direction * rotations[Math.min(distance, 3)],
        rotateZ: direction * (distance ? 1.3 : 0),
        scale: scales[Math.min(distance, 3)],
        opacity: visible ? opacity[Math.min(distance, 3)] : 0,
        filter: mobile ? "none" : distance > 1 ? `saturate(${Math.max(.35, 1 - distance * .18)}) brightness(${Math.max(.53, 1 - distance * .13)})` : "saturate(1) brightness(1)"
      };
      if (window.gsap && !reducedMotion) {
        const transforms = { ...position, xPercent: -50, yPercent: -50 };
        if (animate) gsap.to(item, { ...transforms, duration: .92, ease: "power3.inOut", overwrite: "auto" });
        else gsap.set(item, transforms);
      } else {
        Object.assign(item.style, {
          transform: `translate(-50%,-50%) translate3d(${position.x}px,${position.y}px,${position.z}px) rotateY(${position.rotateY}deg) rotateZ(${position.rotateZ}deg) scale(${position.scale})`,
          opacity: String(position.opacity), filter: position.filter
        });
      }
      if (!visible) item.setAttribute("aria-hidden", "true"); else item.removeAttribute("aria-hidden");
    });
    if (window.gsap && !reducedMotion && animate) {
      gsap.to(progress, { scaleX: (active + 1) / projects.length, duration: .8, ease: "power3.inOut", overwrite: true });
      gsap.fromTo(".gallery-meta-title", { y: 8, opacity: .55 }, { y: 0, opacity: 1, duration: .42, ease: "power2.out", overwrite: true });
    } else progress.style.transform = `scaleX(${(active + 1) / projects.length})`;
  }

  function go(direction) { activate(active + direction); }
  document.querySelector(".gallery-arrow--prev").addEventListener("click", () => go(-1));
  document.querySelector(".gallery-arrow--next").addEventListener("click", () => go(1));
  track.addEventListener("click", (event) => {
    if (Date.now() < ignoreClickUntil) event.preventDefault();
  });
  stage.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); go(event.key === "ArrowRight" ? 1 : -1); }
  });
  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || !galleryVisible || event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); go(event.key === "ArrowRight" ? 1 : -1); }
  });

  stage.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    dragStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    stage.setPointerCapture(event.pointerId);
    stage.classList.add("gallery-stage--dragging");
  });
  stage.addEventListener("pointermove", (event) => {
    if (dragStart && event.pointerId === dragStart.id) {
      const dx = event.clientX - dragStart.x;
      const dy = event.clientY - dragStart.y;
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { dragStart = null; ignoreClickUntil = Date.now() + 120; stage.classList.remove("gallery-stage--dragging"); return; }
      if (Math.abs(dx) > 8) stage.style.setProperty("--drag-x", `${dx * .18}px`);
      if (Math.abs(dx) > 65) { go(dx < 0 ? 1 : -1); dragStart = null; ignoreClickUntil = Date.now() + 350; stage.classList.remove("gallery-stage--dragging"); stage.style.removeProperty("--drag-x"); return; }
    }
    if (finePointer && !reducedMotion) {
      const rect = stage.getBoundingClientRect();
      stage.style.setProperty("--pointer-x", `${(event.clientX - rect.left) / rect.width * 100}%`);
      stage.style.setProperty("--pointer-y", `${(event.clientY - rect.top) / rect.height * 100}%`);
      items.forEach((item) => {
        const d = offsetFor(Number(item.dataset.index));
        if (Math.abs(d) > 2) return;
        const r = item.getBoundingClientRect();
        const px = (event.clientX - (r.left + r.width / 2)) * -.025;
        const py = (event.clientY - (r.top + r.height / 2)) * -.02;
        item.querySelector(".gallery-window").style.setProperty("--parallax-x", `${Math.max(-12, Math.min(12, px))}px`);
        item.querySelector(".gallery-window").style.setProperty("--parallax-y", `${Math.max(-9, Math.min(9, py))}px`);
      });
    }
  });
  function endDrag(event) {
    if (!dragStart || event.pointerId !== dragStart.id) return;
    const dx = event.clientX - dragStart.x;
    if (Math.abs(dx) > 35) { go(dx < 0 ? 1 : -1); ignoreClickUntil = Date.now() + 350; }
    dragStart = null;
    stage.style.removeProperty("--drag-x");
    stage.classList.remove("gallery-stage--dragging");
  }
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  stage.addEventListener("pointerleave", () => {
    if (!dragStart) {
      stage.style.removeProperty("--pointer-x"); stage.style.removeProperty("--pointer-y");
      items.forEach((item) => { item.querySelector(".gallery-window").style.setProperty("--parallax-x", "0px"); item.querySelector(".gallery-window").style.setProperty("--parallax-y", "0px"); });
    }
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(([entry]) => { galleryVisible = entry.isIntersecting; }, { threshold: .18 });
    observer.observe(gallery);
  }
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => activate(active, false), 120); }, { passive: true });

  if (window.gsap && window.ScrollTrigger && !reducedMotion) {
    gsap.registerPlugin(ScrollTrigger);
    if (wheel && wheelCards.length) {
      gsap.to({ angle: 0 }, { angle: 360, ease: "none", onUpdate() { wheelAngle = this.targets()[0].angle; renderWheel(); }, scrollTrigger: { trigger: wheel, start: "top top", end: () => `+=${Math.round(wheel.offsetHeight * 4.5)}`, pin: true, pinSpacing: true, pinReparent: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true } });
    }
  }

  if (!window.gsap || !window.ScrollTrigger || reducedMotion || matchMedia("(max-width: 760px)").matches) {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
  } else {
    const context = gsap.context(() => {
      gsap.utils.toArray(".reveal").forEach((el) => gsap.fromTo(el, { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: .85, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } }));
      gsap.from(".gallery-topline, .gallery-arrow", { y: 14, opacity: 0, duration: .65, stagger: .08, delay: .18, ease: "power3.out" });
      activate(active, false);
    });
    window.addEventListener("pagehide", () => context.revert(), { once: true });
  }
  activate(0, false);
})();
