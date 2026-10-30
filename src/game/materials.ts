import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';

export interface WayanadMaterialLibrary {
  textures: ProceduralTextureSet;
  lateriteBlock: THREE.MeshStandardMaterial;
  basinRimStone: THREE.MeshStandardMaterial;
  mossTurf: THREE.MeshStandardMaterial;
  teaFoliage: THREE.MeshStandardMaterial;
  sholaCanopy: THREE.MeshStandardMaterial;
  palmFrond: THREE.MeshStandardMaterial;
  bananaLeaf: THREE.MeshStandardMaterial;
  treeTrunk: THREE.MeshStandardMaterial;
  asphaltRoad: THREE.MeshPhysicalMaterial;
  roadStripe: THREE.MeshStandardMaterial;
  roadYellowStripe: THREE.MeshStandardMaterial;
  kerbBlack: THREE.MeshStandardMaterial;
  guardStoneWhite: THREE.MeshStandardMaterial;
  guardStoneOchre: THREE.MeshStandardMaterial;
  galvanizedSteel: THREE.MeshStandardMaterial;
  reflectorRed: THREE.MeshStandardMaterial;
  catsEyeAmber: THREE.MeshStandardMaterial;
  chevronBoard: THREE.MeshStandardMaterial;
  highwaySignMats: THREE.MeshStandardMaterial[];
  convexMirrorFrame: THREE.MeshStandardMaterial;
  convexMirrorLens: THREE.MeshPhysicalMaterial;
  streetLampGlow: THREE.MeshStandardMaterial;
  headlampGlow: THREE.MeshStandardMaterial;
  bambooWood: THREE.MeshStandardMaterial;
  rosewood: THREE.MeshStandardMaterial;
  goldCoin: THREE.MeshPhysicalMaterial;
  brushedBrass: THREE.MeshPhysicalMaterial;
  graniteRock: THREE.MeshStandardMaterial;
  petroglyphWall: THREE.MeshStandardMaterial;
  kabiniWater: THREE.MeshPhysicalMaterial;
  terracottaRoof: THREE.MeshStandardMaterial;
  limePlaster: THREE.MeshStandardMaterial;
  tarpaulinBlue: THREE.MeshPhysicalMaterial;
  chayakadaSign: THREE.MeshStandardMaterial;
  // Kerala Vehicles (KSRTC Bus & Autorickshaw)
  ksrtcFront: THREE.MeshPhysicalMaterial;
  ksrtcRed: THREE.MeshPhysicalMaterial;
  ksrtcIvory: THREE.MeshPhysicalMaterial;
  autoYellow: THREE.MeshPhysicalMaterial;
  autoBlack: THREE.MeshStandardMaterial;
  vehicleGlass: THREE.MeshPhysicalMaterial;
  tireRubber: THREE.MeshStandardMaterial;
  // Explorer Runner materials
  runnerSkin: THREE.MeshStandardMaterial;
  runnerTunicTeal: THREE.MeshPhysicalMaterial;
  runnerVestTan: THREE.MeshPhysicalMaterial;
  runnerPantsDark: THREE.MeshStandardMaterial;
  runnerBandanaRed: THREE.MeshStandardMaterial;
  runnerShoeWhite: THREE.MeshStandardMaterial;
  chronoGhost: THREE.MeshStandardMaterial;
  // Chasing Monster (Churam Rakshasa) materials
  monsterHide: THREE.MeshStandardMaterial;
  monsterArmorCrag: THREE.MeshStandardMaterial;
  monsterEmberGlow: THREE.MeshStandardMaterial;
  monsterHornBone: THREE.MeshStandardMaterial;
  // Powerups, Wildlife, Sunbeams & Mist
  magnetGlowCyan: THREE.MeshPhysicalMaterial;
  boostGlowAmber: THREE.MeshPhysicalMaterial;
  tuskerSkin: THREE.MeshStandardMaterial;
  tuskerIvory: THREE.MeshStandardMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  mistRibbon: THREE.MeshBasicMaterial;
  sunbeamRay: THREE.MeshBasicMaterial;
  updateWindAndNight: (
    timeSec: number,
    windStrength: number,
    nightFactor: number
  ) => void;
  dispose: () => void;
}

export function createWayanadMaterials(
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean
): WayanadMaterialLibrary {
  const mats: THREE.Material[] = [];
  const windUniforms = {
    uTime: { value: 0 },
    uWind: { value: 0.35 },
  };

  const track = <T extends THREE.Material>(m: T): T => {
    mats.push(m);
    return m;
  };

  const attachFoliageWind = (
    mat: THREE.MeshStandardMaterial,
    amplitude = 0.14
  ) => {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = windUniforms.uTime;
      shader.uniforms.uWind = windUniforms.uWind;
      shader.vertexShader =
        'uniform float uTime;\nuniform float uWind;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float swayMask = clamp((transformed.y + 0.6) * 0.55, 0.0, 1.5);
           transformed.x += sin(uTime * 2.9 + position.z * 0.9 + position.y * 1.3) * ${amplitude.toFixed(
             3
           )} * uWind * swayMask;
           transformed.z += cos(uTime * 2.3 + position.x * 0.8) * ${(
             amplitude * 0.55
           ).toFixed(3)} * uWind * swayMask;`
        );
    };
  };

  const lateriteBlock = track(
    new THREE.MeshStandardMaterial({
      map: textures.lateriteAlbedo,
      normalMap: textures.lateriteNormal,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughness: 0.82,
      metalness: 0.05,
    })
  );

  const basinRimStone = track(
    new THREE.MeshStandardMaterial({
      color: 0x34302c,
      normalMap: textures.lateriteNormal,
      roughness: 0.86,
      metalness: 0.08,
    })
  );

  const mossTurf = track(
    new THREE.MeshStandardMaterial({
      color: 0x24562c,
      normalMap: textures.teaNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.84,
      metalness: 0.02,
    })
  );

  const teaFoliage = track(
    new THREE.MeshStandardMaterial({
      map: textures.teaTerraceAlbedo,
      normalMap: textures.teaNormal,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughness: 0.68,
      metalness: 0.03,
    })
  );
  attachFoliageWind(teaFoliage, 0.12);

  const sholaCanopy = track(
    new THREE.MeshStandardMaterial({
      color: 0x225c31,
      normalMap: textures.teaNormal,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.7,
      metalness: 0.03,
    })
  );
  attachFoliageWind(sholaCanopy, 0.16);

  const palmFrond = track(
    new THREE.MeshStandardMaterial({
      map: textures.palmFrondAlbedo,
      alphaTest: 0.32,
      side: THREE.DoubleSide,
      roughness: 0.52,
      metalness: 0.04,
    })
  );
  attachFoliageWind(palmFrond, 0.24);

  const bananaLeaf = track(
    new THREE.MeshStandardMaterial({
      color: 0x459e3b,
      roughness: 0.42,
      metalness: 0.04,
      side: THREE.DoubleSide,
    })
  );
  attachFoliageWind(bananaLeaf, 0.2);

  const treeTrunk = track(
    new THREE.MeshStandardMaterial({
      map: textures.barkAlbedo,
      normalMap: textures.barkNormal,
      normalScale: new THREE.Vector2(1.0, 1.0),
      roughness: 0.86,
      metalness: 0.02,
    })
  );

  // AAA Monsoon-Wet NH-766 Macadam Asphalt with glossy puddle clearcoat & reflections
  const asphaltRoad = track(
    new THREE.MeshPhysicalMaterial({
      map: textures.asphaltAlbedo,
      normalMap: textures.asphaltNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: textures.asphaltRoughness,
      roughness: 0.88,
      metalness: 0.1,
      clearcoat: isSoftwareGl ? 0.25 : 0.68,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.35,
    })
  );

  const roadStripe = track(
    new THREE.MeshStandardMaterial({
      color: 0xf5f2e8,
      emissive: 0x2a2924,
      emissiveIntensity: 0.25,
      roughness: 0.38,
      metalness: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );

  const roadYellowStripe = track(
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0x5c4503,
      emissiveIntensity: 0.3,
      roughness: 0.36,
      metalness: 0.1,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );

  const kerbBlack = track(
    new THREE.MeshStandardMaterial({
      color: 0x1a1d20,
      roughness: 0.65,
      metalness: 0.08,
    })
  );

  const guardStoneWhite = track(
    new THREE.MeshStandardMaterial({
      color: 0xf0ece1,
      roughness: 0.56,
      metalness: 0.05,
    })
  );

  const guardStoneOchre = track(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.48,
      metalness: 0.1,
    })
  );

  const galvanizedSteel = track(
    new THREE.MeshStandardMaterial({
      color: 0xc2ccd4,
      roughness: 0.28,
      metalness: 0.88,
      envMapIntensity: 1.25,
    })
  );

  const reflectorRed = track(
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.95,
      roughness: 0.2,
      metalness: 0.25,
    })
  );

  const catsEyeAmber = track(
    new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.9,
      roughness: 0.18,
      metalness: 0.35,
    })
  );

  const chevronBoard = track(
    new THREE.MeshStandardMaterial({
      map: textures.chevronAlbedo,
      roughness: 0.32,
      metalness: 0.26,
    })
  );

  const highwaySignMats = textures.highwaySigns.map((tex) =>
    track(
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.3,
        metalness: 0.22,
      })
    )
  );

  const convexMirrorFrame = track(
    new THREE.MeshStandardMaterial({
      color: 0xea580c,
      roughness: 0.34,
      metalness: 0.16,
    })
  );

  const convexMirrorLens = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      metalness: 0.98,
      roughness: 0.03,
      clearcoat: 1.0,
      envMapIntensity: 1.6,
    })
  );

  const streetLampGlow = track(
    new THREE.MeshStandardMaterial({
      color: 0xfff5d6,
      emissive: 0xffaa3b,
      emissiveIntensity: 0.65,
      roughness: 0.18,
    })
  );

  const headlampGlow = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffe599,
      emissiveIntensity: 1.4,
      roughness: 0.12,
    })
  );

  const bambooWood = track(
    new THREE.MeshStandardMaterial({
      map: textures.bambooAlbedo,
      roughness: 0.58,
      metalness: 0.06,
    })
  );

  const rosewood = track(
    new THREE.MeshStandardMaterial({
      map: textures.barkAlbedo,
      normalMap: textures.barkNormal,
      color: 0x6e3b26,
      roughness: 0.54,
      metalness: 0.06,
    })
  );

  const goldCoin = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xffd44d,
      emissive: 0xc2810a,
      emissiveIntensity: 0.36,
      metalness: 0.96,
      roughness: 0.11,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      anisotropy: isSoftwareGl ? 0 : 0.75,
      envMapIntensity: 1.5,
    })
  );

  const brushedBrass = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xdfa94b,
      metalness: 0.92,
      roughness: 0.2,
      clearcoat: 0.45,
      envMapIntensity: 1.3,
    })
  );

  const graniteRock = track(
    new THREE.MeshStandardMaterial({
      color: 0x585d5a,
      normalMap: textures.lateriteNormal,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughness: 0.8,
      metalness: 0.08,
    })
  );

  const petroglyphWall = track(
    new THREE.MeshStandardMaterial({
      map: textures.petroglyphAlbedo,
      normalMap: textures.lateriteNormal,
      emissive: 0xe3962b,
      emissiveMap: textures.petroglyphAlbedo,
      emissiveIntensity: 0.48,
      roughness: 0.7,
      metalness: 0.14,
    })
  );

  const kabiniWater = track(
    new THREE.MeshPhysicalMaterial({
      map: textures.waterFlowAlbedo,
      normalMap: textures.waterNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      color: 0x2fb3c2,
      metalness: 0.12,
      roughness: 0.08,
      transmission: isSoftwareGl ? 0 : 0.68,
      transparent: true,
      opacity: isSoftwareGl ? 0.88 : 0.95,
      ior: 1.33,
      thickness: 0.9,
      clearcoat: 1.0,
    })
  );

  const terracottaRoof = track(
    new THREE.MeshStandardMaterial({
      map: textures.terracottaAlbedo,
      normalMap: textures.terracottaNormal,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughness: 0.62,
      metalness: 0.05,
    })
  );

  const limePlaster = track(
    new THREE.MeshStandardMaterial({
      color: 0xefe7d5,
      normalMap: textures.lateriteNormal,
      normalScale: new THREE.Vector2(0.22, 0.22),
      roughness: 0.76,
      metalness: 0.02,
    })
  );

  const tarpaulinBlue = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x1d63b8,
      roughness: 0.36,
      metalness: 0.06,
      clearcoat: 0.65,
      side: THREE.DoubleSide,
    })
  );

  const chayakadaSign = track(
    new THREE.MeshStandardMaterial({
      map: textures.chayakadaSignAlbedo,
      roughness: 0.38,
      metalness: 0.12,
    })
  );

  // Automotive Clearcoat Materials for Kerala KSRTC Bus & Autorickshaw
  const ksrtcFront = track(
    new THREE.MeshPhysicalMaterial({
      map: textures.ksrtcFrontAlbedo,
      roughness: 0.28,
      metalness: 0.2,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
    })
  );

  const ksrtcRed = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xb91c1c,
      roughness: 0.3,
      metalness: 0.25,
      clearcoat: 0.88,
      clearcoatRoughness: 0.12,
    })
  );

  const ksrtcIvory = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xfef3c7,
      roughness: 0.32,
      metalness: 0.12,
      clearcoat: 0.75,
    })
  );

  const autoYellow = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xfacc15,
      roughness: 0.26,
      metalness: 0.2,
      clearcoat: 0.85,
    })
  );

  const autoBlack = track(
    new THREE.MeshStandardMaterial({
      color: 0x1e2124,
      roughness: 0.56,
      metalness: 0.15,
    })
  );

  const vehicleGlass = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x1e3a5f,
      metalness: 0.85,
      roughness: 0.06,
      clearcoat: 1.0,
      envMapIntensity: 1.6,
    })
  );

  const tireRubber = track(
    new THREE.MeshStandardMaterial({
      color: 0x17191c,
      roughness: 0.88,
      metalness: 0.05,
    })
  );

  // Runner Materials
  const runnerSkin = track(
    new THREE.MeshStandardMaterial({
      color: 0xc68860,
      roughness: 0.58,
      metalness: 0.02,
    })
  );

  const runnerTunicTeal = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x0f766e,
      roughness: 0.56,
      metalness: 0.06,
      sheen: 0.75,
      sheenColor: new THREE.Color(0x5eead4),
      sheenRoughness: 0.45,
    })
  );

  const runnerVestTan = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xd4b98c,
      roughness: 0.72,
      metalness: 0.05,
      sheen: 0.5,
      sheenColor: new THREE.Color(0xfef3c7),
    })
  );

  const runnerPantsDark = track(
    new THREE.MeshStandardMaterial({
      color: 0x1e252b,
      roughness: 0.76,
      metalness: 0.05,
    })
  );

  const runnerBandanaRed = track(
    new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.42,
      metalness: 0.08,
    })
  );

  const runnerShoeWhite = track(
    new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.44,
      metalness: 0.08,
    })
  );

  const chronoGhost = track(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.88,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      roughness: 0.2,
    })
  );

  const monsterHide = track(
    new THREE.MeshStandardMaterial({
      color: 0x271f1b,
      map: textures.barkAlbedo,
      normalMap: textures.barkNormal,
      normalScale: new THREE.Vector2(1.3, 1.3),
      roughness: 0.82,
      metalness: 0.1,
    })
  );

  const monsterArmorCrag = track(
    new THREE.MeshStandardMaterial({
      map: textures.lateriteAlbedo,
      normalMap: textures.lateriteNormal,
      color: 0x662c1e,
      roughness: 0.54,
      metalness: 0.26,
    })
  );

  const monsterEmberGlow = track(
    new THREE.MeshStandardMaterial({
      color: 0xff6b2b,
      emissive: 0xff3b0f,
      emissiveIntensity: 2.5,
      roughness: 0.16,
    })
  );

  const monsterHornBone = track(
    new THREE.MeshStandardMaterial({
      color: 0xe3d8c4,
      roughness: 0.28,
      metalness: 0.14,
    })
  );

  const magnetGlowCyan = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.0,
      metalness: 0.4,
      roughness: 0.14,
      clearcoat: 1.0,
    })
  );

  const boostGlowAmber = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x34d399,
      emissive: 0x059669,
      emissiveIntensity: 1.0,
      metalness: 0.35,
      roughness: 0.14,
      clearcoat: 1.0,
    })
  );

  const tuskerSkin = track(
    new THREE.MeshStandardMaterial({
      color: 0x4b5054,
      normalMap: textures.barkNormal,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughness: 0.8,
      metalness: 0.05,
    })
  );

  const tuskerIvory = track(
    new THREE.MeshStandardMaterial({
      color: 0xf7f1e1,
      roughness: 0.24,
      metalness: 0.1,
    })
  );

  const contactShadow = track(
    new THREE.MeshBasicMaterial({
      map: textures.contactShadowMap,
      transparent: true,
      depthWrite: false,
      opacity: 0.68,
    })
  );

  const mistRibbon = track(
    new THREE.MeshBasicMaterial({
      map: textures.mistPuffMap,
      transparent: true,
      depthWrite: false,
      opacity: 0.34,
      side: THREE.DoubleSide,
    })
  );

  const sunbeamRay = track(
    new THREE.MeshBasicMaterial({
      map: textures.sunbeamMap,
      color: 0xffe4a0,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.42,
      side: THREE.DoubleSide,
      fog: false,
    })
  );

  return {
    textures,
    lateriteBlock,
    basinRimStone,
    mossTurf,
    teaFoliage,
    sholaCanopy,
    palmFrond,
    bananaLeaf,
    treeTrunk,
    asphaltRoad,
    roadStripe,
    roadYellowStripe,
    kerbBlack,
    guardStoneWhite,
    guardStoneOchre,
    galvanizedSteel,
    reflectorRed,
    catsEyeAmber,
    chevronBoard,
    highwaySignMats,
    convexMirrorFrame,
    convexMirrorLens,
    streetLampGlow,
    headlampGlow,
    bambooWood,
    rosewood,
    goldCoin,
    brushedBrass,
    graniteRock,
    petroglyphWall,
    kabiniWater,
    terracottaRoof,
    limePlaster,
    tarpaulinBlue,
    chayakadaSign,
    ksrtcFront,
    ksrtcRed,
    ksrtcIvory,
    autoYellow,
    autoBlack,
    vehicleGlass,
    tireRubber,
    runnerSkin,
    runnerTunicTeal,
    runnerVestTan,
    runnerPantsDark,
    runnerBandanaRed,
    runnerShoeWhite,
    chronoGhost,
    monsterHide,
    monsterArmorCrag,
    monsterEmberGlow,
    monsterHornBone,
    magnetGlowCyan,
    boostGlowAmber,
    tuskerSkin,
    tuskerIvory,
    contactShadow,
    mistRibbon,
    sunbeamRay,
    updateWindAndNight: (
      timeSec: number,
      windStrength: number,
      nightFactor: number
    ) => {
      windUniforms.uTime.value = timeSec;
      windUniforms.uWind.value = windStrength;
      streetLampGlow.emissiveIntensity = 0.45 + nightFactor * 2.8;
      headlampGlow.emissiveIntensity = 0.9 + nightFactor * 2.6;
      reflectorRed.emissiveIntensity = 0.65 + nightFactor * 1.8;
      catsEyeAmber.emissiveIntensity = 0.6 + nightFactor * 2.1;
      sunbeamRay.opacity = Math.max(0, (1.0 - nightFactor * 1.25) * 0.44);
    },
    dispose: () => {
      mats.forEach((m) => m.dispose());
      textures.dispose();
    },
  };
}
