(function () {
  const root = document.body;
  if (!root) return;

  const packageId = (root.dataset.packageId || "").trim();
  const anchor = document.querySelector(".kb-package-info-anchor");
  if (!packageId || !anchor) return;

  const apiBase = (root.dataset.packageApiBase || "https://license.korboybeats.workers.dev").replace(/\/+$/, "");
  const defaults = {
    version: (root.dataset.packageVersion || "").trim() || "—",
    author: (root.dataset.packageAuthor || "").trim() || "—",
    section: (root.dataset.packageSection || "").trim() || "—",
    downloads: "—",
  };

  function card(label, value, id) {
    const wrap = document.createElement("div");
    wrap.className = "kb-package-info__card";

    const labelEl = document.createElement("span");
    labelEl.className = "kb-package-info__label";
    labelEl.textContent = label;
    wrap.appendChild(labelEl);

    const valueEl = document.createElement("span");
    valueEl.className = "kb-package-info__value";
    valueEl.id = id;
    valueEl.textContent = value;
    wrap.appendChild(valueEl);

    return wrap;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el && value) {
      el.textContent = value;
    }
  }

  function formatCount(value) {
    const num = Number(value || 0);
    return Number.isFinite(num) ? num.toLocaleString("en-US") : "—";
  }

  const panel = document.createElement("section");
  panel.className = "kb-package-info";
  panel.appendChild(card("Version", defaults.version, "kb-package-version"));
  panel.appendChild(card("Author", defaults.author, "kb-package-author"));
  panel.appendChild(card("Section", defaults.section, "kb-package-section"));
  panel.appendChild(card("Downloads", defaults.downloads, "kb-package-downloads"));
  anchor.replaceWith(panel);

  fetch(`${apiBase}/api/v1/repo/package/${encodeURIComponent(packageId)}`, {
    cache: "no-store",
  })
    .then((resp) => (resp.ok ? resp.json() : null))
    .then((data) => {
      if (!data) return;
      setText("kb-package-version", data.latest_version || defaults.version);
      setText("kb-package-author", data.author || defaults.author);
      setText("kb-package-section", data.section || defaults.section);
      setText("kb-package-downloads", formatCount(data.total_downloads));
    })
    .catch(function () {
    });
})();
