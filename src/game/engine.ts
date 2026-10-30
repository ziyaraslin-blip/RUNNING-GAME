import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LANDMARK_SOUNDSCAPE_LABELS } from './ambience';
import { WayanadAudio } from './audio';
import {
  getZoneForDistance,
  MAX_BASE_RUN_SPEED,
  SPEED_STEP_PER_100M,
  WAYANAD_ZONES,
} from './levels';
import { createWayanadMaterials, WayanadMaterialLibrary } from './materials';
import {
  AtmosphericSkyRig,
  ChasingMonsterRig,
  CHUNK_LENGTH,
  createAtmosphericSkyDome,
  createChasingMonster,
  createDistantGhatsBackdrop,
  createExplorerRunner,
  createGlidingBirds,
  createGoldCoinGeometry,
  createObstacleMesh,
  createPowerupMesh,
  createTrackChunk,
  ExplorerRunnerRig,
  GlidingBirdRig,
  LANE_WIDTH,
  ObstacleInstance,
  PowerupInstance,
  TRACK_CHUNK_COUNT,
  TrackChunkRig,
} from './models';
import { createProceduralTextures } from './textures';
import {
  CameraPreset,
  GamePhase,
  HudSnapshot,
  LandmarkType,
  ObstacleKind,
  PowerupKind,
} from './types';

interface CoinSlot {
  active: boolean;
  lane: number;
  laneOffset: number;
  localY: number;
  baseY: number;
  z: number;
  phase: number;
  magnetized: boolean;
  worldX: number;
  worldY: number;
}

interface BurstParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
}

interface RouteSample {
  x: number;
  y: number;
  yaw: number;
  pitch: number;
  bank: number;
}

const MAX_COINS = 120;
const MAX_PARTICLES = 96;
const MAX_RAIN = 160;
const MAX_SPEED_LINES = 36;
const GRAVITY = 34.0;
const JUMP_VELOCITY = 13.4;

const STORAGE_KEYS = {
  highScore: 'wayanad_runner_high_score_v1',
  bestDistance: 'wayanad_runner_best_dist_v1',
  coinsBank: 'wayanad_runner_coins_bank_v1',
};

// Reusable module-scope math objects (Zero GC in tick loop)
const _dummy = new THREE.Object3D();
const _camTargetPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();
const _camUp = new THREE.Vector3(0, 1, 0);
const _goldColor = new THREE.Color(0xffd24c);
const _dustColor = new THREE.Color(0xd6c7b2);
const _splashColor = new THREE.Color(0xc4ebff);
const _chronoColor = new THREE.Color(0x38bdf8);
const _zenithTarget = new THREE.Color();
const _horizonTarget = new THREE.Color();
const _sunColorTarget = new THREE.Color();
const _routeSample: RouteSample = { x: 0, y: 0, yaw: 0, pitch: 0, bank: 0 };

function readStoredInt(key: string): number {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeStoredInt(key: string, value: number): void {
  try {
    window.localStorage.setItem(key, String(Math.floor(value)));
  } catch {
    // Ignore storage quota errors in sandboxed iframes
  }
}

export class WayanadRunnerEngine {
  private readonly mountEl: HTMLElement;
  private readonly onHudChange: (snapshot: HudSnapshot) => void;
  private readonly audio = new WayanadAudio();

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private fog!: THREE.FogExp2;
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private skyDome!: AtmosphericSkyRig;
  private mats!: WayanadMaterialLibrary;
  private isSoftwareGl = false;
  private webglFallback = false;
  private disposed = false;
  private frameId = 0;
  private lastTimeMs = 0;

  // World & Actors
  private runner!: ExplorerRunnerRig;
  private monster!: ChasingMonsterRig;
  private monsterLight!: THREE.PointLight;
  private chunks: TrackChunkRig[] = [];
  private backdrop!: THREE.Group;

  // Pooled Obstacles, Powerups, Coins & Particles
  private obstaclePools!: Map<ObstacleKind, ObstacleInstance[]>;
  private activeObstacles: ObstacleInstance[] = [];
  private powerupPool: PowerupInstance[] = [];
  private coinGeo!: THREE.BufferGeometry;
  private coinMesh!: THREE.InstancedMesh;
  private coins: CoinSlot[] = [];
  private particleGeo!: THREE.BufferGeometry;
  private particleMat!: THREE.MeshStandardMaterial;
  private particleMesh!: THREE.InstancedMesh;
  private particles: BurstParticle[] = [];
  private rainGeo!: THREE.BufferGeometry;
  private rainMat!: THREE.MeshBasicMaterial;
  private rainMesh!: THREE.InstancedMesh;
  private rainDrops: Array<{ x: number; y: number; z: number; speed: number }> =
    [];
  private speedLineGeo!: THREE.BufferGeometry;
  private speedLineMat!: THREE.MeshBasicMaterial;
  private speedLineMesh!: THREE.InstancedMesh;
  private speedLines: Array<{ x: number; y: number; z: number; speed: number }> =
    [];
  private birds: GlidingBirdRig[] = [];

  // Game State
  private phase: GamePhase = 'title';
  private startZoneOffset = 0;
  private currentZone = WAYANAD_ZONES[0];
  private distanceMeters = 0;
  private currentBaseSpeed = WAYANAD_ZONES[0].baseSpeed;
  private lastSpeedMilestoneStep = 0;
  private milestoneBannerTimer = 0;
  private milestoneBannerMeters = 0;
  private runCoins = 0;
  private totalCoinsBank = 0;
  private score = 0;
  private highScore = 0;
  private bestDistance = 0;
  private multiplier = 1;
  private deathReason = '';

  // Real-Life Winding NH-766 Route Curvature & Elevation Grade
  private activeRouteCurve = 0.0018;
  private activeRouteGrade = 0.0005;

  // 4D Chrono-Shift & 4D Dynamic Atmosphere State
  private chronoCharge = 100; // 0..100%
  private chronoTimer = 0; // Active 4D Time-Shift remaining seconds
  private echoHistory: Array<{ x: number; y: number; rotZ: number }> = [];
  private echoRecordAccum = 0;
  private dayCyclePhase = 0.14; // 0..1 continuous 4D Time-of-Day cycle
  private fx4dEnabled = true;
  private windCrossForce = 0.25;
  private lightningFlash = 0;
  private nextLightningTimer = 7.5;
  private lensWetness = 0.2;

  // Runner Kinematics
  private targetLane = 0; // -1, 0, +1
  private playerX = 0;
  private playerY = 0;
  private playerVy = 0;
  private grounded = true;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private slideTimer = 0;
  private slideQueued = false;
  private runCyclePhase = 0;
  private landSquash = 0;
  private prevRunnerStepSign = 1;
  private coinChainCount = 0;
  private coinChainTimer = 0;

  // Powerups
  private magnetTimer = 0;
  private boostTimer = 0;

  // Chasing Monster State
  private monsterProximity = 0.72;
  private monsterDangerTimer = 0;
  private monsterX = 0;
  private monsterStridePhase = 0;
  private prevMonsterStepSign = 1;
  private monsterRoarFlash = 0;
  private monsterCatchAnim = 0;

  // Spawner & Camera (Default 'elevated' — slightly above chase angle!)
  private nextSpawnZ = -34;
  private waveCounter = 0;
  private hitstopTimer = 0;
  private cameraShake = 0;
  private cameraPreset: CameraPreset = 'elevated';
  private curCamPos = new THREE.Vector3(5.2, 4.1, -6.2);
  private curCamLook = new THREE.Vector3(1.5, 1.35, 1.3);
  private curCamRoll = 0;
  private dockCollapsed = false;
  private hudEmitAccum = 0;

  // Pointer / Touch Swipe Tracking
  private swipeActive = false;
  private swipeStartX = 0;
  private swipeStartY = 0;
  private swipeConsumed = false;
  private lastTapTimeMs = 0;

  constructor(mountEl: HTMLElement, onHudChange: (s: HudSnapshot) => void) {
    this.mountEl = mountEl;
    this.onHudChange = onHudChange;

    this.highScore = readStoredInt(STORAGE_KEYS.highScore);
    this.bestDistance = readStoredInt(STORAGE_KEYS.bestDistance);
    this.totalCoinsBank = readStoredInt(STORAGE_KEYS.coinsBank);

    this.initRendererAndScene();
    if (!this.webglFallback) {
      this.buildWorld();
      this.bindEvents();
      this.resetToTitleScene();
      this.lastTimeMs = performance.now();
      this.scheduleNextFrame();
    }
    this.emitHud(true);
  }

  private initRendererAndScene(): void {
    this.isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      this.webglFallback = true;
      return;
    }

    const width = Math.max(1, this.mountEl.clientWidth || window.innerWidth);
    const height = Math.max(1, this.mountEl.clientHeight || window.innerHeight);

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    this.mountEl.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.fog = new THREE.FogExp2(
      this.currentZone.skyHex,
      this.currentZone.fogDensity
    );
    this.scene.fog = this.fog;

    // Cinematic Atmospheric Sky Dome
    this.skyDome = createAtmosphericSkyDome();
    this.scene.add(this.skyDome.mesh);

    this.camera = new THREE.PerspectiveCamera(58, width / height, 0.2, 260);
    this.camera.position.copy(this.curCamPos);
    this.camera.lookAt(this.curCamLook);

    // Studio IBL Environment Map for wet asphalt reflections, vehicle clearcoat & gleaming gold
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    // Cinematic 3-Point Highland Lighting Rig with Crisp 2048x2048 PCFSoft Shadows
    this.hemiLight = new THREE.HemisphereLight(0xb4ebe0, 0x243d2a, 1.12);
    this.hemiLight.position.set(0, 48, 0);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffe6b8, 2.35);
    this.sunLight.position.set(15, 26, 12);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.radius = 2.2;
    const d = 16;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 72;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    const rimLight = new THREE.DirectionalLight(0x90e0f4, 0.72);
    rimLight.position.set(-14, 13, -22);
    this.scene.add(rimLight);

    // Molten orange chase light radiating from the Churam Monster
    this.monsterLight = new THREE.PointLight(0xff521b, 2.2, 13, 2);
    this.monsterLight.position.set(0, 2.1, 3.0);
    this.scene.add(this.monsterLight);
  }

  /**
   * Evaluates the real-life winding & climbing NH-766 mountain highway curve at world Z.
   * At z >= 0 (runner & chasing monster zone), x = 0, y = 0, yaw = 0, pitch = 0 for exact collisions.
   * Ahead of the runner (z < 0), the road sweeps around hairpin cliff curves and mountain grades.
   */
  private sampleRouteAt(z: number): RouteSample {
    const u = Math.max(0, -z);
    const x = this.activeRouteCurve * u * u;
    const y = this.activeRouteGrade * u * u;
    const dXdu = 2.0 * this.activeRouteCurve * u;
    const dYdu = 2.0 * this.activeRouteGrade * u;

    _routeSample.x = x;
    _routeSample.y = y;
    _routeSample.yaw = -Math.atan(dXdu);
    _routeSample.pitch = Math.atan(dYdu);
    _routeSample.bank = THREE.MathUtils.clamp(
      -this.activeRouteCurve * 26.0 * Math.min(1, u / 32),
      -0.1,
      0.1
    );
    return _routeSample;
  }

  private buildWorld(): void {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const textures = createProceduralTextures(maxAniso);
    this.mats = createWayanadMaterials(textures, this.isSoftwareGl);

    // 1. Distant Western Ghats Mountain Amphitheater
    this.backdrop = createDistantGhatsBackdrop(this.mats);
    this.scene.add(this.backdrop);

    // 2. Pooled 12m Winding NH-766 Ghat Highway Chunks (15 chunks = 180m span)
    for (let i = 0; i < TRACK_CHUNK_COUNT; i++) {
      const chunk = createTrackChunk(this.mats, i);
      chunk.zCenter = 24 - i * CHUNK_LENGTH;
      this.scene.add(chunk.group);
      this.chunks.push(chunk);
    }
    this.updateTrackChunkTransforms(0);

    // 3. Hero Actors: Realistic Explorer Runner (+ 4D Echoes) & Churam Monster
    this.runner = createExplorerRunner(this.mats, this.scene);
    this.scene.add(this.runner.root);

    this.monster = createChasingMonster(this.mats);
    this.scene.add(this.monster.root);

    // 4. Pooled 3-Lane Obstacles
    this.obstaclePools = new Map();
    const poolCounts: Record<ObstacleKind, number> = {
      [ObstacleKind.JumpHurdle]: 10,
      [ObstacleKind.SlideArch]: 10,
      [ObstacleKind.SolidMonolith]: 12,
      [ObstacleKind.WildTusker]: 6,
      [ObstacleKind.GorgeGap]: 8,
    };

    (Object.keys(poolCounts) as ObstacleKind[]).forEach((kind) => {
      const list: ObstacleInstance[] = [];
      const count = poolCounts[kind];
      for (let i = 0; i < count; i++) {
        const { group, animPivot, secondaryPivot } = createObstacleMesh(
          kind,
          this.mats
        );
        group.visible = false;
        this.scene.add(group);
        list.push({
          active: false,
          kind,
          lane: 0,
          z: -999,
          passed: false,
          hitHandled: false,
          trumpeted: false,
          group,
          animPivot,
          secondaryPivot,
        });
      }
      this.obstaclePools.set(kind, list);
    });

    // 5. Pooled Powerup Totems
    for (const kind of [
      PowerupKind.CoinMagnet,
      PowerupKind.CoinMagnet,
      PowerupKind.SpiceBoost,
      PowerupKind.SpiceBoost,
    ]) {
      const { group, spinner } = createPowerupMesh(kind, this.mats);
      group.visible = false;
      this.scene.add(group);
      this.powerupPool.push({
        active: false,
        kind,
        lane: 0,
        y: 1.15,
        z: -999,
        group,
        spinner,
      });
    }

    // 6. InstancedMesh Gold Coins
    this.coinGeo = createGoldCoinGeometry();
    this.coinMesh = new THREE.InstancedMesh(
      this.coinGeo,
      this.mats.goldCoin,
      MAX_COINS
    );
    this.coinMesh.frustumCulled = false;
    this.coinMesh.castShadow = !this.isSoftwareGl;
    this.scene.add(this.coinMesh);

    for (let i = 0; i < MAX_COINS; i++) {
      this.coins.push({
        active: false,
        lane: 0,
        laneOffset: 0,
        localY: 0.9,
        baseY: 0.9,
        z: -999,
        phase: i * 0.35,
        magnetized: false,
        worldX: 0,
        worldY: -50,
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.coinMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.coinMesh.instanceMatrix.needsUpdate = true;

    // 7. InstancedMesh 3D Burst Particles
    this.particleGeo = new THREE.OctahedronGeometry(0.11, 0);
    this.particleMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.32,
      metalness: 0.65,
    });
    this.particleMesh = new THREE.InstancedMesh(
      this.particleGeo,
      this.particleMat,
      MAX_PARTICLES
    );
    this.particleMesh.frustumCulled = false;
    this.particleMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(MAX_PARTICLES * 3),
      3
    );
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.5,
        scale: 1,
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, _goldColor);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    this.particleMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.particleMesh);

    // 8. InstancedMesh 4D Slanted Monsoon Rain Streaks
    this.rainGeo = new THREE.BoxGeometry(0.022, 0.95, 0.022);
    this.rainMat = new THREE.MeshBasicMaterial({
      color: 0xd0efff,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
    });
    this.rainMesh = new THREE.InstancedMesh(
      this.rainGeo,
      this.rainMat,
      MAX_RAIN
    );
    this.rainMesh.frustumCulled = false;
    for (let i = 0; i < MAX_RAIN; i++) {
      this.rainDrops.push({
        x: (Math.random() - 0.5) * 24,
        y: Math.random() * 15,
        z: 10 - Math.random() * 54,
        speed: 20 + Math.random() * 8,
      });
    }
    this.scene.add(this.rainMesh);

    // 9. InstancedMesh High-Speed Wind Lines (Temple Run / Subway Surfers velocity streaks)
    this.speedLineGeo = new THREE.BoxGeometry(0.018, 0.018, 2.4);
    this.speedLineMat = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    });
    this.speedLineMesh = new THREE.InstancedMesh(
      this.speedLineGeo,
      this.speedLineMat,
      MAX_SPEED_LINES
    );
    this.speedLineMesh.frustumCulled = false;
    for (let i = 0; i < MAX_SPEED_LINES; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.speedLines.push({
        x: side * (3.8 + Math.random() * 3.6),
        y: 0.8 + Math.random() * 4.5,
        z: 6 - Math.random() * 42,
        speed: 28 + Math.random() * 14,
      });
    }
    this.scene.add(this.speedLineMesh);

    // 10. Ambient Gliding Malabar Hill Birds across the mountain valley
    this.birds = createGlidingBirds(this.mats, 6);
    for (const b of this.birds) {
      this.scene.add(b.group);
    }

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private clearAllSpawnedEntities(): void {
    for (const obs of this.activeObstacles) {
      obs.active = false;
      obs.group.visible = false;
    }
    this.activeObstacles.length = 0;

    for (const p of this.powerupPool) {
      p.active = false;
      p.group.visible = false;
    }

    for (let i = 0; i < MAX_COINS; i++) {
      this.coins[i].active = false;
      this.coins[i].magnetized = false;
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.coinMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.coinMesh.instanceMatrix.needsUpdate = true;

    for (const echo of this.runner.chronoEchoes) {
      echo.visible = false;
    }
    this.echoHistory.length = 0;
  }

  private resetToTitleScene(): void {
    this.clearAllSpawnedEntities();
    this.phase = 'title';
    this.currentZone = WAYANAD_ZONES[this.startZoneOffset];
    this.distanceMeters = 0;
    this.currentBaseSpeed = this.currentZone.baseSpeed;
    this.lastSpeedMilestoneStep = 0;
    this.milestoneBannerTimer = 0;
    this.milestoneBannerMeters = 0;
    this.runCoins = 0;
    this.score = 0;
    this.multiplier = 1;
    this.targetLane = 0;
    this.playerX = 0;
    this.playerY = 0;
    this.playerVy = 0;
    this.grounded = true;
    this.slideTimer = 0;
    this.magnetTimer = 0;
    this.boostTimer = 0;
    this.chronoCharge = 100;
    this.chronoTimer = 0;
    this.activeRouteCurve = 0.0022;
    this.activeRouteGrade = 0.0006;
    this.monsterProximity = 0.78;
    this.monsterDangerTimer = 0;
    this.monsterX = 0;
    this.monsterCatchAnim = 0;

    this.runner.root.position.set(0, 0, 0);
    this.monster.root.position.set(0, 0, 3.15);
    this.updateTrackChunkTransforms(0);

    for (let i = 0; i < 10; i++) {
      this.spawnSingleCoin(0, 0.9, -4.5 - i * 2.5);
    }
  }

  // ==================== PUBLIC CONTROLS ====================

  public startGame(zoneIndex = this.startZoneOffset): void {
    this.audio.unlock();
    this.startZoneOffset = Math.max(
      0,
      Math.min(WAYANAD_ZONES.length - 1, zoneIndex)
    );
    this.currentZone = WAYANAD_ZONES[this.startZoneOffset];
    this.clearAllSpawnedEntities();

    this.phase = 'playing';
    this.distanceMeters = 0;
    this.currentBaseSpeed = this.currentZone.baseSpeed;
    this.lastSpeedMilestoneStep = 0;
    this.milestoneBannerTimer = 0;
    this.milestoneBannerMeters = 0;
    this.runCoins = 0;
    this.score = 0;
    this.multiplier = 1;
    this.deathReason = '';

    this.targetLane = 0;
    this.playerX = 0;
    this.playerY = 0;
    this.playerVy = 0;
    this.grounded = true;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.slideTimer = 0;
    this.slideQueued = false;
    this.coinChainCount = 0;
    this.coinChainTimer = 0;

    this.magnetTimer = 0;
    this.boostTimer = 0;
    this.chronoCharge = 100;
    this.chronoTimer = 0;

    // Monster bursts out roaring right behind the explorer at run start!
    this.monsterProximity = 0.85;
    this.monsterDangerTimer = 4.2;
    this.monsterX = 0;
    this.monsterRoarFlash = 1.0;
    this.monsterCatchAnim = 0;
    this.audio.playMonsterRoar(0.95);

    this.nextSpawnZ = -28;
    this.waveCounter = 0;

    for (let c = 0; c < 6; c++) {
      this.spawnSingleCoin(0, 0.9, -8 - c * 2.5);
    }
    while (this.nextSpawnZ > -145) {
      this.spawnNextWave();
    }

    this.emitHud(true);
  }

  public selectZone(zoneIndex: number): void {
    this.startZoneOffset = Math.max(
      0,
      Math.min(WAYANAD_ZONES.length - 1, zoneIndex)
    );
    if (this.phase === 'title') {
      this.currentZone = WAYANAD_ZONES[this.startZoneOffset];
      this.currentBaseSpeed = this.currentZone.baseSpeed;
      this.emitHud(true);
    } else {
      this.startGame(this.startZoneOffset);
    }
  }

  public triggerChronoShift(): void {
    if (this.phase !== 'playing') return;
    if (this.chronoTimer > 0 || this.chronoCharge < 100) return;

    this.audio.unlock();
    this.chronoCharge = 0;
    this.chronoTimer = 4.8;
    this.cameraShake = 0.24;
    this.audio.playChronoShift(true);
    this.spawnBurst(this.playerX, this.playerY + 1.0, 0, 18, 'chrono');
    this.emitHud(true);
  }

  public toggleFx4d(): void {
    this.fx4dEnabled = !this.fx4dEnabled;
    this.audio.setHapticsEnabled(this.fx4dEnabled);
    this.emitHud(true);
  }

  public togglePause(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.emitHud(true);
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
      this.lastTimeMs = performance.now();
      this.emitHud(true);
    }
  }

  public returnToTitle(): void {
    this.resetToTitleScene();
    this.emitHud(true);
  }

  public toggleMute(): void {
    this.audio.toggleMute();
    this.emitHud(true);
  }

  public setAmbienceVolume(percent: number): void {
    this.audio.unlock();
    if (this.audio.isMuted() && percent > 0) {
      this.audio.setMuted(false);
    }
    this.audio.ambience.setVolume(percent / 100);
    this.emitHud(true);
  }

  public toggleDock(): void {
    this.dockCollapsed = !this.dockCollapsed;
    this.emitHud(true);
  }

  public applyCameraPreset(preset: CameraPreset): void {
    this.cameraPreset = preset;
    this.emitHud(true);
  }

  // ==================== PLAYER MOVEMENT ACTIONS ====================

  private moveLane(deltaLane: -1 | 1): void {
    if (this.phase !== 'playing') return;
    const next = Math.max(-1, Math.min(1, this.targetLane + deltaLane));
    if (next !== this.targetLane) {
      this.targetLane = next;
      this.audio.playLaneSwitch(next);
    }
  }

  private triggerJump(): void {
    if (this.phase !== 'playing') return;
    this.jumpBufferTimer = 0.14;
    this.tryConsumeJump();
  }

  private tryConsumeJump(): void {
    if (this.jumpBufferTimer > 0 && (this.grounded || this.coyoteTimer > 0)) {
      this.grounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.slideTimer = 0;
      this.slideQueued = false;
      this.playerVy = JUMP_VELOCITY;
      this.audio.playJump();
      this.spawnBurst(this.playerX, 0.15, 0, 7, 'dust');
    }
  }

  private triggerSlide(): void {
    if (this.phase !== 'playing') return;
    if (!this.grounded && this.playerY > 0.1) {
      this.playerVy = Math.min(this.playerVy, -23.5);
      this.slideQueued = true;
      this.audio.playLaneSwitch(this.targetLane);
    } else {
      this.slideTimer = 0.82;
      this.audio.playSlide();
      this.spawnBurst(this.playerX, 0.12, -0.2, 6, 'dust');
    }
  }

  // ==================== PROCEDURAL WAVE & COIN SPAWNER ====================

  private acquireObstacle(
    kind: ObstacleKind,
    lane: number,
    z: number
  ): ObstacleInstance | null {
    const pool = this.obstaclePools.get(kind);
    if (!pool) return null;
    for (const inst of pool) {
      if (!inst.active) {
        inst.active = true;
        inst.lane = lane;
        inst.z = z;
        inst.passed = false;
        inst.hitHandled = false;
        inst.trumpeted = false;
        const route = this.sampleRouteAt(z);
        const laneOff = lane * LANE_WIDTH;
        inst.group.position.set(
          route.x + laneOff * Math.cos(route.yaw),
          route.y + laneOff * Math.sin(route.bank),
          z
        );
        inst.group.rotation.set(route.pitch, route.yaw, route.bank);
        inst.group.visible = true;
        this.activeObstacles.push(inst);
        return inst;
      }
    }
    return null;
  }

  private spawnSingleCoin(lane: number, y: number, z: number): void {
    for (let i = 0; i < MAX_COINS; i++) {
      const c = this.coins[i];
      if (!c.active) {
        c.active = true;
        c.lane = lane;
        c.laneOffset = lane * LANE_WIDTH;
        c.localY = y;
        c.baseY = y;
        c.z = z;
        c.magnetized = false;
        const route = this.sampleRouteAt(z);
        c.worldX = route.x + c.laneOffset * Math.cos(route.yaw);
        c.worldY = route.y + y;
        return;
      }
    }
  }

  private spawnCoinLine(
    lane: number,
    zStart: number,
    count: number,
    spacing = 2.3,
    lowSlide = false
  ): void {
    const y = lowSlide ? 0.56 : 0.95;
    for (let i = 0; i < count; i++) {
      this.spawnSingleCoin(lane, y, zStart - i * spacing);
    }
  }

  private spawnCoinJumpArc(lane: number, zCenter: number): void {
    const offsets = [
      { dz: 3.6, y: 0.95 },
      { dz: 1.8, y: 1.82 },
      { dz: 0.0, y: 2.32 },
      { dz: -1.8, y: 1.82 },
      { dz: -3.6, y: 0.95 },
    ];
    for (const o of offsets) {
      this.spawnSingleCoin(lane, o.y, zCenter + o.dz);
    }
  }

  private trySpawnPowerup(lane: number, y: number, z: number): void {
    for (const p of this.powerupPool) {
      if (!p.active && Math.random() < 0.55) {
        p.active = true;
        p.lane = lane;
        p.y = y;
        p.z = z;
        const route = this.sampleRouteAt(z);
        p.group.position.set(
          route.x + lane * LANE_WIDTH * Math.cos(route.yaw),
          route.y + y,
          z
        );
        p.group.visible = true;
        return;
      }
    }
  }

  private spawnNextWave(): void {
    const z = this.nextSpawnZ;
    this.waveCounter++;
    const lanes = [-1, 0, 1];
    for (let i = lanes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = lanes[i];
      lanes[i] = lanes[j];
      lanes[j] = tmp;
    }

    const pattern = this.waveCounter % 7;

    switch (pattern) {
      case 0: {
        this.acquireObstacle(ObstacleKind.JumpHurdle, lanes[0], z);
        this.spawnCoinJumpArc(lanes[0], z);

        this.acquireObstacle(ObstacleKind.SlideArch, lanes[1], z);
        this.spawnCoinLine(lanes[1], z + 3.2, 4, 2.1, true);

        this.acquireObstacle(ObstacleKind.SolidMonolith, lanes[2], z);
        this.nextSpawnZ -= 18.5;
        break;
      }

      case 1: {
        this.acquireObstacle(ObstacleKind.SolidMonolith, lanes[0], z);
        this.acquireObstacle(
          this.waveCounter % 2 === 0
            ? ObstacleKind.WildTusker
            : ObstacleKind.SolidMonolith,
          lanes[1],
          z
        );
        this.spawnCoinLine(lanes[2], z + 4.4, 5, 2.2, false);
        if (this.waveCounter % 3 === 0) {
          this.trySpawnPowerup(lanes[2], 1.15, z - 7.2);
        }
        this.nextSpawnZ -= 17.5;
        break;
      }

      case 2: {
        this.acquireObstacle(ObstacleKind.GorgeGap, lanes[0], z);
        this.spawnCoinJumpArc(lanes[0], z);

        this.acquireObstacle(ObstacleKind.GorgeGap, lanes[1], z);
        this.acquireObstacle(ObstacleKind.JumpHurdle, lanes[2], z);
        this.spawnCoinJumpArc(lanes[2], z);
        this.nextSpawnZ -= 19.5;
        break;
      }

      case 3: {
        this.acquireObstacle(ObstacleKind.SlideArch, lanes[0], z);
        this.spawnCoinLine(lanes[0], z + 3.4, 5, 2.0, true);

        this.acquireObstacle(ObstacleKind.SlideArch, lanes[1], z);
        this.acquireObstacle(ObstacleKind.WildTusker, lanes[2], z);
        this.nextSpawnZ -= 18.0;
        break;
      }

      case 4: {
        this.acquireObstacle(ObstacleKind.SolidMonolith, -1, z);
        this.acquireObstacle(ObstacleKind.JumpHurdle, 1, z);
        this.spawnSingleCoin(0, 0.95, z + 2.2);
        this.spawnSingleCoin(0, 0.95, z);
        this.spawnSingleCoin(-1, 0.95, z - 3.5);
        this.spawnSingleCoin(-1, 0.95, z - 6.0);

        this.acquireObstacle(ObstacleKind.SolidMonolith, 0, z - 7.5);
        this.acquireObstacle(ObstacleKind.SlideArch, 1, z - 7.5);
        this.spawnSingleCoin(-1, 0.95, z - 8.5);
        this.nextSpawnZ -= 23.0;
        break;
      }

      case 5: {
        this.acquireObstacle(ObstacleKind.JumpHurdle, -1, z);
        this.acquireObstacle(ObstacleKind.SlideArch, 0, z);
        this.acquireObstacle(ObstacleKind.JumpHurdle, 1, z);

        this.spawnCoinJumpArc(-1, z);
        this.spawnCoinLine(0, z + 3.0, 4, 2.0, true);
        this.trySpawnPowerup(1, 2.25, z);
        this.nextSpawnZ -= 18.5;
        break;
      }

      default: {
        this.acquireObstacle(ObstacleKind.WildTusker, lanes[0], z);
        this.spawnCoinLine(lanes[1], z + 4.5, 6, 2.1, false);
        this.spawnCoinLine(lanes[2], z + 4.5, 6, 2.1, false);
        this.nextSpawnZ -= 17.5;
        break;
      }
    }

    // Add subtle speed-proportional spacing so higher 100m milestones remain fair
    const speedExtraGap = Math.max(0, (this.currentBaseSpeed - 11.2) * 0.32);
    this.nextSpawnZ -= speedExtraGap;
  }

  // ==================== PARTICLES & COLLISION FEEDBACK ====================

  private spawnBurst(
    x: number,
    y: number,
    z: number,
    count: number,
    kind: 'gold' | 'dust' | 'chrono' | 'splash'
  ): void {
    let spawned = 0;
    const col =
      kind === 'gold'
        ? _goldColor
        : kind === 'chrono'
        ? _chronoColor
        : kind === 'splash'
        ? _splashColor
        : _dustColor;

    for (let i = 0; i < MAX_PARTICLES && spawned < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = x + (Math.random() - 0.5) * 0.35;
        p.y = y + (Math.random() - 0.5) * 0.25;
        p.z = z + (Math.random() - 0.5) * 0.35;
        const ang = Math.random() * Math.PI * 2;
        const spd = (kind !== 'dust' ? 3.5 : 2.2) + Math.random() * 3.2;
        p.vx = Math.cos(ang) * spd;
        p.vy = 2.2 + Math.random() * 4.2;
        p.vz = Math.sin(ang) * spd;
        p.maxLife = kind !== 'dust' ? 0.48 : 0.36;
        p.life = p.maxLife;
        p.scale = kind !== 'dust' ? 1.15 : 0.9;
        this.particleMesh.setColorAt(i, col);
        spawned++;
      }
    }
    if (spawned > 0 && this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  private triggerStumble(obs: ObstacleInstance): void {
    obs.hitHandled = true;
    obs.active = false;
    obs.group.visible = false;

    this.hitstopTimer = 0.055;
    this.cameraShake = 0.62;
    this.spawnBurst(this.playerX, 0.9, -0.4, 14, 'dust');
    this.audio.playStumbleImpact();

    if (this.monsterDangerTimer > 0) {
      this.triggerGameOver(
        'Caught by the Churam Forest Guardian after stumbling on the pass!'
      );
      return;
    }

    this.monsterProximity = 1.0;
    this.monsterDangerTimer = 7.5;
    this.monsterRoarFlash = 1.0;
    this.audio.playMonsterRoar(1.0);
    this.emitHud(true);
  }

  private triggerGameOver(reason: string): void {
    this.phase = 'game_over';
    this.deathReason = reason;
    this.hitstopTimer = 0.075;
    this.cameraShake = 0.95;
    this.chronoTimer = 0;
    this.monsterProximity = 1.0;
    this.monsterCatchAnim = 0.001;
    this.audio.playStumbleImpact();
    this.audio.playMonsterRoar(1.25);

    const finalScore = Math.floor(this.score);
    const finalDist = Math.floor(this.distanceMeters);
    if (finalScore > this.highScore) {
      this.highScore = finalScore;
      writeStoredInt(STORAGE_KEYS.highScore, this.highScore);
    }
    if (finalDist > this.bestDistance) {
      this.bestDistance = finalDist;
      writeStoredInt(STORAGE_KEYS.bestDistance, this.bestDistance);
    }
    this.totalCoinsBank += this.runCoins;
    writeStoredInt(STORAGE_KEYS.coinsBank, this.totalCoinsBank);

    this.emitHud(true);
  }

  // ==================== MAIN SIMULATION & RENDER LOOP ====================

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = window.requestAnimationFrame(this.tick);
    }
  }

  private readonly tick = (): void => {
    if (this.disposed) return;
    const nowMs = performance.now();
    const rawDt = Math.min(
      0.05,
      Math.max(0.001, (nowMs - this.lastTimeMs) / 1000)
    );
    this.lastTimeMs = nowMs;

    this.updateSimulation(rawDt, nowMs * 0.001);
    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  };

  /**
   * Updates the 4th-Dimension Time-of-Day Cycle (Dawn -> Mist -> Dusk -> Storm Night),
   * Monsoon Crosswind Gusts, Atmospheric Sky Dome, Lightning, and Foliage Shaders.
   */
  private update4dEnvironment(dt: number, elapsedSec: number): boolean {
    if (this.phase === 'playing') {
      this.dayCyclePhase = (this.dayCyclePhase + dt * 0.014) % 1.0;
    }

    // Compute smooth nightFactor (0 = bright day, 1 = deep storm night)
    const p = this.dayCyclePhase;
    let nightFactor = 0;
    if (p < 0.22) {
      // Golden Ghat Dawn
      _zenithTarget.setHex(0x1f4959);
      _horizonTarget.setHex(0xc98b63);
      _sunColorTarget.setHex(0xffc982);
      nightFactor = 0.25;
    } else if (p < 0.52) {
      // Highland Mist Noon
      _zenithTarget.setHex(0x265966);
      _horizonTarget.setHex(this.currentZone.skyHex);
      _sunColorTarget.setHex(0xfff0cc);
      nightFactor = 0.0;
    } else if (p < 0.76) {
      // Amber Monsoon Dusk
      _zenithTarget.setHex(0x1f2b45);
      _horizonTarget.setHex(0x915348);
      _sunColorTarget.setHex(0xff9248);
      nightFactor = 0.62;
    } else {
      // 4D Monsoon Storm Night
      _zenithTarget.setHex(0x0d1824);
      _horizonTarget.setHex(0x1b2d3b);
      _sunColorTarget.setHex(0x8cb8de);
      nightFactor = 1.0;
    }

    // 4D Chrono-Shift tints the sky with an ethereal temporal cyan-gold aura!
    if (this.chronoTimer > 0) {
      _zenithTarget.lerp(_chronoColor, 0.35);
    }

    const skyLerp = 1 - Math.exp(-1.8 * dt);
    this.skyDome.uniforms.uZenithColor.value.lerp(_zenithTarget, skyLerp);
    this.skyDome.uniforms.uHorizonColor.value.lerp(_horizonTarget, skyLerp);
    this.skyDome.uniforms.uSunColor.value.lerp(_sunColorTarget, skyLerp);

    // Orbit sun/moon arc across the Western Ghats sky & track player shadow frustum
    const sunAngle = p * Math.PI * 2;
    this.skyDome.uniforms.uSunDir.value
      .set(Math.cos(sunAngle) * 0.55, 0.24 + Math.sin(sunAngle) * 0.22, -0.82)
      .normalize();
    this.sunLight.target.position.set(this.playerX * 0.5, 0, -5);
    this.sunLight.position.set(
      this.playerX * 0.5 + Math.cos(sunAngle) * 18,
      18 + Math.max(0, Math.sin(sunAngle)) * 14,
      10
    );

    // 4D Monsoon Crosswind Gusts & Storm Lightning
    const rainZone =
      this.currentZone.landmark === LandmarkType.SoochiparaFalls ||
      this.currentZone.landmark === LandmarkType.BanasuraDam ||
      p >= 0.72;

    const targetWind =
      (Math.sin(elapsedSec * 0.55) * 0.65 + Math.cos(elapsedSec * 1.2) * 0.35) *
      (rainZone ? 1.0 : 0.45);
    this.windCrossForce = THREE.MathUtils.damp(
      this.windCrossForce,
      targetWind,
      2.0,
      dt
    );

    if (rainZone && this.fx4dEnabled && this.phase === 'playing') {
      this.nextLightningTimer -= dt;
      if (this.nextLightningTimer <= 0) {
        this.lightningFlash = 1.0;
        this.nextLightningTimer = 6.5 + Math.random() * 8.5;
        this.audio.playThunderclap((Math.random() - 0.5) * 1.4);
        this.cameraShake = Math.max(this.cameraShake, 0.2);
      }
    }
    if (this.lightningFlash > 0) {
      this.lightningFlash = Math.max(0, this.lightningFlash - dt * 3.4);
    }
    this.skyDome.uniforms.uLightning.value = this.lightningFlash;

    // Modulate sun, fog, streetlamps & runner brass hip-lantern!
    const baseSunInt = THREE.MathUtils.lerp(2.25, 0.55, nightFactor);
    this.sunLight.intensity = baseSunInt + this.lightningFlash * 3.2;
    this.sunLight.color.copy(this.skyDome.uniforms.uSunColor.value);
    this.hemiLight.intensity = THREE.MathUtils.lerp(1.08, 0.42, nightFactor);

    this.fog.color.copy(this.skyDome.uniforms.uHorizonColor.value);
    this.fog.density = THREE.MathUtils.damp(
      this.fog.density,
      this.currentZone.fogDensity,
      2.2,
      dt
    );

    this.runner.hipLanternLight.intensity = THREE.MathUtils.lerp(
      0.15,
      2.4,
      nightFactor
    );

    this.lensWetness = THREE.MathUtils.damp(
      this.lensWetness,
      rainZone && this.fx4dEnabled ? 0.85 : 0.12,
      1.8,
      dt
    );

    this.mats.updateWindAndNight(
      elapsedSec,
      0.35 + Math.abs(this.windCrossForce) * 1.15,
      nightFactor
    );

    return rainZone;
  }

  private updateSimulation(dt: number, elapsedSec: number): void {
    const rainActive = this.update4dEnvironment(dt, elapsedSec);

    this.audio.ambience.update(dt, {
      landmark: this.currentZone.landmark,
      pausedOrModal: this.phase === 'paused' || this.phase === 'game_over',
      hazardActive: this.monsterDangerTimer > 0,
      solarAligned: this.boostTimer > 0 || this.chronoTimer > 0,
      waterAligned: rainActive,
      convoyRunning: this.phase === 'playing',
    });

    if (this.phase === 'paused') return;

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateCamera(dt, elapsedSec);
      return;
    }

    if (this.phase === 'title') {
      const idleSpeed = 8.2;
      this.scrollTrackAndScenery(idleSpeed * dt, elapsedSec);
      this.runCyclePhase += dt * 7.8;
      this.monsterStridePhase += dt * 6.4;
      this.animateRunner(dt, true);
      this.animateMonster(dt, elapsedSec);
      this.updateCoinsAndParticles(dt, 0, elapsedSec);
      this.updateRain(dt, rainActive, idleSpeed);
      this.updateEnvironmentFx(dt, elapsedSec, 0, false);
      this.updateCamera(dt, elapsedSec);
      return;
    }

    if (this.phase === 'game_over') {
      this.monsterCatchAnim = Math.min(1, this.monsterCatchAnim + dt * 3.2);
      this.animateMonster(dt, elapsedSec);
      this.updateCoinsAndParticles(dt, 0, elapsedSec);
      this.updateCamera(dt, elapsedSec);
      return;
    }

    // ==================== ACTIVE 4D PLAYING LOOP ====================
    // Handle 4D Chrono-Shift Time Dilation!
    if (this.chronoTimer > 0) {
      this.chronoTimer = Math.max(0, this.chronoTimer - dt);
      if (this.chronoTimer <= 0) {
        this.audio.playChronoShift(false);
      }
    }
    const worldTimeScale = this.chronoTimer > 0 ? 0.44 : 1.0;
    const worldDt = dt * worldTimeScale;

    // Evolve real-life winding NH-766 hairpin curvature & mountain grade!
    const desiredCurve =
      Math.sin(this.distanceMeters * 0.015) * 0.0028 +
      Math.cos(this.distanceMeters * 0.006) * 0.0012;
    const desiredGrade = Math.sin(this.distanceMeters * 0.012 + 0.9) * 0.001;
    this.activeRouteCurve = THREE.MathUtils.damp(
      this.activeRouteCurve,
      desiredCurve,
      1.4,
      worldDt
    );
    this.activeRouteGrade = THREE.MathUtils.damp(
      this.activeRouteGrade,
      desiredGrade,
      1.4,
      worldDt
    );

    // Gradual Every-100m Speed Progression:
    // Target speed steps up gently (+0.38) only when reaching each 100m milestone,
    // and currentBaseSpeed ramps smoothly toward it via exponential damping.
    const startBaseSpeed = WAYANAD_ZONES[this.startZoneOffset].baseSpeed;
    const prevSteps = Math.floor(this.distanceMeters / 100);
    const preTargetSpeed = Math.min(
      MAX_BASE_RUN_SPEED,
      startBaseSpeed + prevSteps * SPEED_STEP_PER_100M
    );
    this.currentBaseSpeed = THREE.MathUtils.damp(
      this.currentBaseSpeed,
      preTargetSpeed,
      1.2,
      worldDt
    );

    const boostMult = this.boostTimer > 0 ? 1.28 : 1.0;
    const baseRunSpeed = this.currentBaseSpeed * boostMult;
    const frameMoveZ = baseRunSpeed * worldDt;

    this.distanceMeters += frameMoveZ * 0.46;

    const hundredMeterSteps = Math.floor(this.distanceMeters / 100);
    if (hundredMeterSteps > this.lastSpeedMilestoneStep) {
      this.lastSpeedMilestoneStep = hundredMeterSteps;
      this.milestoneBannerMeters = hundredMeterSteps * 100;
      this.milestoneBannerTimer = 2.2;
      this.audio.playSpeedMilestone();
      this.emitHud(false);
    }
    if (this.milestoneBannerTimer > 0) {
      this.milestoneBannerTimer = Math.max(0, this.milestoneBannerTimer - dt);
    }

    const nextZone = getZoneForDistance(
      this.distanceMeters,
      this.startZoneOffset
    );
    if (nextZone.index !== this.currentZone.index) {
      this.currentZone = nextZone;
    }
    this.multiplier =
      (1 + Math.min(4, Math.floor(this.distanceMeters / 260))) *
      (this.chronoTimer > 0 ? 2 : 1);
    this.score += frameMoveZ * 0.95 * this.multiplier;

    // Passive 4D Chrono recharge over distance + coins
    if (this.chronoTimer <= 0 && this.chronoCharge < 100) {
      this.chronoCharge = Math.min(100, this.chronoCharge + dt * 2.6);
    }

    // Timers (Runner stays at full 1.0x agility even while world is dilated!)
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= dt;
    if (this.coyoteTimer > 0) this.coyoteTimer -= dt;
    if (this.slideTimer > 0) this.slideTimer = Math.max(0, this.slideTimer - dt);
    if (this.coinChainTimer > 0) {
      this.coinChainTimer -= dt;
      if (this.coinChainTimer <= 0) this.coinChainCount = 0;
    }
    if (this.magnetTimer > 0) {
      this.magnetTimer = Math.max(0, this.magnetTimer - dt);
    }
    if (this.boostTimer > 0) {
      this.boostTimer = Math.max(0, this.boostTimer - dt);
    }

    // Horizontal Lane Kinematics
    const desiredX = this.targetLane * LANE_WIDTH;
    this.playerX = THREE.MathUtils.damp(this.playerX, desiredX, 16.0, dt);

    // Vertical Jump & Gravity Kinematics
    this.tryConsumeJump();
    if (!this.grounded) {
      this.playerY += this.playerVy * dt;
      this.playerVy -= GRAVITY * dt;
      if (this.playerY <= 0) {
        this.playerY = 0;
        this.playerVy = 0;
        this.grounded = true;
        this.landSquash = 1.0;
        if (this.slideQueued) {
          this.slideQueued = false;
          this.slideTimer = 0.74;
          this.audio.playSlide();
        }
        this.spawnBurst(
          this.playerX,
          0.08,
          0,
          6,
          rainActive ? 'splash' : 'dust'
        );
      }
    } else {
      this.coyoteTimer = 0.09;
    }

    this.runner.root.position.set(this.playerX, this.playerY, 0);
    this.runCyclePhase += dt * (baseRunSpeed * 0.72);

    // Subtle wet-tarmac water splash / dust kick on runner footstrike
    const rStep = Math.sin(this.runCyclePhase) >= 0 ? 1 : -1;
    if (rStep !== this.prevRunnerStepSign) {
      this.prevRunnerStepSign = rStep;
      if (this.grounded && this.slideTimer <= 0) {
        this.spawnBurst(
          this.playerX + rStep * 0.14,
          0.05,
          0.18,
          2,
          rainActive ? 'splash' : 'dust'
        );
      }
    }

    this.animateRunner(dt, false);
    this.update4dChronoEchoes(dt);

    // Chasing Monster Proximity & Spatial Footsteps
    if (this.boostTimer > 0 || this.chronoTimer > 0) {
      this.monsterDangerTimer = Math.max(0, this.monsterDangerTimer - dt * 1.9);
    } else if (this.monsterDangerTimer > 0) {
      this.monsterDangerTimer = Math.max(0, this.monsterDangerTimer - dt);
    }

    const targetMonsterProx =
      this.chronoTimer > 0
        ? 0.14
        : this.monsterDangerTimer > 0
        ? 0.96
        : 0.24;
    this.monsterProximity = THREE.MathUtils.damp(
      this.monsterProximity,
      targetMonsterProx,
      this.monsterDangerTimer > 0 ? 5.5 : 1.8,
      dt
    );
    this.monsterX = THREE.MathUtils.damp(
      this.monsterX,
      this.playerX,
      6.2,
      worldDt
    );
    this.monsterStridePhase += worldDt * (baseRunSpeed * 0.52);

    const stepSign = Math.sin(this.monsterStridePhase) >= 0 ? 1 : -1;
    if (stepSign !== this.prevMonsterStepSign) {
      this.prevMonsterStepSign = stepSign;
      if (this.monsterProximity >= 0.48) {
        this.audio.playMonsterFootstep(
          this.monsterProximity,
          this.monsterX / (LANE_WIDTH * 1.2)
        );
        if (this.monsterProximity > 0.82 && this.fx4dEnabled) {
          this.cameraShake = Math.max(this.cameraShake, 0.12);
        }
      }
    }
    this.animateMonster(dt, elapsedSec);

    // Scroll Winding Highway, Spawn Waves & Update Entities
    this.scrollTrackAndScenery(frameMoveZ, elapsedSec);
    this.nextSpawnZ += frameMoveZ;
    while (this.nextSpawnZ > -148) {
      this.spawnNextWave();
    }

    this.updateObstaclesAndCollisions(frameMoveZ, elapsedSec);
    this.updatePowerups(frameMoveZ, elapsedSec);
    this.updateCoinsAndParticles(dt, frameMoveZ, elapsedSec);
    this.updateRain(dt, rainActive, baseRunSpeed * worldTimeScale);
    this.updateEnvironmentFx(
      dt,
      elapsedSec,
      baseRunSpeed,
      this.boostTimer > 0 || this.chronoTimer > 0 || baseRunSpeed > 15.5
    );
    this.updateCamera(dt, elapsedSec);

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.065) {
      this.hudEmitAccum = 0;
      this.emitHud(false);
    }
  }

  private update4dChronoEchoes(dt: number): void {
    this.echoRecordAccum += dt;
    if (this.echoRecordAccum >= 0.045) {
      this.echoRecordAccum = 0;
      this.echoHistory.unshift({
        x: this.playerX,
        y: this.playerY + (this.slideTimer > 0 ? -0.45 : 0),
        rotZ: this.runner.bodyPivot.rotation.z,
      });
      if (this.echoHistory.length > 12) {
        this.echoHistory.pop();
      }
    }

    const showEchoes = this.chronoTimer > 0;
    for (let i = 0; i < this.runner.chronoEchoes.length; i++) {
      const echo = this.runner.chronoEchoes[i];
      const histIdx = (i + 1) * 3;
      if (showEchoes && this.echoHistory[histIdx]) {
        const snap = this.echoHistory[histIdx];
        echo.visible = true;
        echo.position.set(snap.x, snap.y, (i + 1) * 0.85);
        echo.rotation.z = snap.rotZ;
        echo.scale.setScalar(1.0 - i * 0.12);
      } else {
        echo.visible = false;
      }
    }
  }

  private updateTrackChunkTransforms(elapsedSec: number): void {
    for (const chunk of this.chunks) {
      const route = this.sampleRouteAt(chunk.zCenter);
      chunk.group.position.set(route.x, route.y, chunk.zCenter);
      chunk.group.rotation.set(route.pitch, route.yaw, route.bank);

      // Drift 4D mountain mist ribbons across the road in the crosswind!
      if (chunk.mistPlane.visible) {
        chunk.mistPlane.position.x =
          Math.sin(elapsedSec * 0.6 + chunk.mistPhase) * 3.8 +
          this.windCrossForce * 2.2;
      }
    }
  }

  private scrollTrackAndScenery(moveZ: number, elapsedSec: number): void {
    this.mats.textures.waterFlowAlbedo.offset.y -= moveZ * 0.08;

    const totalSpan = TRACK_CHUNK_COUNT * CHUNK_LENGTH;
    for (const chunk of this.chunks) {
      chunk.zCenter += moveZ;
      if (chunk.zCenter > 26) {
        chunk.zCenter -= totalSpan;
        const lm = this.currentZone.landmark;
        chunk.waterfallRibbon.visible =
          lm === LandmarkType.SoochiparaFalls ||
          lm === LandmarkType.BanasuraDam ||
          Math.random() < 0.25;
        chunk.edakkalSpire.visible =
          lm === LandmarkType.EdakkalCaves || Math.random() < 0.3;
        if (chunk.highwaySignMesh) {
          chunk.highwaySignMesh.material =
            this.mats.highwaySignMats[
              this.currentZone.index % this.mats.highwaySignMats.length
            ];
        }
      }
    }
    this.updateTrackChunkTransforms(elapsedSec);
  }

  private updateObstaclesAndCollisions(
    moveZ: number,
    elapsedSec: number
  ): void {
    const isSliding = this.slideTimer > 0;

    for (let i = this.activeObstacles.length - 1; i >= 0; i--) {
      const obs = this.activeObstacles[i];
      obs.z += moveZ;

      const route = this.sampleRouteAt(obs.z);
      const laneOff = obs.lane * LANE_WIDTH;
      obs.group.position.set(
        route.x + laneOff * Math.cos(route.yaw),
        route.y + laneOff * Math.sin(route.bank),
        obs.z
      );
      obs.group.rotation.set(route.pitch, route.yaw, route.bank);

      if (obs.kind === ObstacleKind.WildTusker && obs.animPivot) {
        const approach = obs.z > -28 && obs.z < 2;
        obs.animPivot.rotation.x = approach
          ? -0.24 + Math.sin(elapsedSec * 8.5) * 0.1
          : Math.sin(elapsedSec * 2.8) * 0.05;
        obs.animPivot.rotation.y = Math.sin(elapsedSec * 2.4 + obs.lane) * 0.08;
        if (obs.secondaryPivot) {
          obs.secondaryPivot.rotation.x = approach
            ? -0.75 + Math.sin(elapsedSec * 10) * 0.18
            : Math.sin(elapsedSec * 3.2) * 0.12;
        }
        if (obs.z > -22 && !obs.trumpeted) {
          obs.trumpeted = true;
          if (Math.random() < 0.5) {
            this.audio.playTuskerTrumpet(obs.lane);
          }
        }
      } else if (obs.kind === ObstacleKind.SlideArch && obs.animPivot) {
        obs.animPivot.rotation.z =
          Math.sin(elapsedSec * 3.5 + obs.lane) * 0.12 +
          this.windCrossForce * 0.18;
      }

      if (obs.z > 14) {
        obs.active = false;
        obs.group.visible = false;
        this.activeObstacles.splice(i, 1);
        continue;
      }

      if (obs.hitHandled || this.phase !== 'playing') continue;

      const laneCenterX = obs.lane * LANE_WIDTH;
      const dx = Math.abs(this.playerX - laneCenterX);
      const zHalfDepth = obs.kind === ObstacleKind.GorgeGap ? 1.35 : 0.72;

      if (Math.abs(obs.z) < zHalfDepth && dx < 0.84) {
        if (this.boostTimer > 0) {
          if (obs.kind !== ObstacleKind.GorgeGap) {
            obs.hitHandled = true;
            obs.active = false;
            obs.group.visible = false;
            this.score += 50 * this.multiplier;
            this.cameraShake = 0.28;
            this.spawnBurst(laneCenterX, 1.1, obs.z, 14, 'gold');
            this.audio.playStumbleImpact();
          }
          continue;
        }

        switch (obs.kind) {
          case ObstacleKind.JumpHurdle: {
            if (this.playerY < 0.92) {
              this.triggerStumble(obs);
            }
            break;
          }

          case ObstacleKind.SlideArch: {
            if (!isSliding || this.playerY > 0.55) {
              this.triggerStumble(obs);
            }
            break;
          }

          case ObstacleKind.GorgeGap: {
            if (this.playerY < 0.24) {
              obs.hitHandled = true;
              this.triggerGameOver(
                'Plunged into the flooded monsoon culvert chasm!'
              );
              return;
            }
            break;
          }

          case ObstacleKind.SolidMonolith:
          case ObstacleKind.WildTusker: {
            if (dx > 0.46) {
              this.triggerStumble(obs);
            } else {
              obs.hitHandled = true;
              this.triggerGameOver(
                obs.kind === ObstacleKind.WildTusker
                  ? 'Collided with a Wayanad Wild Tusker on the ghat road!'
                  : 'Crashed into a monsoon ghat rockslide boulder!'
              );
              return;
            }
            break;
          }
        }
      }
    }
  }

  private updatePowerups(moveZ: number, elapsedSec: number): void {
    for (const p of this.powerupPool) {
      if (!p.active) continue;
      p.z += moveZ;
      const route = this.sampleRouteAt(p.z);
      const laneOff = p.lane * LANE_WIDTH;
      p.group.position.set(
        route.x + laneOff * Math.cos(route.yaw),
        route.y + p.y + Math.sin(elapsedSec * 4.5) * 0.14,
        p.z
      );
      p.spinner.rotation.y = elapsedSec * 2.8;
      p.spinner.rotation.z = Math.sin(elapsedSec * 2.2) * 0.2;

      if (p.z > 12) {
        p.active = false;
        p.group.visible = false;
        continue;
      }

      const dx = Math.abs(this.playerX - laneOff);
      const dy = Math.abs(this.playerY + 0.9 - p.y);
      if (Math.abs(p.z) < 1.05 && dx < 0.95 && dy < 1.35) {
        p.active = false;
        p.group.visible = false;
        this.audio.playPowerup();
        this.spawnBurst(this.playerX, p.y, 0, 16, 'gold');
        this.score += 100 * this.multiplier;

        if (p.kind === PowerupKind.CoinMagnet) {
          this.magnetTimer = 8.5;
        } else if (p.kind === PowerupKind.SpiceBoost) {
          this.boostTimer = 5.5;
        }
        this.emitHud(true);
      }
    }
  }

  private updateCoinsAndParticles(
    dt: number,
    moveZ: number,
    elapsedSec: number
  ): void {
    const magnetActive = this.magnetTimer > 0 && this.phase === 'playing';

    for (let i = 0; i < MAX_COINS; i++) {
      const c = this.coins[i];
      if (!c.active) {
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.coinMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      c.z += moveZ;

      if (magnetActive && c.z > -18 && c.z < 3.5) {
        c.magnetized = true;
      }

      if (c.magnetized && this.phase === 'playing') {
        const pull = 1 - Math.exp(-14.0 * dt);
        c.worldX = THREE.MathUtils.lerp(c.worldX, this.playerX, pull);
        c.worldY = THREE.MathUtils.lerp(
          c.worldY,
          this.playerY + 0.95,
          pull
        );
        c.z = THREE.MathUtils.lerp(c.z, 0, pull * 0.65);
      } else {
        const route = this.sampleRouteAt(c.z);
        c.localY = c.baseY + Math.sin(elapsedSec * 4.2 + c.phase) * 0.08;
        c.worldX = route.x + c.laneOffset * Math.cos(route.yaw);
        c.worldY =
          route.y + c.localY + c.laneOffset * Math.sin(route.bank);
      }

      if (c.z > 10) {
        c.active = false;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.coinMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      if (this.phase === 'playing') {
        const dx = Math.abs(c.worldX - this.playerX);
        const runnerCenterY =
          this.playerY + (this.slideTimer > 0 ? 0.5 : 0.95);
        const dy = Math.abs(c.worldY - runnerCenterY);
        if (Math.abs(c.z) < 0.96 && dx < 0.94 && dy < 1.18) {
          c.active = false;
          this.runCoins += 1;
          this.score += 25 * this.multiplier;
          if (this.chronoTimer <= 0) {
            this.chronoCharge = Math.min(100, this.chronoCharge + 4.5);
          }
          this.audio.playCoinCollect(this.coinChainCount, c.lane);
          this.coinChainCount = Math.min(7, this.coinChainCount + 1);
          this.coinChainTimer = 0.75;
          this.spawnBurst(c.worldX, c.worldY, 0, 6, 'gold');

          _dummy.position.set(0, -50, 0);
          _dummy.scale.setScalar(0.001);
          _dummy.updateMatrix();
          this.coinMesh.setMatrixAt(i, _dummy.matrix);
          continue;
        }
      }

      _dummy.position.set(c.worldX, c.worldY, c.z);
      _dummy.rotation.set(0, elapsedSec * 3.6 + c.phase, 0);
      _dummy.scale.setScalar(1.0);
      _dummy.updateMatrix();
      this.coinMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.coinMesh.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += (p.vz + moveZ * 0.4) * dt;
      p.vy -= 14.0 * dt;

      const t = p.life / p.maxLife;
      _dummy.position.set(p.x, Math.max(0.04, p.y), p.z);
      _dummy.rotation.set(p.life * 6, p.life * 4, 0);
      _dummy.scale.setScalar(p.scale * t);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
  }

  private updateRain(dt: number, active: boolean, speed: number): void {
    this.rainMesh.visible = active;
    if (!active) return;

    const slantZ = this.windCrossForce * -0.35;
    for (let i = 0; i < MAX_RAIN; i++) {
      const r = this.rainDrops[i];
      r.y -= r.speed * dt;
      r.x += this.windCrossForce * 6.5 * dt;
      r.z += speed * 0.6 * dt;
      if (r.y < 0) {
        r.y = 13 + Math.random() * 4;
        r.x = this.playerX + (Math.random() - 0.5) * 24;
        r.z = 9 - Math.random() * 54;
      }
      if (r.z > 11) {
        r.z -= 54;
      }
      _dummy.position.set(r.x, r.y, r.z);
      _dummy.rotation.set(0.28, 0, slantZ);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      this.rainMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.rainMesh.instanceMatrix.needsUpdate = true;
  }

  private updateEnvironmentFx(
    dt: number,
    elapsedSec: number,
    runSpeed: number,
    showSpeedStreaks: boolean
  ): void {
    // 1. Animate gliding tropical Malabar birds across the highland sky
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      b.baseZ += (b.speed + runSpeed * 0.35) * dt;
      if (b.baseZ > 16) {
        b.baseZ = -135 - Math.random() * 35;
        b.baseX = (Math.random() - 0.5) * 38;
      }
      const flap = Math.sin(elapsedSec * 7.5 + b.phase) * 0.48;
      b.leftWing.rotation.z = flap;
      b.rightWing.rotation.z = -flap;
      b.group.position.set(
        b.baseX + Math.sin(elapsedSec * 0.8 + b.phase) * 3.5,
        b.baseY + Math.cos(elapsedSec * 1.4 + b.phase) * 0.65,
        b.baseZ
      );
      b.group.rotation.z = Math.cos(elapsedSec * 0.8 + b.phase) * -0.18;
    }

    // 2. High-Speed Peripheral Velocity Lines (Boost / Fast Sprint / 4D Shift)
    this.speedLineMesh.visible = showSpeedStreaks;
    if (!showSpeedStreaks) return;

    this.speedLineMat.opacity =
      this.boostTimer > 0 ? 0.36 : this.chronoTimer > 0 ? 0.28 : 0.16;

    for (let i = 0; i < MAX_SPEED_LINES; i++) {
      const sl = this.speedLines[i];
      sl.z += (sl.speed + runSpeed * 1.1) * dt;
      if (sl.z > 9) {
        const side = i % 2 === 0 ? -1 : 1;
        sl.z = -38 - Math.random() * 18;
        sl.x = this.playerX + side * (3.6 + Math.random() * 3.4);
        sl.y = 0.7 + Math.random() * 4.2;
      }
      _dummy.position.set(sl.x, sl.y, sl.z);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      this.speedLineMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.speedLineMesh.instanceMatrix.needsUpdate = true;
  }

  // ==================== AAA MULTI-JOINT CHARACTER & TEMPLE RUN CHASE CAMERA ====================

  private animateRunner(dt: number, isTitle: boolean): void {
    const laneVel = this.targetLane * LANE_WIDTH - this.playerX;
    const isSliding = !isTitle && this.slideTimer > 0 && this.grounded;
    const s = Math.sin(this.runCyclePhase);
    const c = Math.cos(this.runCyclePhase);

    if (this.landSquash > 0) {
      this.landSquash = Math.max(0, this.landSquash - dt * 6.5);
    }

    this.runner.contactShadow.position.y = -this.playerY + 0.02;
    const shadowScale = Math.max(0.42, 1.0 - this.playerY * 0.22);
    this.runner.contactShadow.scale.setScalar(shadowScale);

    this.runner.magnetHalo.visible = this.magnetTimer > 0;
    this.runner.magnetHalo.rotation.z += dt * 3.5;
    this.runner.boostHalo.visible = this.boostTimer > 0 || this.chronoTimer > 0;
    this.runner.boostHalo.rotation.z -= dt * 5.0;

    if (isSliding) {
      // Subway Surfers / Temple Run Parkour Baseball Power-Slide!
      this.runner.bodyPivot.position.y = THREE.MathUtils.damp(
        this.runner.bodyPivot.position.y,
        -0.52,
        20,
        dt
      );
      this.runner.bodyPivot.rotation.x = THREE.MathUtils.damp(
        this.runner.bodyPivot.rotation.x,
        1.06,
        20,
        dt
      );
      this.runner.torsoPivot.rotation.x = THREE.MathUtils.damp(
        this.runner.torsoPivot.rotation.x,
        0.08,
        18,
        dt
      );
      this.runner.torsoPivot.rotation.y = THREE.MathUtils.damp(
        this.runner.torsoPivot.rotation.y,
        0.38,
        16,
        dt
      );

      // Right leg extended straight forward, left leg tucked tight underneath
      this.runner.rightLegPivot.rotation.x = THREE.MathUtils.damp(
        this.runner.rightLegPivot.rotation.x,
        0.24,
        18,
        dt
      );
      this.runner.rightKneePivot.rotation.x = THREE.MathUtils.damp(
        this.runner.rightKneePivot.rotation.x,
        -0.12,
        18,
        dt
      );
      this.runner.rightAnklePivot.rotation.x = 0.32;

      this.runner.leftLegPivot.rotation.x = THREE.MathUtils.damp(
        this.runner.leftLegPivot.rotation.x,
        -0.28,
        18,
        dt
      );
      this.runner.leftKneePivot.rotation.x = THREE.MathUtils.damp(
        this.runner.leftKneePivot.rotation.x,
        -1.58,
        18,
        dt
      );
      this.runner.leftAnklePivot.rotation.x = -0.25;

      // Dynamic counterbalance arms during slide
      this.runner.leftArmPivot.rotation.x = -0.82;
      this.runner.leftElbowPivot.rotation.x = 0.45;
      this.runner.rightArmPivot.rotation.x = 0.58;
      this.runner.rightElbowPivot.rotation.x = 0.65;
    } else if (!this.grounded && !isTitle) {
      // Athletic Parkour Vault / Mid-Air Jump Pose (Ascent Tuck -> Apex -> Landing Reach)
      const airT = THREE.MathUtils.clamp(this.playerVy / JUMP_VELOCITY, -1, 1);
      const upWeight = Math.max(0, airT);

      this.runner.bodyPivot.position.y = THREE.MathUtils.damp(
        this.runner.bodyPivot.position.y,
        0.08,
        16,
        dt
      );
      this.runner.bodyPivot.rotation.x = THREE.MathUtils.damp(
        this.runner.bodyPivot.rotation.x,
        -0.12 + airT * -0.1,
        14,
        dt
      );
      this.runner.torsoPivot.rotation.x = THREE.MathUtils.damp(
        this.runner.torsoPivot.rotation.x,
        -0.1,
        14,
        dt
      );
      this.runner.torsoPivot.rotation.y = THREE.MathUtils.damp(
        this.runner.torsoPivot.rotation.y,
        -laneVel * 0.2,
        14,
        dt
      );

      // Lead knee tucked high on ascent, extending toward ground on descent
      this.runner.leftLegPivot.rotation.x = THREE.MathUtils.damp(
        this.runner.leftLegPivot.rotation.x,
        0.38 + upWeight * 0.68,
        16,
        dt
      );
      this.runner.leftKneePivot.rotation.x = THREE.MathUtils.damp(
        this.runner.leftKneePivot.rotation.x,
        -0.45 - upWeight * 1.05,
        16,
        dt
      );
      this.runner.leftAnklePivot.rotation.x = 0.22;

      this.runner.rightLegPivot.rotation.x = THREE.MathUtils.damp(
        this.runner.rightLegPivot.rotation.x,
        -0.52 + (1 - upWeight) * 0.25,
        16,
        dt
      );
      this.runner.rightKneePivot.rotation.x = THREE.MathUtils.damp(
        this.runner.rightKneePivot.rotation.x,
        -0.75 - upWeight * 0.35,
        16,
        dt
      );
      this.runner.rightAnklePivot.rotation.x = -0.28;

      // Sweeping parkour balance arms
      this.runner.leftArmPivot.rotation.x = THREE.MathUtils.damp(
        this.runner.leftArmPivot.rotation.x,
        0.78 + upWeight * 0.35,
        14,
        dt
      );
      this.runner.leftElbowPivot.rotation.x = 0.88;
      this.runner.rightArmPivot.rotation.x = THREE.MathUtils.damp(
        this.runner.rightArmPivot.rotation.x,
        -0.42 + upWeight * 0.65,
        14,
        dt
      );
      this.runner.rightElbowPivot.rotation.x = 0.92;
    } else {
      // Biomechanical Multi-Joint Sprint Stride + Landing Squash Recovery!
      const bob = Math.abs(c) * 0.115 - this.landSquash * 0.14;
      this.runner.bodyPivot.position.y = THREE.MathUtils.damp(
        this.runner.bodyPivot.position.y,
        bob,
        22,
        dt
      );
      this.runner.bodyPivot.rotation.x = THREE.MathUtils.damp(
        this.runner.bodyPivot.rotation.x,
        -0.1,
        16,
        dt
      );

      // Upper spine forward sprint lean + counter-rotation opposite to pelvis!
      this.runner.torsoPivot.rotation.x = THREE.MathUtils.damp(
        this.runner.torsoPivot.rotation.x,
        -0.11 - this.landSquash * 0.14,
        16,
        dt
      );
      this.runner.torsoPivot.rotation.y = THREE.MathUtils.damp(
        this.runner.torsoPivot.rotation.y,
        -s * 0.24 - laneVel * 0.22,
        16,
        dt
      );

      // Asymmetric Hip + Deep Recovery Knee Flexion + Ankle Push-Off
      const squashKnee = this.landSquash * 0.42;
      this.runner.leftLegPivot.rotation.x = s * 0.96 - 0.06;
      this.runner.leftKneePivot.rotation.x =
        -0.14 - Math.max(0, c) * 1.28 - squashKnee;
      this.runner.leftAnklePivot.rotation.x =
        Math.sin(this.runCyclePhase + 0.6) * 0.34;

      this.runner.rightLegPivot.rotation.x = -s * 0.96 - 0.06;
      this.runner.rightKneePivot.rotation.x =
        -0.14 - Math.max(0, -c) * 1.28 - squashKnee;
      this.runner.rightAnklePivot.rotation.x =
        -Math.sin(this.runCyclePhase + 0.6) * 0.34;

      // Dynamic 2-Joint Arm Pump (Elbow tightens on upswing, opens on backswing)
      this.runner.leftArmPivot.rotation.x = -s * 0.88;
      this.runner.leftElbowPivot.rotation.x = 0.72 + Math.max(0, -s) * 0.68;

      this.runner.rightArmPivot.rotation.x = s * 0.88;
      this.runner.rightElbowPivot.rotation.x = 0.72 + Math.max(0, s) * 0.68;
    }

    // Snappy Subway Surfers Lane-Switch Bank, Head Lead & Rucksack Secondary Motion
    this.runner.bodyPivot.rotation.z = THREE.MathUtils.damp(
      this.runner.bodyPivot.rotation.z,
      -laneVel * 0.16 - this.activeRouteCurve * 24.0,
      15,
      dt
    );
    this.runner.headGroup.rotation.y = THREE.MathUtils.damp(
      this.runner.headGroup.rotation.y,
      -laneVel * 0.24,
      14,
      dt
    );
    this.runner.packGroup.rotation.x = Math.abs(s) * 0.08;
    this.runner.packGroup.rotation.z = laneVel * 0.08;

    this.runner.bandanaTailLeft.rotation.x =
      -0.28 + Math.sin(this.runCyclePhase * 1.7) * 0.26;
    this.runner.bandanaTailRight.rotation.x =
      -0.34 + Math.cos(this.runCyclePhase * 1.7) * 0.26;
    this.runner.bandanaTailLeft.rotation.y =
      -0.22 + this.windCrossForce * 0.35 - laneVel * 0.15;
    this.runner.bandanaTailRight.rotation.y =
      0.22 + this.windCrossForce * 0.35 - laneVel * 0.15;
  }

  private animateMonster(dt: number, elapsedSec: number): void {
    if (this.monsterRoarFlash > 0) {
      this.monsterRoarFlash = Math.max(0, this.monsterRoarFlash - dt * 1.5);
    }

    let targetZ = THREE.MathUtils.lerp(5.4, 2.2, this.monsterProximity);
    if (this.phase === 'title') {
      targetZ = 3.25;
    } else if (this.phase === 'game_over') {
      targetZ = THREE.MathUtils.lerp(2.2, 0.95, this.monsterCatchAnim);
    }

    this.monster.root.position.x = this.monsterX;
    this.monster.root.position.z = THREE.MathUtils.damp(
      this.monster.root.position.z,
      targetZ,
      9.0,
      dt
    );

    const strideS = Math.sin(this.monsterStridePhase);
    const strideC = Math.cos(this.monsterStridePhase);

    const hopY =
      this.phase === 'game_over' ? 0 : Math.max(0, strideC) * 0.24;
    this.monster.bodyPivot.position.y = hopY;
    this.monster.bodyPivot.rotation.x =
      -0.24 + strideC * 0.1 - this.monsterRoarFlash * 0.24;
    this.monster.bodyPivot.rotation.z = strideS * 0.09;

    this.monster.leftLegPivot.rotation.x = strideS * 0.78;
    this.monster.leftKneePivot.rotation.x = -0.18 - Math.max(0, strideC) * 0.85;
    this.monster.rightLegPivot.rotation.x = -strideS * 0.78;
    this.monster.rightKneePivot.rotation.x =
      -0.18 - Math.max(0, -strideC) * 0.85;

    this.monster.leftArmPivot.rotation.x =
      0.55 - strideS * 0.68 + this.monsterRoarFlash * 0.45;
    this.monster.leftElbowPivot.rotation.x =
      0.55 + Math.max(0, -strideS) * 0.45;
    this.monster.rightArmPivot.rotation.x =
      0.55 + strideS * 0.68 + this.monsterRoarFlash * 0.45;
    this.monster.rightElbowPivot.rotation.x =
      0.55 + Math.max(0, strideS) * 0.45;

    this.monster.jawPivot.rotation.x =
      0.18 +
      Math.abs(Math.sin(elapsedSec * 6.5)) * 0.22 +
      this.monsterRoarFlash * 0.48;

    const pulse = 1.0 + Math.sin(elapsedSec * 8.0) * 0.14;
    this.monster.chestCore.scale.set(1.12 * pulse, 1.28 * pulse, 0.68);

    this.monsterLight.position.set(
      this.monster.root.position.x,
      2.1,
      this.monster.root.position.z - 0.6
    );
    this.monsterLight.intensity =
      (1.2 + this.monsterProximity * 2.4 + this.monsterRoarFlash * 1.8) * pulse;
  }

  private updateCamera(dt: number, elapsedSec: number): void {
    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 2.6);
    }

    const curveLeadX = this.activeRouteCurve * 620;

    if (this.phase === 'title') {
      // Cinematic front-quarter diorama showcase framing Runner, Monster, Palms & Highway
      _camTargetPos.set(
        4.85 + Math.sin(elapsedSec * 0.45) * 0.25,
        3.95 + Math.cos(elapsedSec * 0.35) * 0.14,
        -6.05
      );
      _camLookAt.set(1.45, 1.32, 1.35);
    } else if (this.phase === 'game_over') {
      _camTargetPos.set(this.playerX * 0.6 + 2.1, 4.6, 6.4);
      _camLookAt.set(this.playerX * 0.7, 1.45, 0.4);
    } else {
      if (this.cameraPreset === 'close') {
        _camTargetPos.set(
          this.playerX * 0.7,
          3.65 + this.playerY * 0.28,
          5.55
        );
        _camLookAt.set(
          this.playerX * 0.52 + curveLeadX * 0.78,
          1.36 + this.playerY * 0.15,
          -10.8
        );
      } else if (this.cameraPreset === 'aerial') {
        _camTargetPos.set(
          this.playerX * 0.45,
          8.6 + this.playerY * 0.22,
          10.8
        );
        _camLookAt.set(this.playerX * 0.32 + curveLeadX * 1.12, 0.65, -13.0);
      } else {
        // DEFAULT 'elevated' — Authentic Temple Run / Subway Surfers Third-Person Chase Camera!
        _camTargetPos.set(
          this.playerX * 0.64,
          4.68 + this.playerY * 0.28,
          6.95
        );
        _camLookAt.set(
          this.playerX * 0.48 + curveLeadX * 0.88,
          1.32 + this.playerY * 0.14,
          -11.6
        );
      }
    }

    this.curCamPos.lerp(_camTargetPos, 1 - Math.exp(-9.5 * dt));
    this.curCamLook.lerp(_camLookAt, 1 - Math.exp(-11.0 * dt));

    // Keep sky dome centered on camera so horizon is infinite
    this.skyDome.mesh.position.copy(this.curCamPos);

    const shakeX =
      this.cameraShake > 0
        ? (Math.random() - 0.5) * this.cameraShake * 0.42
        : 0;
    const shakeY =
      this.cameraShake > 0
        ? (Math.random() - 0.5) * this.cameraShake * 0.32
        : 0;

    // Smooth Temple Run Turn Lean & Crosswind Camera Roll
    const desiredRoll =
      this.phase === 'playing' && this.fx4dEnabled
        ? (this.targetLane * LANE_WIDTH - this.playerX) * -0.02 +
          this.activeRouteCurve * -9.5 +
          this.windCrossForce * 0.012
        : 0;
    this.curCamRoll = THREE.MathUtils.damp(this.curCamRoll, desiredRoll, 7, dt);
    _camUp.set(Math.sin(this.curCamRoll), Math.cos(this.curCamRoll), 0);

    this.camera.up.copy(_camUp);
    this.camera.position.set(
      this.curCamPos.x + shakeX,
      this.curCamPos.y + shakeY,
      this.curCamPos.z
    );
    this.camera.lookAt(this.curCamLook);

    const speedFovAdd = Math.min(
      3.5,
      Math.max(0, (this.currentBaseSpeed - 11.2) * 0.42)
    );
    const desiredFov =
      this.phase === 'playing'
        ? this.boostTimer > 0
          ? 68
          : this.chronoTimer > 0
          ? 63
          : 58 + speedFovAdd
        : 56;
    if (Math.abs(this.camera.fov - desiredFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(
        this.camera.fov,
        desiredFov,
        6.5,
        dt
      );
      this.camera.updateProjectionMatrix();
    }
  }

  // ==================== DOM & INPUT EVENT LISTENERS ====================

  private readonly handleKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;

    if (e.code === 'KeyM') {
      this.toggleMute();
      return;
    }
    if (e.code === 'KeyH' && this.phase === 'playing') {
      this.toggleDock();
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (this.phase === 'playing' || this.phase === 'paused') {
        e.preventDefault();
        this.togglePause();
      }
      return;
    }

    if (this.phase === 'title' || this.phase === 'game_over') {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        this.startGame(this.startZoneOffset);
      }
      return;
    }

    if (this.phase !== 'playing') return;

    switch (e.code) {
      case 'KeyA':
      case 'ArrowLeft':
        e.preventDefault();
        this.moveLane(-1);
        break;
      case 'KeyD':
      case 'ArrowRight':
        e.preventDefault();
        this.moveLane(1);
        break;
      case 'KeyW':
      case 'ArrowUp':
      case 'Space':
        e.preventDefault();
        this.triggerJump();
        break;
      case 'KeyS':
      case 'ArrowDown':
        e.preventDefault();
        this.triggerSlide();
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
      case 'KeyE':
        e.preventDefault();
        this.triggerChronoShift();
        break;
    }
  };

  private readonly handlePointerDown = (e: PointerEvent): void => {
    this.audio.unlock();
    if (e.button === 2 && this.phase === 'playing') {
      this.triggerChronoShift();
      return;
    }
    const now = performance.now();
    if (now - this.lastTapTimeMs < 260 && this.phase === 'playing') {
      this.triggerChronoShift();
    }
    this.lastTapTimeMs = now;

    this.swipeActive = true;
    this.swipeConsumed = false;
    this.swipeStartX = e.clientX;
    this.swipeStartY = e.clientY;
  };

  private readonly handleContextMenu = (e: MouseEvent): void => {
    if (this.phase === 'playing') {
      e.preventDefault();
    }
  };

  private readonly handlePointerMove = (e: PointerEvent): void => {
    if (!this.swipeActive || this.swipeConsumed || this.phase !== 'playing') {
      return;
    }
    const dx = e.clientX - this.swipeStartX;
    const dy = e.clientY - this.swipeStartY;
    if (Math.hypot(dx, dy) < 28) return;

    this.swipeConsumed = true;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.moveLane(dx > 0 ? 1 : -1);
    } else if (dy < 0) {
      this.triggerJump();
    } else {
      this.triggerSlide();
    }
  };

  private readonly handlePointerUp = (): void => {
    this.swipeActive = false;
    this.swipeConsumed = false;
  };

  private readonly handleBlurOrHide = (): void => {
    this.swipeActive = false;
    this.swipeConsumed = false;
    if (document.hidden && this.phase === 'playing') {
      this.phase = 'paused';
      this.emitHud(true);
    }
  };

  private readonly handleResize = (): void => {
    if (!this.renderer || !this.camera) return;
    const width = Math.max(1, this.mountEl.clientWidth || window.innerWidth);
    const height = Math.max(1, this.mountEl.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
  };

  private readonly handleContextLost = (e: Event): void => {
    e.preventDefault();
  };

  private readonly handleContextRestored = (): void => {
    this.handleResize();
  };

  private bindEvents(): void {
    const dom = this.renderer.domElement;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('blur', this.handleBlurOrHide);
    document.addEventListener('visibilitychange', this.handleBlurOrHide);
    dom.addEventListener('pointerdown', this.handlePointerDown);
    dom.addEventListener('contextmenu', this.handleContextMenu);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    dom.addEventListener('webglcontextlost', this.handleContextLost);
    dom.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  private getTimeOfDayLabel(): string {
    const p = this.dayCyclePhase;
    if (p < 0.22) return 'Golden Ghat Dawn';
    if (p < 0.52) return 'Highland Mist';
    if (p < 0.76) return 'Monsoon Dusk';
    return 'Storm Night';
  }

  private getWeatherLabel(): string {
    const w = Math.abs(this.windCrossForce);
    if (this.lightningFlash > 0.1 || this.dayCyclePhase >= 0.76) {
      return 'Thunder Squall';
    }
    if (w > 0.55) return 'Strong Ghat Crosswind';
    return 'Misty Breeze';
  }

  private emitHud(force: boolean): void {
    if (this.disposed && !force) return;
    this.onHudChange({
      phase: this.phase,
      zoneIndex: this.currentZone.index,
      zoneName: this.currentZone.name,
      malayalamRegion: this.currentZone.malayalamRegion,
      soundscapeLabel: LANDMARK_SOUNDSCAPE_LABELS[this.currentZone.landmark],
      distanceMeters: Math.floor(this.distanceMeters),
      runSpeedKmh: Number(
        (
          this.currentBaseSpeed *
          (this.boostTimer > 0 ? 1.28 : 1.0) *
          (this.chronoTimer > 0 ? 0.44 : 1.0) *
          2.0
        ).toFixed(1)
      ),
      milestoneBannerMeters:
        this.milestoneBannerTimer > 0 ? this.milestoneBannerMeters : 0,
      coins: this.runCoins,
      totalCoinsBank: this.totalCoinsBank + this.runCoins,
      score: Math.floor(this.score),
      highScore: Math.max(this.highScore, Math.floor(this.score)),
      bestDistance: Math.max(
        this.bestDistance,
        Math.floor(this.distanceMeters)
      ),
      multiplier: this.multiplier,
      monsterProximity: Number(this.monsterProximity.toFixed(2)),
      monsterAlert: this.monsterDangerTimer > 0,
      magnetSeconds: Math.ceil(this.magnetTimer),
      boostSeconds: Math.ceil(this.boostTimer),
      chronoCharge: Math.floor(this.chronoCharge),
      chronoActive: this.chronoTimer > 0,
      chronoSeconds: Number(this.chronoTimer.toFixed(1)),
      timeOfDayLabel: this.getTimeOfDayLabel(),
      weatherLabel: this.getWeatherLabel(),
      fx4dEnabled: this.fx4dEnabled,
      lensWetness: Number(this.lensWetness.toFixed(2)),
      windCrossForce: Number(this.windCrossForce.toFixed(2)),
      lightningFlash: Number(this.lightningFlash.toFixed(2)),
      deathReason: this.deathReason,
      cameraPreset: this.cameraPreset,
      muted: this.audio.isMuted(),
      ambienceVolume: this.audio.ambience.getVolumePercent(),
      dockCollapsed: this.dockCollapsed,
      webglFallback: this.webglFallback,
    });
  }

  public dispose(): void {
    this.disposed = true;
    window.cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('blur', this.handleBlurOrHide);
    document.removeEventListener('visibilitychange', this.handleBlurOrHide);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);

    if (this.renderer?.domElement) {
      const dom = this.renderer.domElement;
      dom.removeEventListener('pointerdown', this.handlePointerDown);
      dom.removeEventListener('contextmenu', this.handleContextMenu);
      dom.removeEventListener('webglcontextlost', this.handleContextLost);
      dom.removeEventListener(
        'webglcontextrestored',
        this.handleContextRestored
      );
      dom.remove();
    }

    this.audio.dispose();

    if (this.scene) {
      this.scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).geometry?.dispose();
        }
      });
    }
    (this.skyDome?.mesh.material as THREE.Material | undefined)?.dispose();
    this.coinGeo?.dispose();
    this.particleGeo?.dispose();
    this.particleMat?.dispose();
    this.rainGeo?.dispose();
    this.rainMat?.dispose();
    this.speedLineGeo?.dispose();
    this.speedLineMat?.dispose();
    this.mats?.dispose();
    this.renderer?.dispose();
  }
}
