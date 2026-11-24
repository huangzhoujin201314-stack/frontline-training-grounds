import * as THREE from 'three';

export interface ProceduralTextureSet {
  concreteFloor: THREE.CanvasTexture;
  concreteWall: THREE.CanvasTexture;
  containerBlue: THREE.CanvasTexture;
  containerRust: THREE.CanvasTexture;
  containerOlive: THREE.CanvasTexture;
  containerSlate: THREE.CanvasTexture;
  crateWood: THREE.CanvasTexture;
  hazardBarrier: THREE.CanvasTexture;
  rampGrip: THREE.CanvasTexture;
  signA: THREE.CanvasTexture;
  signMid: THREE.CanvasTexture;
  signB: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeColorTexture(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

function addSurfaceNoise(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  count: number,
  alpha = 0.08,
): void {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const s = 1 + Math.random() * 3.5;
    const bright = Math.random() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${bright},${bright},${bright},${(Math.random() * alpha).toFixed(3)})`;
    ctx.fillRect(x, y, s, s);
  }
}

function buildConcreteFloor(maxAniso: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#6f747a';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle poured concrete tonal patches
  for (let i = 0; i < 42; i++) {
    const gx = Math.random() * 512;
    const gy = Math.random() * 512;
    const r = 35 + Math.random() * 90;
    const grad = ctx.createRadialGradient(gx, gy, 2, gx, gy, r);
    const shade = Math.random() > 0.5 ? 'rgba(210,218,225,0.06)' : 'rgba(35,40,48,0.08)';
    grad.addColorStop(0, shade);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
  }

  addSurfaceNoise(ctx, 512, 512, 4200, 0.09);

  // Concrete expansion slab joints (2x2 slabs per tile)
  ctx.strokeStyle = 'rgba(28, 32, 38, 0.55)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 508, 508);
  ctx.beginPath();
  ctx.moveTo(256, 0);
  ctx.lineTo(256, 512);
  ctx.moveTo(0, 256);
  ctx.lineTo(512, 256);
  ctx.stroke();

  // Subtle chamfer highlight along joints
  ctx.strokeStyle = 'rgba(220, 226, 234, 0.14)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(259, 0);
  ctx.lineTo(259, 512);
  ctx.moveTo(0, 259);
  ctx.lineTo(512, 259);
  ctx.stroke();

  // Subtle floor bolt / drainage corner markers
  ctx.fillStyle = 'rgba(30, 34, 40, 0.45)';
  const pts = [
    [16, 16],
    [240, 16],
    [272, 16],
    [496, 16],
    [16, 240],
    [272, 272],
    [496, 496],
  ];
  for (const [px, py] of pts) {
    ctx.fillRect(px - 3, py - 3, 6, 6);
  }

  return finalizeColorTexture(c, maxAniso, 12, 12);
}

function buildConcreteWall(maxAniso: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#7c8288';
  ctx.fillRect(0, 0, 512, 512);

  // Precast vertical concrete panels
  for (let x = 0; x < 512; x += 128) {
    const tone = (x / 128) % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
    ctx.fillStyle = tone;
    ctx.fillRect(x, 0, 128, 512);
    ctx.fillStyle = 'rgba(26, 30, 36, 0.55)';
    ctx.fillRect(x, 0, 4, 512);
  }

  // Horizontal structural beam band
  ctx.fillStyle = '#5a6068';
  ctx.fillRect(0, 210, 512, 28);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, 210, 512, 3);

  // Bottom weathered grime gradient
  const grime = ctx.createLinearGradient(0, 380, 0, 512);
  grime.addColorStop(0, 'rgba(20,24,28,0)');
  grime.addColorStop(1, 'rgba(20,24,28,0.45)');
  ctx.fillStyle = grime;
  ctx.fillRect(0, 380, 512, 132);

  // Industrial hazard stripe along lower base
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 444, 512, 34);
  ctx.clip();
  ctx.fillStyle = '#d99a1e';
  ctx.fillRect(0, 444, 512, 34);
  ctx.fillStyle = '#1b1f26';
  for (let i = -64; i < 600; i += 44) {
    ctx.beginPath();
    ctx.moveTo(i, 444);
    ctx.lineTo(i + 20, 444);
    ctx.lineTo(i + 42, 478);
    ctx.lineTo(i + 22, 478);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  addSurfaceNoise(ctx, 512, 512, 3200, 0.08);

  return finalizeColorTexture(c, maxAniso, 6, 1);
}

function buildShippingContainer(
  maxAniso: number,
  baseHex: string,
  darkHex: string,
  lightHex: string,
  stencil: string,
): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 256);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 256);

  // Corrugated steel vertical ribs
  const ribW = 16;
  for (let x = 24; x < 488; x += ribW) {
    ctx.fillStyle = darkHex;
    ctx.fillRect(x, 18, 5, 220);
    ctx.fillStyle = lightHex;
    ctx.fillRect(x + 5, 18, 4, 220);
  }

  // Structural corner frame & rails
  ctx.fillStyle = darkHex;
  ctx.fillRect(0, 0, 512, 18);
  ctx.fillRect(0, 238, 512, 18);
  ctx.fillRect(0, 0, 22, 256);
  ctx.fillRect(490, 0, 22, 256);

  // Highlight edge trim
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(0, 18, 512, 2);
  ctx.fillRect(22, 0, 2, 256);

  // Industrial stencil code
  ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
  ctx.font = 'bold 28px monospace';
  ctx.fillText(stencil, 46, 72);
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = 'rgba(241, 245, 249, 0.65)';
  ctx.fillText('TACTICAL FREIGHT // MAX 28T', 46, 94);

  // Small amber warning square
  ctx.fillStyle = '#e5a01d';
  ctx.fillRect(418, 48, 44, 16);
  ctx.fillStyle = '#141820';
  ctx.fillRect(422, 52, 36, 8);

  // Weathering dust near bottom
  const dirt = ctx.createLinearGradient(0, 185, 0, 256);
  dirt.addColorStop(0, 'rgba(18,20,24,0)');
  dirt.addColorStop(1, 'rgba(18,20,24,0.42)');
  ctx.fillStyle = dirt;
  ctx.fillRect(0, 185, 512, 71);

  addSurfaceNoise(ctx, 512, 256, 2200, 0.08);
  return finalizeColorTexture(c, maxAniso, 1, 1);
}

function buildCrateTexture(maxAniso: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#8b6f47';
  ctx.fillRect(0, 0, 256, 256);

  // Horizontal planks
  for (let y = 0; y < 256; y += 32) {
    ctx.fillStyle = y % 64 === 0 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, y, 256, 32);
    ctx.fillStyle = 'rgba(35, 24, 12, 0.45)';
    ctx.fillRect(0, y, 256, 2);
  }

  // Heavy perimeter frame
  ctx.strokeStyle = '#5c462b';
  ctx.lineWidth = 22;
  ctx.strokeRect(11, 11, 234, 234);

  // Diagonal brace
  ctx.beginPath();
  ctx.moveTo(24, 24);
  ctx.lineTo(232, 232);
  ctx.lineWidth = 18;
  ctx.strokeStyle = '#6c5334';
  ctx.stroke();

  // Metal corner brackets
  ctx.fillStyle = '#2d333c';
  const corners = [
    [0, 0],
    [224, 0],
    [0, 224],
    [224, 224],
  ];
  for (const [cx, cy] of corners) {
    ctx.fillRect(cx, cy, 32, 32);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(cx + 12, cy + 12, 6, 6);
    ctx.fillStyle = '#2d333c';
  }

  // Supply stencil
  ctx.fillStyle = 'rgba(24, 20, 16, 0.72)';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('AMMO-07', 84, 52);

  addSurfaceNoise(ctx, 256, 256, 1400, 0.09);
  return finalizeColorTexture(c, maxAniso, 1, 1);
}

function buildHazardBarrier(maxAniso: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 128);
  ctx.fillStyle = '#8b9096';
  ctx.fillRect(0, 0, 256, 128);

  // Top yellow/black caution band
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 256, 36);
  ctx.clip();
  ctx.fillStyle = '#e2a31c';
  ctx.fillRect(0, 0, 256, 36);
  ctx.fillStyle = '#181c22';
  for (let i = -32; i < 300; i += 36) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 18, 0);
    ctx.lineTo(i + 34, 36);
    ctx.lineTo(i + 16, 36);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Concrete base shadow
  const grad = ctx.createLinearGradient(0, 80, 0, 128);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(15,18,22,0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 80, 256, 48);

  addSurfaceNoise(ctx, 256, 128, 1200, 0.1);
  return finalizeColorTexture(c, maxAniso, 1, 1);
}

function buildRampGrip(maxAniso: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#4e555e';
  ctx.fillRect(0, 0, 256, 256);

  // Anti-slip traction ribs
  for (let y = 8; y < 256; y += 20) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(14, y, 228, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(14, y + 4, 228, 4);
  }

  // Side amber edge rails
  ctx.fillStyle = '#d99a1e';
  ctx.fillRect(0, 0, 12, 256);
  ctx.fillRect(244, 0, 12, 256);

  addSurfaceNoise(ctx, 256, 256, 1000, 0.07);
  return finalizeColorTexture(c, maxAniso, 1, 2);
}

function buildLaneSign(
  maxAniso: number,
  code: string,
  subtitle: string,
  accentHex: string,
): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 128);
  ctx.fillStyle = '#181e27';
  ctx.fillRect(0, 0, 256, 128);

  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 0, 256, 12);
  ctx.fillRect(0, 116, 256, 12);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 54px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(code, 128, 72);

  ctx.fillStyle = accentHex;
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(subtitle, 128, 104);

  return finalizeColorTexture(c, maxAniso, 1, 1);
}

function buildContactShadow(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(6, 9, 14, 0.65)');
  grad.addColorStop(0.55, 'rgba(6, 9, 14, 0.3)');
  grad.addColorStop(1, 'rgba(6, 9, 14, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const concreteFloor = buildConcreteFloor(maxAnisotropy);
  const concreteWall = buildConcreteWall(maxAnisotropy);
  const containerBlue = buildShippingContainer(maxAnisotropy, '#294c70', '#1b3550', '#396490', 'FTG-A01');
  const containerRust = buildShippingContainer(maxAnisotropy, '#984928', '#6e3218', '#b55d37', 'FTG-M04');
  const containerOlive = buildShippingContainer(maxAnisotropy, '#445440', '#2e3b2b', '#596d54', 'FTG-B02');
  const containerSlate = buildShippingContainer(maxAnisotropy, '#434c57', '#2c333b', '#586370', 'FTG-C09');
  const crateWood = buildCrateTexture(maxAnisotropy);
  const hazardBarrier = buildHazardBarrier(maxAnisotropy);
  const rampGrip = buildRampGrip(maxAnisotropy);
  const signA = buildLaneSign(maxAnisotropy, 'A', '西侧通道', '#f59e0b');
  const signMid = buildLaneSign(maxAnisotropy, 'MID', '中路高台', '#06b6d4');
  const signB = buildLaneSign(maxAnisotropy, 'B', '东侧通道', '#f97316');
  const contactShadow = buildContactShadow();

  const all = [
    concreteFloor,
    concreteWall,
    containerBlue,
    containerRust,
    containerOlive,
    containerSlate,
    crateWood,
    hazardBarrier,
    rampGrip,
    signA,
    signMid,
    signB,
    contactShadow,
  ];

  return {
    concreteFloor,
    concreteWall,
    containerBlue,
    containerRust,
    containerOlive,
    containerSlate,
    crateWood,
    hazardBarrier,
    rampGrip,
    signA,
    signMid,
    signB,
    contactShadow,
    dispose: () => {
      for (const tex of all) tex.dispose();
    },
  };
}
