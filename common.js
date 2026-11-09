// プレゼント交換ルーレット 共通処理
// 割り当ては主催者ページで1回だけ決め、各人のURLに「その人の分だけ」を暗号化して入れる。
// サーバーにもどこにも全員分の対応表は残らないので、同時アクセスでも結果は変わらない。

const XR = (() => {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function b64uEncode(bytes) {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function b64uDecode(str) {
    const s = str.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(s + "===".slice((s.length + 3) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }

  // 0〜n-1 の偏りのない乱数
  function randInt(n) {
    const limit = Math.floor(0x100000000 / n) * n;
    const buf = new Uint32Array(1);
    do crypto.getRandomValues(buf); while (buf[0] >= limit);
    return buf[0] % n;
  }

  // 自分に当たらない並び（完全順列）を一様ランダムに作る
  function derangement(n) {
    for (;;) {
      const p = [...Array(n).keys()];
      for (let i = n - 1; i > 0; i--) {
        const j = randInt(i + 1);
        [p[i], p[j]] = [p[j], p[i]];
      }
      if (p.every((x, i) => x !== i)) return p;
    }
  }

  // 全員が1人に渡し・1人から受け取り・自分には当たらないことを確認
  function isValidAssignment(p) {
    const n = p.length;
    const received = new Set(p);
    return received.size === n && p.every((x, i) => Number.isInteger(x) && x >= 0 && x < n && x !== i);
  }

  async function seal(payload) {
    const raw = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
    const ct = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(payload)))
    );
    const out = new Uint8Array(raw.length + iv.length + ct.length);
    out.set(raw, 0);
    out.set(iv, raw.length);
    out.set(ct, raw.length + iv.length);
    return b64uEncode(out);
  }

  // 壊れたURL・書き換えたURLは復号に失敗して例外になる
  async function open(token) {
    const bytes = b64uDecode(token);
    if (bytes.length < 16 + 12 + 17) throw new Error("token too short");
    const key = await crypto.subtle.importKey("raw", bytes.slice(0, 16), "AES-GCM", false, ["decrypt"]);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(16, 28) }, key, bytes.slice(28));
    const data = JSON.parse(dec.decode(pt));
    const ok =
      data.v === 1 &&
      Array.isArray(data.n) &&
      data.n.length >= 3 &&
      Number.isInteger(data.g) &&
      Number.isInteger(data.r) &&
      data.g !== data.r &&
      data.n[data.g] !== undefined &&
      data.n[data.r] !== undefined;
    if (!ok) throw new Error("invalid payload");
    return data;
  }

  return { derangement, isValidAssignment, seal, open };
})();

// 雪を降らせる
function letItSnow(count = 36) {
  const layer = document.createElement("div");
  layer.className = "snow";
  layer.setAttribute("aria-hidden", "true");
  for (let i = 0; i < count; i++) {
    const f = document.createElement("span");
    f.textContent = Math.random() < 0.7 ? "❄" : "•";
    f.style.left = Math.random() * 100 + "vw";
    f.style.fontSize = 8 + Math.random() * 14 + "px";
    f.style.opacity = 0.4 + Math.random() * 0.6;
    f.style.animationDuration = 7 + Math.random() * 9 + "s";
    f.style.animationDelay = -Math.random() * 16 + "s";
    f.style.setProperty("--drift", (Math.random() * 60 - 30).toFixed(0) + "px");
    layer.appendChild(f);
  }
  document.body.prepend(layer);
}
