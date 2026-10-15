// Canvas drawing only. Reads game state + visual effects; never changes game state.
const NUMBER_COLORS = [["#ffe08a", "#f9b53b"], ["#a9f0d1", "#3fcf9a"], ["#c2d8ff", "#7aa6ff"], ["#ffc9ea", "#f28ac6"], ["#ffd2bf", "#ff9a6d"]];
const DISPLAY = "'Fredoka', 'Nunito', system-ui, sans-serif";
const BODY = "'Nunito', system-ui, sans-serif";

export function draw(ctx, state, fx) {
  const { width: W, height: H } = state;
  ctx.save();
  if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * fx.shake * 10, (Math.random() - 0.5) * fx.shake * 10);

  // sky, sun, hills, ground
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#6fc3ff"); sky.addColorStop(0.55, "#bfe7ff"); sky.addColorStop(1, "#e9f8ee");
  ctx.fillStyle = sky; ctx.fillRect(-20, -20, W + 40, H + 40);
  const sun = ctx.createRadialGradient(W - 70, 70, 10, W - 70, 70, 120);
  sun.addColorStop(0, "rgba(255,236,160,.95)"); sun.addColorStop(0.25, "rgba(255,226,120,.55)"); sun.addColorStop(1, "rgba(255,226,120,0)");
  ctx.fillStyle = sun; ctx.fillRect(W - 200, -60, 260, 260);
  ctx.fillStyle = "rgba(255,255,255,.88)";
  for (const c of fx.clouds) cloud(ctx, ((c.x + fx.t * c.speed) % (W + 160)) - 80, c.y, c.s);
  hills(ctx, W, H, "#9ad8a2", H - 92, 70, fx.t * 0);
  hills(ctx, W, H, "#7fc98a", H - 58, 55, 40);
  ctx.fillStyle = "#64b86f"; ctx.fillRect(0, H - 20, W, 20);
  ctx.fillStyle = "#56a862"; ctx.fillRect(0, H - 20, W, 4);

  // equation banner
  if (state.equation && state.screen !== "start") {
    const text = state.equation.text.replace(/-/g, "−");
    ctx.font = `600 32px ${DISPLAY}`;
    const tw = ctx.measureText(text).width + 48;
    ctx.save(); ctx.shadowColor = "rgba(11,21,56,.25)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
    roundRect(ctx, W / 2 - tw / 2, 40, tw, 54, 16, "rgba(255,255,255,.96)"); ctx.restore();
    ctx.fillStyle = "#1b2340"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, W / 2, 68);
    ctx.font = `700 13px ${BODY}`; ctx.fillStyle = "rgba(27,35,64,.7)";
    ctx.fillText(`CATCH x   ·   ${state.catches} / ${state.needed}`, W / 2, 112);
  }

  // falling objects
  for (const o of state.objects) {
    const wob = Math.sin(o.wobble) * 3;
    if (o.kind === "bomb") { bomb(ctx, o.x + wob, o.y, o.r); continue; }
    const [light, dark] = NUMBER_COLORS[Math.abs(o.value) % NUMBER_COLORS.length];
    ctx.save(); ctx.shadowColor = "rgba(11,21,56,.22)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    const g = ctx.createRadialGradient(o.x + wob - o.r * 0.3, o.y - o.r * 0.35, o.r * 0.2, o.x + wob, o.y, o.r);
    g.addColorStop(0, light); g.addColorStop(1, dark);
    ctx.beginPath(); ctx.arc(o.x + wob, o.y, o.r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill(); ctx.restore();
    ctx.lineWidth = 2.5; ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.beginPath(); ctx.arc(o.x + wob, o.y, o.r - 1.5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#1b2340"; ctx.font = `700 21px ${BODY}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(o.value), o.x + wob, o.y + 1);
  }

  if (state.screen !== "start") basket(ctx, state.basket, fx.tilt);

  for (const p of fx.particles) { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  for (const f of fx.floats) { ctx.globalAlpha = Math.max(0, f.life); ctx.fillStyle = f.color; ctx.font = `700 24px ${DISPLAY}`; ctx.textAlign = "center"; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y); }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function hills(ctx, W, H, color, base, amp, phase) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, base - Math.sin((x + phase) / 70) * amp * 0.35 - Math.sin((x + phase) / 190) * amp * 0.65);
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
}
function cloud(ctx, x, y, s) {
  ctx.beginPath();
  ctx.arc(x, y, 18 * s, 0, Math.PI * 2); ctx.arc(x + 22 * s, y - 8 * s, 22 * s, 0, Math.PI * 2); ctx.arc(x + 48 * s, y, 18 * s, 0, Math.PI * 2);
  ctx.fill();
}
function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function basket(ctx, b, tilt = 0) {
  const { x, y, w, h } = b;
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
  ctx.save(); ctx.shadowColor = "rgba(11,21,56,.3)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 6;
  ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w / 2 - 12, h / 2 + 12); ctx.lineTo(-w / 2 + 12, h / 2 + 12); ctx.closePath();
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2 + 12); g.addColorStop(0, "#d99a58"); g.addColorStop(1, "#b5763a");
  ctx.fillStyle = g; ctx.fill(); ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = "rgba(120,70,25,.5)";
  for (let i = -w / 2 + 14; i < w / 2 - 8; i += 12) { ctx.beginPath(); ctx.moveTo(i, -h / 2); ctx.lineTo(i - 4, h / 2 + 10); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-w / 2 + 6, h / 2 - 2); ctx.lineTo(w / 2 - 6, h / 2 - 2); ctx.stroke();
  roundRect(ctx, -w / 2 - 5, -h / 2 - 7, w + 10, 12, 6, "#ecb577", "#8a5a2b");
  ctx.lineWidth = 5; ctx.strokeStyle = "#a66a33"; ctx.beginPath(); ctx.arc(0, -h / 2 - 6, w * 0.3, Math.PI, 0); ctx.stroke();
  ctx.restore();
}
function bomb(ctx, x, y, r) {
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  ctx.beginPath(); ctx.arc(x, y + 2, r - 2, 0, Math.PI * 2); ctx.fillStyle = "#2b2b3a"; ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.25, r * 0.25, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fill();
  ctx.fillStyle = "#6b7280"; ctx.fillRect(x - 5, y - r - 2, 10, 8);
  ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - r - 2); ctx.quadraticCurveTo(x + 8, y - r - 12, x + 4, y - r - 18); ctx.stroke();
  ctx.fillStyle = "#fbbf24"; ctx.beginPath(); ctx.arc(x + 4, y - r - 19, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = `800 16px ${BODY}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("!", x, y + 3);
}
