import * as THREE from 'three';

export interface ProceduralTextureSet {
  lateriteAlbedo: THREE.CanvasTexture;
  lateriteNormal: THREE.DataTexture;
  teaTerraceAlbedo: THREE.CanvasTexture;
  teaNormal: THREE.DataTexture;
  asphaltAlbedo: THREE.CanvasTexture;
  asphaltNormal: THREE.DataTexture;
  asphaltRoughness: THREE.CanvasTexture;
  barkAlbedo: THREE.CanvasTexture;
  barkNormal: THREE.DataTexture;
  bambooAlbedo: THREE.CanvasTexture;
  terracottaAlbedo: THREE.CanvasTexture;
  terracottaNormal: THREE.DataTexture;
  palmFrondAlbedo: THREE.CanvasTexture;
  waterFlowAlbedo: THREE.CanvasTexture;
  waterNormal: THREE.DataTexture;
  petroglyphAlbedo: THREE.CanvasTexture;
  chevronAlbedo: THREE.CanvasTexture;
  chayakadaSignAlbedo: THREE.CanvasTexture;
  ksrtcFrontAlbedo: THREE.CanvasTexture;
  highwaySigns: THREE.CanvasTexture[];
  contactShadowMap: THREE.CanvasTexture;
  mistPuffMap: THREE.CanvasTexture;
  sunbeamMap: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(
  w: number,
  h: number
): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

/**
 * Converts a 2D grayscale height array [0..255] into an OpenGL tangent-space Normal Map.
 */
function buildNormalMapFromHeight(
  heights: Float32Array,
  size: number,
  strength: number,
  repeatX = 1,
  repeatY = 1,
  maxAnisotropy = 4
): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const sample = (x: number, y: number): number => {
    const wx = ((x % size) + size) % size;
    const wy = ((y % size) + size) % size;
    return heights[wy * size + wx] / 255.0;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dX = tr + 2 * r + br - (tl + 2 * l + bl);
      const dY = bl + 2 * b + br - (tl + 2 * t + tr);

      let nx = -dX * strength;
      let ny = dY * strength;
      let nz = 1.0;
      const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(
  maxAnisotropy: number
): ProceduralTextureSet {
  const created: THREE.Texture[] = [];

  const registerColor = (
    canvas: HTMLCanvasElement,
    repeatX = 1,
    repeatY = 1
  ) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    if (repeatX > 1 || repeatY > 1) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatX, repeatY);
    }
    tex.needsUpdate = true;
    created.push(tex);
    return tex;
  };

  const registerLinear = (
    canvas: HTMLCanvasElement,
    repeatX = 1,
    repeatY = 1
  ) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = maxAnisotropy;
    if (repeatX > 1 || repeatY > 1) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatX, repeatY);
    }
    tex.needsUpdate = true;
    created.push(tex);
    return tex;
  };

  let s = 4211;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  // =========================================================================
  // 1. AAA NH-766 Wet Monsoon Highway Asphalt (512x512 Albedo + Normal + Puddle Roughness)
  // =========================================================================
  const roadSize = 512;
  const [roadCanvas, roadCtx] = makeCanvas(roadSize, roadSize);
  const [roughCanvas, roughCtx] = makeCanvas(roadSize, roadSize);
  const roadHeights = new Float32Array(roadSize * roadSize);
  roadHeights.fill(128);

  // Rich dark basalt tarmac base
  roadCtx.fillStyle = '#1b1f24';
  roadCtx.fillRect(0, 0, roadSize, roadSize);
  roughCtx.fillStyle = '#c4c4c4';
  roughCtx.fillRect(0, 0, roadSize, roadSize);

  // Realistic wheel-track polish & subtle oil sheen down each of the 3 lanes
  for (const laneCenter of [0.22, 0.5, 0.78]) {
    for (const trackOff of [-0.055, 0.055]) {
      const cx = (laneCenter + trackOff) * roadSize;
      const grad = roadCtx.createLinearGradient(cx - 26, 0, cx + 26, 0);
      grad.addColorStop(0, 'rgba(12, 15, 19, 0)');
      grad.addColorStop(0.5, 'rgba(9, 12, 16, 0.52)');
      grad.addColorStop(1, 'rgba(12, 15, 19, 0)');
      roadCtx.fillStyle = grad;
      roadCtx.fillRect(cx - 26, 0, 52, roadSize);

      const rGrad = roughCtx.createLinearGradient(cx - 24, 0, cx + 24, 0);
      rGrad.addColorStop(0, 'rgba(110, 110, 110, 0)');
      rGrad.addColorStop(0.5, 'rgba(65, 65, 65, 0.55)');
      rGrad.addColorStop(1, 'rgba(110, 110, 110, 0)');
      roughCtx.fillStyle = rGrad;
      roughCtx.fillRect(cx - 24, 0, 48, roadSize);
    }
  }

  // Mirror-wet monsoon rain puddles across tarmac for sky/gold/lantern reflections
  for (let p = 0; p < 34; p++) {
    const px = 48 + rnd() * (roadSize - 96);
    const py = rnd() * roadSize;
    const rx = 20 + rnd() * 48;
    const ry = 32 + rnd() * 78;

    const pGrad = roughCtx.createRadialGradient(
      px,
      py,
      4,
      px,
      py,
      Math.max(rx, ry)
    );
    pGrad.addColorStop(0, 'rgba(10, 10, 10, 0.96)');
    pGrad.addColorStop(0.68, 'rgba(28, 28, 28, 0.76)');
    pGrad.addColorStop(1, 'rgba(190, 190, 190, 0)');
    roughCtx.fillStyle = pGrad;
    roughCtx.beginPath();
    roughCtx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
    roughCtx.fill();

    roadCtx.fillStyle = 'rgba(8, 12, 16, 0.42)';
    roadCtx.beginPath();
    roadCtx.ellipse(px, py, rx * 0.88, ry * 0.88, 0, 0, Math.PI * 2);
    roadCtx.fill();
  }

  // Crushed granite macadam aggregate micro-detail
  for (let i = 0; i < 8500; i++) {
    const x = Math.floor(rnd() * roadSize);
    const y = Math.floor(rnd() * roadSize);
    const v = 24 + Math.floor(rnd() * 38);
    roadCtx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    roadCtx.fillRect(x, y, 2, 2);
    roadHeights[y * roadSize + x] = 90 + rnd() * 105;
  }

  // Subtle bitumen tar-sealed hairline cracks
  roadCtx.strokeStyle = 'rgba(8, 10, 12, 0.65)';
  roadCtx.lineWidth = 1.5;
  for (let c = 0; c < 10; c++) {
    let cx = 60 + rnd() * (roadSize - 120);
    let cy = rnd() * roadSize;
    roadCtx.beginPath();
    roadCtx.moveTo(cx, cy);
    for (let seg = 0; seg < 6; seg++) {
      cx += (rnd() - 0.5) * 28;
      cy += 14 + rnd() * 20;
      roadCtx.lineTo(cx, cy);
    }
    roadCtx.stroke();
  }

  // Red Kerala laterite shoulder soil wash along outer highway edges
  for (const edgeX of [0, roadSize - 44]) {
    const mudGrad = roadCtx.createLinearGradient(edgeX, 0, edgeX + 44, 0);
    if (edgeX === 0) {
      mudGrad.addColorStop(0, 'rgba(122, 56, 34, 0.78)');
      mudGrad.addColorStop(0.55, 'rgba(104, 48, 30, 0.35)');
      mudGrad.addColorStop(1, 'rgba(104, 48, 30, 0)');
    } else {
      mudGrad.addColorStop(0, 'rgba(104, 48, 30, 0)');
      mudGrad.addColorStop(0.45, 'rgba(104, 48, 30, 0.35)');
      mudGrad.addColorStop(1, 'rgba(122, 56, 34, 0.78)');
    }
    roadCtx.fillStyle = mudGrad;
    roadCtx.fillRect(edgeX, 0, 44, roadSize);
  }

  // Baked-in subtle white edge shoulder strips & yellow hazard rumble ticks for crisp grazing detail
  roadCtx.fillStyle = 'rgba(238, 234, 222, 0.88)';
  roadCtx.fillRect(36, 0, 7, roadSize);
  roadCtx.fillRect(roadSize - 43, 0, 7, roadSize);
  roadCtx.fillStyle = 'rgba(234, 179, 8, 0.75)';
  for (let ry = 0; ry < roadSize; ry += 32) {
    roadCtx.fillRect(22, ry, 10, 14);
    roadCtx.fillRect(roadSize - 32, ry, 10, 14);
  }

  const asphaltAlbedo = registerColor(roadCanvas, 1, 2);
  const asphaltRoughness = registerLinear(roughCanvas, 1, 2);
  const asphaltNormal = buildNormalMapFromHeight(
    roadHeights,
    roadSize,
    1.95,
    1,
    2,
    maxAnisotropy
  );
  created.push(asphaltNormal);

  // =========================================================================
  // 2. Coursed Kerala Laterite Stone + Tangent Normal Map
  // =========================================================================
  const latSize = 256;
  const [latCanvas, latCtx] = makeCanvas(latSize, latSize);
  const latHeights = new Float32Array(latSize * latSize);
  latHeights.fill(150);

  latCtx.fillStyle = '#753120';
  latCtx.fillRect(0, 0, latSize, latSize);

  const rows = 6;
  const rowH = latSize / rows;
  for (let r = 0; r < rows; r++) {
    const y0 = Math.floor(r * rowH);
    latCtx.fillStyle = 'rgba(32, 14, 10, 0.72)';
    latCtx.fillRect(0, y0, latSize, 3);
    for (let x = 0; x < latSize; x++) {
      latHeights[y0 * latSize + x] = 50;
      latHeights[((y0 + 1) % latSize) * latSize + x] = 62;
    }
    const cols = 3;
    const colW = latSize / cols;
    const offset = (r % 2) * (colW * 0.5);
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor((c * colW + offset) % latSize);
      latCtx.fillRect(x0, y0, 3, Math.ceil(rowH));
      for (let yy = y0; yy < Math.min(latSize, y0 + rowH); yy++) {
        latHeights[yy * latSize + x0] = 56;
      }
    }
  }

  for (let i = 0; i < 1500; i++) {
    const x = Math.floor(rnd() * latSize);
    const y = Math.floor(rnd() * latSize);
    const rad = 1.2 + rnd() * 4.2;
    const dark = rnd() < 0.58;
    latCtx.fillStyle = dark
      ? `rgba(40, 13, 8, ${0.26 + rnd() * 0.28})`
      : `rgba(178, 84, 52, ${0.2 + rnd() * 0.22})`;
    latCtx.beginPath();
    latCtx.arc(x, y, rad, 0, Math.PI * 2);
    latCtx.fill();

    const hVal = dark ? 72 : 198;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = (x + dx + latSize) % latSize;
        const ny = (y + dy + latSize) % latSize;
        latHeights[ny * latSize + nx] = hVal;
      }
    }
  }
  // Tropical emerald moss creeping along mortar joints
  latCtx.fillStyle = 'rgba(46, 98, 48, 0.42)';
  for (let i = 0; i < 68; i++) {
    latCtx.fillRect(rnd() * 256, rnd() * 84, 10 + rnd() * 30, 3 + rnd() * 7);
  }

  const lateriteAlbedo = registerColor(latCanvas, 2, 2);
  const lateriteNormal = buildNormalMapFromHeight(
    latHeights,
    latSize,
    2.5,
    2,
    2,
    maxAnisotropy
  );
  created.push(lateriteNormal);

  // =========================================================================
  // 3. Fissured Tropical Rosewood / Coconut Palm Trunk Bark + Normal Map
  // =========================================================================
  const barkSize = 256;
  const [barkCanvas, barkCtx] = makeCanvas(barkSize, barkSize);
  const barkHeights = new Float32Array(barkSize * barkSize);
  barkCtx.fillStyle = '#402c1f';
  barkCtx.fillRect(0, 0, barkSize, barkSize);

  for (let x = 0; x < barkSize; x++) {
    const ridge = Math.sin(x * 0.22) * 35 + Math.cos(x * 0.53) * 22 + 128;
    for (let y = 0; y < barkSize; y++) {
      const ringBand = Math.sin(y * 0.34) * 18;
      const n = (rnd() - 0.5) * 26 + Math.sin(y * 0.09 + x * 0.15) * 16;
      const h = Math.max(20, Math.min(240, ridge + ringBand + n));
      barkHeights[y * barkSize + x] = h;
      if ((x + y) % 4 === 0) {
        const shade = Math.floor(30 + (h / 255) * 56);
        barkCtx.fillStyle = `rgb(${shade + 16},${shade + 6},${shade - 3})`;
        barkCtx.fillRect(x, y, 2, 4);
      }
    }
  }
  const barkAlbedo = registerColor(barkCanvas, 1, 2);
  const barkNormal = buildNormalMapFromHeight(
    barkHeights,
    barkSize,
    2.7,
    1,
    2,
    maxAnisotropy
  );
  created.push(barkNormal);

  // =========================================================================
  // 4. Lush Meppadi Contoured Tea Plantation Leaf Canopy + Normal Map
  // =========================================================================
  const teaSize = 256;
  const [teaCanvas, teaCtx] = makeCanvas(teaSize, teaSize);
  const teaHeights = new Float32Array(teaSize * teaSize);
  teaHeights.fill(128);

  teaCtx.fillStyle = '#1b4d27';
  teaCtx.fillRect(0, 0, teaSize, teaSize);
  for (let row = 0; row < 12; row++) {
    const y = (row * teaSize) / 12;
    const hRow = teaSize / 12;
    const grad = teaCtx.createLinearGradient(0, y, 0, y + hRow);
    grad.addColorStop(0, '#0f2b16');
    grad.addColorStop(0.28, '#236935');
    grad.addColorStop(0.72, '#439c50');
    grad.addColorStop(1, '#12331b');
    teaCtx.fillStyle = grad;
    teaCtx.fillRect(0, y, teaSize, hRow);
  }
  for (let i = 0; i < 2000; i++) {
    const lx = Math.floor(rnd() * teaSize);
    const ly = Math.floor(rnd() * teaSize);
    const bright = rnd() > 0.42;
    teaCtx.fillStyle = bright
      ? `rgba(148, 224, 112, ${0.2 + rnd() * 0.2})`
      : `rgba(10, 34, 16, ${0.24 + rnd() * 0.2})`;
    teaCtx.beginPath();
    teaCtx.ellipse(lx, ly, 2.8, 1.5, rnd() * Math.PI, 0, Math.PI * 2);
    teaCtx.fill();
    teaHeights[ly * teaSize + lx] = bright ? 210 : 70;
  }
  const teaTerraceAlbedo = registerColor(teaCanvas, 2, 2);
  const teaNormal = buildNormalMapFromHeight(
    teaHeights,
    teaSize,
    1.8,
    2,
    2,
    maxAnisotropy
  );
  created.push(teaNormal);

  // =========================================================================
  // 5. Mangalore Corrugated Terracotta Clay Roof Tile + Normal Map
  // =========================================================================
  const tileSize = 256;
  const [tileCanvas, tileCtx] = makeCanvas(tileSize, tileSize);
  const tileHeights = new Float32Array(tileSize * tileSize);
  tileCtx.fillStyle = '#9e3e22';
  tileCtx.fillRect(0, 0, tileSize, tileSize);

  const cols = 12;
  const colW = tileSize / cols;
  for (let c = 0; c < cols; c++) {
    const x0 = c * colW;
    const g = tileCtx.createLinearGradient(x0, 0, x0 + colW, 0);
    g.addColorStop(0, '#6e2612');
    g.addColorStop(0.45, '#be4f2e');
    g.addColorStop(0.8, '#9c3c20');
    g.addColorStop(1, '#5c1f0e');
    tileCtx.fillStyle = g;
    tileCtx.fillRect(x0, 0, colW, tileSize);
  }
  for (let r = 0; r < 8; r++) {
    const y0 = (r * tileSize) / 8;
    tileCtx.fillStyle = 'rgba(42, 14, 6, 0.55)';
    tileCtx.fillRect(0, y0, tileSize, 3);
  }
  for (let y = 0; y < tileSize; y++) {
    const lap = (y % 32) < 3 ? 65 : 155;
    for (let x = 0; x < tileSize; x++) {
      const wave = Math.sin((x / colW) * Math.PI * 2) * 48;
      tileHeights[y * tileSize + x] = Math.max(20, Math.min(245, lap + wave));
    }
  }
  const terracottaAlbedo = registerColor(tileCanvas, 2, 2);
  const terracottaNormal = buildNormalMapFromHeight(
    tileHeights,
    tileSize,
    2.2,
    2,
    2,
    maxAnisotropy
  );
  created.push(terracottaNormal);

  // =========================================================================
  // 6. Pinnate Kerala Coconut Palm Frond Texture (Alpha-Cutout Leaflets)
  // =========================================================================
  const [palmCanvas, palmCtx] = makeCanvas(256, 512);
  palmCtx.clearRect(0, 0, 256, 512);
  // Central rachis spine
  const spineGrad = palmCtx.createLinearGradient(0, 512, 0, 0);
  spineGrad.addColorStop(0, '#4d7c2b');
  spineGrad.addColorStop(1, '#6ca338');
  palmCtx.fillStyle = spineGrad;
  palmCtx.beginPath();
  palmCtx.moveTo(123, 512);
  palmCtx.lineTo(133, 512);
  palmCtx.lineTo(129, 8);
  palmCtx.lineTo(127, 8);
  palmCtx.closePath();
  palmCtx.fill();

  // 34 pairs of arching pinnate palm leaflets
  for (let i = 0; i < 34; i++) {
    const t = i / 33;
    const y = 495 - t * 475;
    const span = Math.sin(Math.pow(t, 0.72) * Math.PI) * 116 + 10;
    const droop = 16 + t * 22;

    for (const dir of [-1, 1]) {
      const lGrad = palmCtx.createLinearGradient(128, y, 128 + dir * span, y + droop);
      lGrad.addColorStop(0, '#27632a');
      lGrad.addColorStop(0.55, '#3b8c36');
      lGrad.addColorStop(1, '#5ab546');
      palmCtx.fillStyle = lGrad;
      palmCtx.beginPath();
      palmCtx.moveTo(128, y - 4);
      palmCtx.quadraticCurveTo(
        128 + dir * span * 0.58,
        y - 6,
        128 + dir * span,
        y + droop
      );
      palmCtx.quadraticCurveTo(
        128 + dir * span * 0.52,
        y + 4,
        128,
        y + 4
      );
      palmCtx.closePath();
      palmCtx.fill();
    }
  }
  const palmFrondAlbedo = registerColor(palmCanvas, 1, 1);

  // =========================================================================
  // 7. Malabar Woven Bamboo Texture
  // =========================================================================
  const [bamCanvas, bamCtx] = makeCanvas(256, 256);
  bamCtx.fillStyle = '#8e6c3a';
  bamCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 16; i++) {
    const y = i * 16;
    bamCtx.fillStyle = i % 2 === 0 ? '#ab864b' : '#94703b';
    bamCtx.fillRect(0, y + 1, 256, 13);
    bamCtx.fillStyle = '#5c4320';
    bamCtx.fillRect(0, y + 14, 256, 2);
    const nodeX = ((i * 67) % 200) + 24;
    bamCtx.fillStyle = 'rgba(72, 50, 22, 0.55)';
    bamCtx.fillRect(nodeX, y + 1, 3, 13);
  }
  const bambooAlbedo = registerColor(bamCanvas, 1, 1);

  // =========================================================================
  // 8. Cascading Soochipara Waterfall & Kabini River Flow + Ripple Normal Map
  // =========================================================================
  const watSize = 256;
  const [watCanvas, watCtx] = makeCanvas(watSize, watSize);
  const watHeights = new Float32Array(watSize * watSize);
  const wGrad = watCtx.createLinearGradient(0, 0, watSize, 0);
  wGrad.addColorStop(0, '#0f515e');
  wGrad.addColorStop(0.25, '#1d8596');
  wGrad.addColorStop(0.5, '#6cdce8');
  wGrad.addColorStop(0.75, '#1d8596');
  wGrad.addColorStop(1, '#0f515e');
  watCtx.fillStyle = wGrad;
  watCtx.fillRect(0, 0, watSize, watSize);

  for (let y = 0; y < watSize; y++) {
    for (let x = 0; x < watSize; x++) {
      watHeights[y * watSize + x] =
        128 +
        Math.sin(x * 0.14 + y * 0.08) * 44 +
        Math.cos(y * 0.24 - x * 0.09) * 34;
    }
  }
  // Churning white-water cascade foam streaks
  for (let i = 0; i < 165; i++) {
    watCtx.fillStyle = `rgba(235, 252, 255, ${0.22 + rnd() * 0.42})`;
    watCtx.fillRect(rnd() * 244, rnd() * 256, 2 + rnd() * 5, 24 + rnd() * 56);
  }
  const waterFlowAlbedo = registerColor(watCanvas, 1, 2);
  const waterNormal = buildNormalMapFromHeight(
    watHeights,
    watSize,
    2.1,
    1,
    2,
    maxAnisotropy
  );
  created.push(waterNormal);

  // =========================================================================
  // 9. Edakkal Prehistoric Petroglyph Granite Wall Texture
  // =========================================================================
  const [petCanvas, petCtx] = makeCanvas(256, 256);
  petCtx.fillStyle = '#363836';
  petCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 700; i++) {
    const c = 42 + Math.floor(rnd() * 32);
    petCtx.fillStyle = `rgb(${c},${c},${c - 3})`;
    petCtx.fillRect(rnd() * 256, rnd() * 256, 4, 4);
  }
  petCtx.strokeStyle = '#f5be58';
  petCtx.lineWidth = 4.5;
  petCtx.lineCap = 'round';
  petCtx.beginPath();
  petCtx.arc(128, 86, 30, 0, Math.PI * 2);
  petCtx.stroke();
  for (let a = 0; a < 8; a++) {
    const ang = (a * Math.PI) / 4;
    petCtx.beginPath();
    petCtx.moveTo(128 + Math.cos(ang) * 14, 86 + Math.sin(ang) * 14);
    petCtx.lineTo(128 + Math.cos(ang) * 44, 86 + Math.sin(ang) * 44);
    petCtx.stroke();
  }
  petCtx.beginPath();
  petCtx.moveTo(78, 198);
  petCtx.lineTo(94, 165);
  petCtx.lineTo(110, 198);
  petCtx.moveTo(94, 165);
  petCtx.lineTo(94, 136);
  petCtx.moveTo(74, 144);
  petCtx.lineTo(94, 154);
  petCtx.lineTo(114, 144);
  petCtx.stroke();
  const petroglyphAlbedo = registerColor(petCanvas, 1, 1);

  // =========================================================================
  // 10. Indian Highway Chevrons, Roadside Chayakada Sign & Kerala KSRTC Bus Board
  // =========================================================================
  const [chevCanvas, chevCtx] = makeCanvas(256, 128);
  chevCtx.fillStyle = '#facc15';
  chevCtx.fillRect(0, 0, 256, 128);
  chevCtx.fillStyle = '#141414';
  for (let x = -64; x < 320; x += 64) {
    chevCtx.beginPath();
    chevCtx.moveTo(x, 0);
    chevCtx.lineTo(x + 32, 0);
    chevCtx.lineTo(x + 60, 64);
    chevCtx.lineTo(x + 32, 128);
    chevCtx.lineTo(x, 128);
    chevCtx.lineTo(x + 28, 64);
    chevCtx.closePath();
    chevCtx.fill();
  }
  const chevronAlbedo = registerColor(chevCanvas, 1, 1);

  // Authentic Kerala Wayanad Roadside Tea & Spice Stall Board
  const [shopCanvas, shopCtx] = makeCanvas(512, 160);
  shopCtx.fillStyle = '#7c2d12';
  shopCtx.fillRect(0, 0, 512, 160);
  shopCtx.strokeStyle = '#fde047';
  shopCtx.lineWidth = 8;
  shopCtx.strokeRect(10, 10, 492, 140);
  shopCtx.fillStyle = '#fef08a';
  shopCtx.font = '700 38px sans-serif';
  shopCtx.fillText('WAYANAD CHAYAKADA', 34, 72);
  shopCtx.fillStyle = '#ffffff';
  shopCtx.font = '600 26px sans-serif';
  shopCtx.fillText('MALABAR TEA · SPICES · CHIPS', 36, 122);
  const chayakadaSignAlbedo = registerColor(shopCanvas, 1, 1);

  // Authentic Kerala KSRTC "Aanavandi" Destination Front Header & Grille Texture
  const [busCanvas, busCtx] = makeCanvas(256, 256);
  busCtx.fillStyle = '#b91c1c';
  busCtx.fillRect(0, 0, 256, 256);
  // Cream upper band
  busCtx.fillStyle = '#fef3c7';
  busCtx.fillRect(0, 0, 256, 108);
  // Destination board
  busCtx.fillStyle = '#111827';
  busCtx.fillRect(28, 12, 200, 34);
  busCtx.fillStyle = '#facc15';
  busCtx.font = '700 20px sans-serif';
  busCtx.fillText('KALPETTA · NH766', 38, 36);
  // Dark tinted windshield with wipers
  busCtx.fillStyle = '#1e293b';
  busCtx.fillRect(18, 52, 220, 68);
  busCtx.fillStyle = 'rgba(148, 197, 255, 0.28)';
  busCtx.beginPath();
  busCtx.moveTo(26, 116);
  busCtx.lineTo(86, 56);
  busCtx.lineTo(132, 56);
  busCtx.lineTo(72, 116);
  busCtx.closePath();
  busCtx.fill();
  // Horizontal chrome grille slats
  busCtx.fillStyle = '#1f2937';
  busCtx.fillRect(52, 152, 152, 54);
  busCtx.fillStyle = '#e5e7eb';
  for (let gy = 158; gy < 202; gy += 10) {
    busCtx.fillRect(58, gy, 140, 4);
  }
  // Yellow Kerala commercial number plate
  busCtx.fillStyle = '#facc15';
  busCtx.fillRect(82, 218, 92, 22);
  busCtx.fillStyle = '#111827';
  busCtx.font = '700 14px monospace';
  busCtx.fillText('KL 12 G 766', 86, 234);
  const ksrtcFrontAlbedo = registerColor(busCanvas, 1, 1);

  const signDefinitions = [
    { top: 'NH 766 · GHAT PASS', main: 'LAKKIDI 9/9', sub: 'HAIRPIN BEND' },
    { top: 'WAYANAD DISTRICT', main: 'VYTHIRI · 6 KM', sub: 'KALPETTA 18 KM' },
    { top: 'MEPPADI HIGHLANDS', main: 'CHEMBRA PEAK', sub: 'TEA ESTATES' },
    { top: 'HERITAGE ROUTE', main: 'EDAKKAL CAVES', sub: 'AMBUKUTHI PASS' },
    { top: 'VELLARIMALA GORGE', main: 'SOOCHIPARA', sub: 'WATERFALLS 2 KM' },
    { top: 'KABINI RESERVOIR', main: 'BANASURA DAM', sub: 'KURUVADWEEP' },
  ];

  const highwaySigns = signDefinitions.map((spec) => {
    const [sc, sctx] = makeCanvas(512, 256);
    sctx.fillStyle = '#0d5932';
    sctx.fillRect(0, 0, 512, 256);
    sctx.strokeStyle = '#f5f7f6';
    sctx.lineWidth = 10;
    sctx.strokeRect(14, 14, 484, 228);

    sctx.fillStyle = '#facc15';
    sctx.font = '700 24px sans-serif';
    sctx.fillText(spec.top, 38, 66);

    sctx.fillStyle = '#ffffff';
    sctx.font = '700 52px sans-serif';
    sctx.fillText(spec.main, 38, 142);

    sctx.fillStyle = '#d1fae5';
    sctx.font = '600 28px sans-serif';
    sctx.fillText(spec.sub, 38, 202);

    return registerColor(sc, 1, 1);
  });

  // =========================================================================
  // 11. Contact Shadow, Mist Puff & Volumetric Golden Sunbeam God-Ray Texture
  // =========================================================================
  const [shCanvas, shCtx] = makeCanvas(128, 128);
  const rad = shCtx.createRadialGradient(64, 64, 8, 64, 64, 60);
  rad.addColorStop(0, 'rgba(5, 10, 8, 0.78)');
  rad.addColorStop(0.55, 'rgba(5, 10, 8, 0.36)');
  rad.addColorStop(1, 'rgba(5, 10, 8, 0)');
  shCtx.fillStyle = rad;
  shCtx.fillRect(0, 0, 128, 128);
  const contactShadowMap = registerColor(shCanvas, 1, 1);

  const [mistCanvas, mistCtx] = makeCanvas(256, 256);
  const mRad = mistCtx.createRadialGradient(128, 128, 12, 128, 128, 122);
  mRad.addColorStop(0, 'rgba(232, 246, 240, 0.56)');
  mRad.addColorStop(0.45, 'rgba(210, 232, 224, 0.25)');
  mRad.addColorStop(1, 'rgba(195, 220, 212, 0)');
  mistCtx.fillStyle = mRad;
  mistCtx.fillRect(0, 0, 256, 256);
  const mistPuffMap = registerColor(mistCanvas, 1, 1);

  // Soft diagonal volumetric sunlight god-ray shaft texture
  const [rayCanvas, rayCtx] = makeCanvas(128, 256);
  const rayGrad = rayCtx.createLinearGradient(0, 0, 0, 256);
  rayGrad.addColorStop(0, 'rgba(255, 236, 178, 0)');
  rayGrad.addColorStop(0.25, 'rgba(255, 232, 165, 0.36)');
  rayGrad.addColorStop(0.7, 'rgba(255, 224, 148, 0.14)');
  rayGrad.addColorStop(1, 'rgba(255, 220, 140, 0)');
  rayCtx.fillStyle = rayGrad;
  rayCtx.fillRect(0, 0, 128, 256);
  // Feather horizontal edges so beam never shows hard plane edges
  rayCtx.globalCompositeOperation = 'destination-in';
  const hMask = rayCtx.createLinearGradient(0, 0, 128, 0);
  hMask.addColorStop(0, 'rgba(0,0,0,0)');
  hMask.addColorStop(0.3, 'rgba(0,0,0,1)');
  hMask.addColorStop(0.7, 'rgba(0,0,0,1)');
  hMask.addColorStop(1, 'rgba(0,0,0,0)');
  rayCtx.fillStyle = hMask;
  rayCtx.fillRect(0, 0, 128, 256);
  rayCtx.globalCompositeOperation = 'source-over';
  const sunbeamMap = registerColor(rayCanvas, 1, 1);

  return {
    lateriteAlbedo,
    lateriteNormal,
    teaTerraceAlbedo,
    teaNormal,
    asphaltAlbedo,
    asphaltNormal,
    asphaltRoughness,
    barkAlbedo,
    barkNormal,
    bambooAlbedo,
    terracottaAlbedo,
    terracottaNormal,
    palmFrondAlbedo,
    waterFlowAlbedo,
    waterNormal,
    petroglyphAlbedo,
    chevronAlbedo,
    chayakadaSignAlbedo,
    ksrtcFrontAlbedo,
    highwaySigns,
    contactShadowMap,
    mistPuffMap,
    sunbeamMap,
    dispose: () => {
      created.forEach((t) => t.dispose());
    },
  };
}
