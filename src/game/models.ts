import * as THREE from 'three';
import { WayanadMaterialLibrary } from './materials';
import { ObstacleKind, PowerupKind } from './types';

export const LANE_WIDTH = 2.2;
export const CHUNK_LENGTH = 12;
export const TRACK_CHUNK_COUNT = 15;

export interface AtmosphericSkyRig {
  mesh: THREE.Mesh;
  uniforms: {
    uZenithColor: { value: THREE.Color };
    uHorizonColor: { value: THREE.Color };
    uSunColor: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
    uLightning: { value: number };
  };
}

export interface ExplorerRunnerRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  torsoPivot: THREE.Group;
  packGroup: THREE.Group;
  headGroup: THREE.Group;
  bandanaTailLeft: THREE.Mesh;
  bandanaTailRight: THREE.Mesh;
  leftArmPivot: THREE.Group;
  leftElbowPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  rightElbowPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  leftKneePivot: THREE.Group;
  leftAnklePivot: THREE.Group;
  rightLegPivot: THREE.Group;
  rightKneePivot: THREE.Group;
  rightAnklePivot: THREE.Group;
  hipLanternLight: THREE.PointLight;
  magnetHalo: THREE.Mesh;
  boostHalo: THREE.Mesh;
  contactShadow: THREE.Mesh;
  chronoEchoes: THREE.Group[];
}

export interface ChasingMonsterRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  jawPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  leftElbowPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  rightElbowPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  leftKneePivot: THREE.Group;
  rightLegPivot: THREE.Group;
  rightKneePivot: THREE.Group;
  chestCore: THREE.Mesh;
  contactShadow: THREE.Mesh;
}

export interface ObstacleInstance {
  active: boolean;
  kind: ObstacleKind;
  lane: number; // -1, 0, 1
  z: number;
  passed: boolean;
  hitHandled: boolean;
  trumpeted: boolean;
  group: THREE.Group;
  animPivot?: THREE.Object3D;
  secondaryPivot?: THREE.Object3D;
}

export interface PowerupInstance {
  active: boolean;
  kind: PowerupKind;
  lane: number;
  y: number;
  z: number;
  group: THREE.Group;
  spinner: THREE.Group;
}

export interface TrackChunkRig {
  group: THREE.Group;
  zCenter: number;
  waterfallRibbon: THREE.Group;
  edakkalSpire: THREE.Group;
  highwaySignMesh: THREE.Mesh | null;
  chevronGroup: THREE.Group;
  sunbeamGroup: THREE.Group;
  mistPlane: THREE.Mesh;
  mistPhase: number;
}

export interface GlidingBirdRig {
  group: THREE.Group;
  leftWing: THREE.Group;
  rightWing: THREE.Group;
  baseX: number;
  baseY: number;
  baseZ: number;
  speed: number;
  phase: number;
}

let monolithPoolCounter = 0;

function enableShadows(obj: THREE.Object3D, cast = true, receive = true): void {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const m = child as THREE.Mesh;
      if (m.material && (m.material as THREE.Material).transparent) return;
      m.castShadow = cast;
      m.receiveShadow = receive;
    }
  });
}

/**
 * Perturbs vertices organically so rocks, cliffs, and mountains look like real
 * weathered Western Ghats granite rather than geometric primitives.
 */
function createOrganicRockGeometry(
  radius: number,
  detail: number,
  seed: number,
  squashY = 1.0
): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n =
      1.0 +
      0.16 * Math.sin(x * 2.1 + seed) * Math.cos(z * 1.9 - seed) +
      0.09 * Math.cos(y * 3.3 + x * 1.7 + seed * 2.0);
    pos.setXYZ(i, x * n, y * n * squashY, z * n);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Cinematic Atmospheric Sky Dome with Rayleigh/Mie horizon haze, golden sun halo,
 * layered tropical cumulus bands, and monsoon lightning illumination.
 */
export function createAtmosphericSkyDome(): AtmosphericSkyRig {
  const uniforms = {
    uZenithColor: { value: new THREE.Color(0x164459) },
    uHorizonColor: { value: new THREE.Color(0x638c7e) },
    uSunColor: { value: new THREE.Color(0xffe4ad) },
    uSunDir: { value: new THREE.Vector3(0.35, 0.28, -0.89).normalize() },
    uLightning: { value: 0.0 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uZenithColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uLightning;
      varying vec3 vWorldDir;

      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y * 1.32 + 0.08, 0.0, 1.0);
        vec3 sky = mix(uHorizonColor, uZenithColor, pow(h, 0.62));

        // Warm Mie atmospheric scatter + crisp solar/lunar disc
        vec3 sDir = normalize(uSunDir);
        float sunAmt = max(dot(dir, sDir), 0.0);
        sky += uSunColor * pow(sunAmt, 5.0) * 0.42;
        sky += uSunColor * pow(sunAmt, 24.0) * 0.35;
        sky += uSunColor * smoothstep(0.996, 0.9993, sunAmt) * 0.95;

        // Soft layered Western Ghats cloud banks near horizon
        float c1 = sin(dir.x * 8.5 + dir.z * 4.5) * 0.5 + 0.5;
        float c2 = cos(dir.x * 17.0 - dir.y * 12.0) * 0.5 + 0.5;
        float cloudMask = smoothstep(0.42, 0.04, abs(dir.y - 0.09)) * c1 * (0.55 + 0.45 * c2);
        vec3 cloudCol = mix(uHorizonColor * 1.18, uSunColor * 1.05, pow(sunAmt, 3.0) * 0.65);
        sky = mix(sky, cloudCol, cloudMask * 0.34);

        // Monsoon Lightning Sheet Illumination
        sky += vec3(0.78, 0.88, 1.0) * uLightning * (0.45 + 0.55 * h);

        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(220, 32, 20), mat);
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

/**
 * Beveled Malabar Gold Coin geometry using LatheGeometry.
 */
export function createGoldCoinGeometry(): THREE.BufferGeometry {
  const profile = [
    new THREE.Vector2(0.0, -0.048),
    new THREE.Vector2(0.28, -0.048),
    new THREE.Vector2(0.34, -0.08),
    new THREE.Vector2(0.42, -0.08),
    new THREE.Vector2(0.45, -0.042),
    new THREE.Vector2(0.45, 0.042),
    new THREE.Vector2(0.42, 0.08),
    new THREE.Vector2(0.34, 0.08),
    new THREE.Vector2(0.28, 0.048),
    new THREE.Vector2(0.0, 0.048),
  ];
  const geo = new THREE.LatheGeometry(profile, 26);
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function buildEchoSilhouette(mats: WayanadMaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.24, 0.56, 4, 10),
    mats.chronoGhost
  );
  torso.position.y = 1.08;
  g.add(torso);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 10, 8),
    mats.chronoGhost
  );
  head.position.y = 1.58;
  g.add(head);

  g.visible = false;
  return g;
}

/**
 * AAA Multi-Joint Articulated Wayanad Explorer Runner:
 * Independent pelvis, counter-twisting spine/chest, expedition rucksack, fluttering bandana,
 * 2-segment arms (shoulder -> elbow -> hand), and 3-segment legs (hip -> knee -> ankle -> sneaker).
 */
export function createExplorerRunner(
  mats: WayanadMaterialLibrary,
  parentScene: THREE.Scene
): ExplorerRunnerRig {
  const root = new THREE.Group();

  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.65, 1.65),
    mats.contactShadow
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.02;
  root.add(contactShadow);

  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // Pelvis / Belt Base
  const pelvis = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.16, 0.16, 6, 12),
    mats.runnerPantsDark
  );
  pelvis.rotation.z = Math.PI / 2;
  pelvis.position.y = 0.8;
  bodyPivot.add(pelvis);

  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.255, 0.26, 0.075, 14),
    mats.rosewood
  );
  belt.position.y = 0.84;
  bodyPivot.add(belt);

  const buckle = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.085, 0.05),
    mats.brushedBrass
  );
  buckle.position.set(0, 0.84, -0.25);
  bodyPivot.add(buckle);

  // Brass Hip-Lantern (casts warm golden light onto the wet tarmac at dusk/night)
  const lanternBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.065, 0.15, 8),
    mats.streetLampGlow
  );
  lanternBody.position.set(0.27, 0.8, 0.06);
  bodyPivot.add(lanternBody);

  const hipLanternLight = new THREE.PointLight(0xffb454, 0.4, 10.5, 2);
  hipLanternLight.position.set(0.32, 0.92, -0.22);
  bodyPivot.add(hipLanternLight);

  // Upper Torso / Spine Pivot (counter-twists smoothly during sprints, jumps & turns!)
  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0.86, 0);
  bodyPivot.add(torsoPivot);

  const tunic = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.22, 0.54, 14),
    mats.runnerTunicTeal
  );
  tunic.position.y = 0.26;
  torsoPivot.add(tunic);

  const shoulders = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.15, 0.36, 6, 12),
    mats.runnerTunicTeal
  );
  shoulders.rotation.z = Math.PI / 2;
  shoulders.position.set(0, 0.47, 0);
  torsoPivot.add(shoulders);

  const vest = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.44, 0.31),
    mats.runnerVestTan
  );
  vest.position.set(0, 0.28, 0);
  torsoPivot.add(vest);

  // Cross-body leather adventurer strap
  const strap = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.52, 0.33),
    mats.rosewood
  );
  strap.position.set(0, 0.28, 0);
  strap.rotation.z = 0.52;
  torsoPivot.add(strap);

  // Sculpted Trekking Rucksack + Rolled Bamboo Mat + Canteen + Gold Compass
  const packGroup = new THREE.Group();
  packGroup.position.set(0, 0.29, 0.22);
  const mainPack = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.44, 0.2),
    mats.runnerVestTan
  );
  packGroup.add(mainPack);

  const packFlap = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.14, 0.22),
    mats.rosewood
  );
  packFlap.position.set(0, 0.17, 0);
  packGroup.add(packFlap);

  const bedroll = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.068, 0.45, 12),
    mats.bambooWood
  );
  bedroll.rotation.z = Math.PI / 2;
  bedroll.position.set(0, 0.28, 0.01);
  packGroup.add(bedroll);

  const compassBadge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.03, 14),
    mats.goldCoin
  );
  compassBadge.rotation.x = Math.PI / 2;
  compassBadge.position.set(0, -0.01, 0.11);
  packGroup.add(compassBadge);
  torsoPivot.add(packGroup);

  // Head, Layered Hair & Fluttering Crimson Bandana
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.72, 0);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.095, 0.15, 10),
    mats.runnerSkin
  );
  neck.position.y = -0.13;
  headGroup.add(neck);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.205, 18, 14),
    mats.runnerSkin
  );
  headGroup.add(head);

  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.222, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
    mats.runnerPantsDark
  );
  hairCap.position.y = 0.025;
  hairCap.rotation.x = -0.12;
  headGroup.add(hairCap);

  const headband = new THREE.Mesh(
    new THREE.CylinderGeometry(0.224, 0.224, 0.072, 16),
    mats.runnerBandanaRed
  );
  headband.position.y = 0.05;
  headGroup.add(headband);

  const tailGeo = new THREE.BoxGeometry(0.058, 0.028, 0.38);
  tailGeo.translate(0, 0, 0.19);
  const bandanaTailLeft = new THREE.Mesh(tailGeo, mats.runnerBandanaRed);
  bandanaTailLeft.position.set(-0.07, 0.045, 0.2);
  headGroup.add(bandanaTailLeft);

  const bandanaTailRight = new THREE.Mesh(tailGeo, mats.runnerBandanaRed);
  bandanaTailRight.position.set(0.07, 0.045, 0.2);
  headGroup.add(bandanaTailRight);

  torsoPivot.add(headGroup);

  // 2-Joint Articulated Arms (Shoulder -> Elbow -> Hand)
  const makeArm = (
    side: number
  ): { shoulder: THREE.Group; elbow: THREE.Group } => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.32, 0.46, 0);

    const sleeve = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.078, 0.17, 5, 10),
      mats.runnerTunicTeal
    );
    sleeve.position.y = -0.11;
    shoulder.add(sleeve);

    const upperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.066, 0.06, 0.14, 10),
      mats.runnerSkin
    );
    upperArm.position.y = -0.22;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.28, 0);
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.058, 0.2, 4, 10),
      mats.runnerSkin
    );
    forearm.position.set(0, -0.13, 0);
    elbow.add(forearm);

    const wristband = new THREE.Mesh(
      new THREE.CylinderGeometry(0.064, 0.064, 0.05, 10),
      mats.runnerBandanaRed
    );
    wristband.position.set(0, -0.22, 0);
    elbow.add(wristband);

    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 10, 8),
      mats.runnerSkin
    );
    hand.scale.set(0.9, 1.1, 1.05);
    hand.position.set(0, -0.28, -0.01);
    elbow.add(hand);

    return { shoulder, elbow };
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  torsoPivot.add(leftArm.shoulder, rightArm.shoulder);

  // 3-Joint Articulated Legs (Hip -> Knee -> Ankle -> Athletic Trail Shoe)
  const makeLeg = (
    side: number
  ): { hip: THREE.Group; knee: THREE.Group; ankle: THREE.Group } => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.145, 0.78, 0);

    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.098, 0.24, 5, 12),
      mats.runnerPantsDark
    );
    thigh.position.y = -0.18;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.36, 0);
    hip.add(knee);

    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.084, 0.068, 0.3, 12),
      mats.runnerPantsDark
    );
    shin.position.y = -0.17;
    knee.add(shin);

    const ankle = new THREE.Group();
    ankle.position.set(0, -0.34, 0);
    knee.add(ankle);

    // Sculpted Athletic Trail Sneaker (crisp white midsole + teal/crimson upper + lug sole)
    const shoeUpper = new THREE.Mesh(
      new THREE.BoxGeometry(0.165, 0.11, 0.29),
      mats.runnerTunicTeal
    );
    shoeUpper.position.set(0, -0.03, -0.045);
    ankle.add(shoeUpper);

    const heelAccent = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.08, 0.09),
      mats.runnerBandanaRed
    );
    heelAccent.position.set(0, -0.02, 0.065);
    ankle.add(heelAccent);

    const midsole = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.055, 0.32),
      mats.runnerShoeWhite
    );
    midsole.position.set(0, -0.085, -0.045);
    ankle.add(midsole);

    return { hip, knee, ankle };
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);
  bodyPivot.add(leftLeg.hip, rightLeg.hip);

  // Active Powerup Halos
  const haloGeo = new THREE.TorusGeometry(0.68, 0.032, 8, 28);
  haloGeo.rotateX(Math.PI / 2);

  const magnetHalo = new THREE.Mesh(haloGeo, mats.magnetGlowCyan);
  magnetHalo.position.y = 0.95;
  magnetHalo.visible = false;
  root.add(magnetHalo);

  const boostHalo = new THREE.Mesh(haloGeo, mats.boostGlowAmber);
  boostHalo.position.y = 0.55;
  boostHalo.scale.setScalar(1.15);
  boostHalo.visible = false;
  root.add(boostHalo);

  // 4D Spacetime Afterimage Echoes
  const chronoEchoes: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const echo = buildEchoSilhouette(mats);
    parentScene.add(echo);
    chronoEchoes.push(echo);
  }

  enableShadows(bodyPivot, true, true);

  return {
    root,
    bodyPivot,
    torsoPivot,
    packGroup,
    headGroup,
    bandanaTailLeft,
    bandanaTailRight,
    leftArmPivot: leftArm.shoulder,
    leftElbowPivot: leftArm.elbow,
    rightArmPivot: rightArm.shoulder,
    rightElbowPivot: rightArm.elbow,
    leftLegPivot: leftLeg.hip,
    leftKneePivot: leftLeg.knee,
    leftAnklePivot: leftLeg.ankle,
    rightLegPivot: rightLeg.hip,
    rightKneePivot: rightLeg.knee,
    rightAnklePivot: rightLeg.ankle,
    hipLanternLight,
    magnetHalo,
    boostHalo,
    contactShadow,
    chronoEchoes,
  };
}

/**
 * AAA Articulated Churam Forest Guardian (The Pursuing Beast).
 */
export function createChasingMonster(
  mats: WayanadMaterialLibrary
): ChasingMonsterRig {
  const root = new THREE.Group();

  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 3.4),
    mats.contactShadow
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.022;
  root.add(contactShadow);

  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const pelvis = new THREE.Mesh(
    createOrganicRockGeometry(0.56, 2, 1.4, 0.85),
    mats.monsterHide
  );
  pelvis.scale.set(1.18, 1.0, 0.96);
  pelvis.position.set(0, 1.08, 0.16);
  bodyPivot.add(pelvis);

  const chest = new THREE.Mesh(
    createOrganicRockGeometry(0.84, 2, 3.7, 1.04),
    mats.monsterHide
  );
  chest.scale.set(1.34, 1.0, 1.06);
  chest.position.set(0, 1.78, -0.08);
  bodyPivot.add(chest);

  const chestCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.36, 1),
    mats.monsterEmberGlow
  );
  chestCore.scale.set(1.12, 1.28, 0.68);
  chestCore.position.set(0, 1.72, -0.68);
  bodyPivot.add(chestCore);

  for (const side of [-1, 1]) {
    const pauldron = new THREE.Mesh(
      createOrganicRockGeometry(0.5, 1, side * 2.3, 0.92),
      mats.monsterArmorCrag
    );
    pauldron.position.set(side * 0.98, 2.08, -0.05);
    pauldron.rotation.z = -side * 0.35;
    bodyPivot.add(pauldron);

    const shoulderSpike = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.6, 7),
      mats.monsterHornBone
    );
    shoulderSpike.position.set(side * 1.15, 2.46, -0.02);
    shoulderSpike.rotation.z = -side * 0.42;
    bodyPivot.add(shoulderSpike);
  }

  for (let i = 0; i < 4; i++) {
    const dorsal = new THREE.Mesh(
      new THREE.ConeGeometry(0.15 - i * 0.02, 0.52 - i * 0.06, 7),
      i === 0 ? mats.monsterEmberGlow : mats.monsterArmorCrag
    );
    dorsal.position.set(0, 2.34 - i * 0.3, 0.42 + i * 0.16);
    dorsal.rotation.x = 0.68;
    bodyPivot.add(dorsal);
  }

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 2.32, -0.54);

  const cranium = new THREE.Mesh(
    createOrganicRockGeometry(0.48, 2, 5.1, 0.94),
    mats.monsterArmorCrag
  );
  cranium.scale.set(1.14, 1.0, 1.2);
  headGroup.add(cranium);

  for (const side of [-1, 1]) {
    const hornCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.32, 0.14, 0.0),
      new THREE.Vector3(side * 0.72, 0.38, -0.14),
      new THREE.Vector3(side * 0.88, 0.72, -0.46),
      new THREE.Vector3(side * 0.6, 0.98, -0.68),
    ]);
    const horn = new THREE.Mesh(
      new THREE.TubeGeometry(hornCurve, 14, 0.088, 8, false),
      mats.monsterHornBone
    );
    headGroup.add(horn);

    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 10, 8),
      mats.monsterEmberGlow
    );
    eye.scale.set(1.28, 0.75, 0.9);
    eye.position.set(side * 0.22, 0.08, -0.43);
    headGroup.add(eye);
  }

  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, -0.16, -0.12);
  const jawMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.21, 0.54),
    mats.monsterHide
  );
  jawMesh.position.set(0, -0.06, -0.18);
  jawPivot.add(jawMesh);

  for (const side of [-1, 1]) {
    const tusk = new THREE.Mesh(
      new THREE.ConeGeometry(0.068, 0.32, 7),
      mats.monsterHornBone
    );
    tusk.position.set(side * 0.22, 0.12, -0.39);
    tusk.rotation.x = -0.2;
    jawPivot.add(tusk);
  }
  headGroup.add(jawPivot);
  bodyPivot.add(headGroup);

  const makeMonsterArm = (
    side: number
  ): { shoulder: THREE.Group; elbow: THREE.Group } => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 1.0, 1.92, -0.12);

    const upperArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.2, 0.48, 4, 10),
      mats.monsterHide
    );
    upperArm.position.set(side * 0.06, -0.32, 0);
    upperArm.rotation.z = -side * 0.16;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(side * 0.12, -0.62, -0.05);
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.18, 0.52, 4, 10),
      mats.monsterArmorCrag
    );
    forearm.position.set(0, -0.32, -0.12);
    forearm.rotation.x = 0.35;
    elbow.add(forearm);

    for (let c = -1; c <= 1; c++) {
      const claw = new THREE.Mesh(
        new THREE.ConeGeometry(0.052, 0.38, 6),
        mats.monsterHornBone
      );
      claw.position.set(c * 0.09, -0.68, -0.34);
      claw.rotation.x = -1.15;
      elbow.add(claw);
    }

    return { shoulder, elbow };
  };

  const leftArm = makeMonsterArm(-1);
  const rightArm = makeMonsterArm(1);
  bodyPivot.add(leftArm.shoulder, rightArm.shoulder);

  const makeMonsterLeg = (
    side: number
  ): { hip: THREE.Group; knee: THREE.Group } => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.45, 1.0, 0.16);

    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.21, 0.38, 4, 10),
      mats.monsterHide
    );
    thigh.position.set(0, -0.24, -0.04);
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.48, -0.06);
    hip.add(knee);

    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 0.52, 10),
      mats.monsterArmorCrag
    );
    shin.position.set(0, -0.26, 0.06);
    shin.rotation.x = 0.18;
    knee.add(shin);

    return { hip, knee };
  };

  const leftLeg = makeMonsterLeg(-1);
  const rightLeg = makeMonsterLeg(1);
  bodyPivot.add(leftLeg.hip, rightLeg.hip);

  enableShadows(bodyPivot, true, true);

  return {
    root,
    bodyPivot,
    headGroup,
    jawPivot,
    leftArmPivot: leftArm.shoulder,
    leftElbowPivot: leftArm.elbow,
    rightArmPivot: rightArm.shoulder,
    rightElbowPivot: rightArm.elbow,
    leftLegPivot: leftLeg.hip,
    leftKneePivot: leftLeg.knee,
    rightLegPivot: rightLeg.hip,
    rightKneePivot: rightLeg.knee,
    chestCore,
    contactShadow,
  };
}

// =========================================================================
// LUSH KERALA VEGETATION, VEHICLES & ROADSIDE VILLAGE PROPS
// =========================================================================

/**
 * Iconic Curved Kerala Coconut Palm with ringed trunk, coconuts, and 8 swaying pinnate fronds!
 */
function createKeralaCoconutPalm(
  mats: WayanadMaterialLibrary,
  scale = 1.0,
  leanX = 0.55
): THREE.Group {
  const g = new THREE.Group();

  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(leanX * 0.35 * scale, 1.9 * scale, 0.1 * scale),
    new THREE.Vector3(leanX * 0.85 * scale, 3.8 * scale, -0.08 * scale),
    new THREE.Vector3(leanX * 1.15 * scale, 5.45 * scale, 0),
  ]);
  const trunk = new THREE.Mesh(
    new THREE.TubeGeometry(trunkCurve, 12, 0.17 * scale, 8, false),
    mats.treeTrunk
  );
  trunk.castShadow = true;
  g.add(trunk);

  const crown = new THREE.Group();
  crown.position.set(leanX * 1.15 * scale, 5.45 * scale, 0);
  g.add(crown);

  // Cluster of golden/green tender coconuts under the fronds
  for (let c = 0; c < 4; c++) {
    const ang = (c * Math.PI) / 2;
    const nut = new THREE.Mesh(
      new THREE.SphereGeometry(0.14 * scale, 8, 6),
      c % 2 === 0 ? mats.guardStoneOchre : mats.bananaLeaf
    );
    nut.position.set(
      Math.cos(ang) * 0.18 * scale,
      -0.14 * scale,
      Math.sin(ang) * 0.18 * scale
    );
    crown.add(nut);
  }

  // 8 Arching Pinnate Fronds with alpha-cutout leaflets swaying in wind!
  const frondGeo = new THREE.PlaneGeometry(1.35 * scale, 2.85 * scale, 1, 4);
  frondGeo.translate(0, 1.42 * scale, 0);
  const pos = frondGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const yy = pos.getY(i) / (2.85 * scale);
    pos.setZ(i, -yy * yy * 0.85 * scale);
  }
  frondGeo.computeVertexNormals();

  for (let f = 0; f < 8; f++) {
    const holder = new THREE.Group();
    holder.rotation.y = (f * Math.PI * 2) / 8 + (f % 2) * 0.15;
    const frond = new THREE.Mesh(frondGeo, mats.palmFrond);
    frond.rotation.x = 1.05 + (f % 2) * 0.26;
    holder.add(frond);
    crown.add(holder);
  }

  return g;
}

/**
 * Lush Kerala Broad-Leaf Banana Plant Cluster.
 */
function createTropicalBananaPlant(
  mats: WayanadMaterialLibrary,
  scale = 1.0
): THREE.Group {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12 * scale, 0.18 * scale, 1.65 * scale, 8),
    mats.bananaLeaf
  );
  stem.position.y = 0.82 * scale;
  g.add(stem);

  const leafGeo = new THREE.PlaneGeometry(0.62 * scale, 1.75 * scale, 1, 3);
  leafGeo.translate(0, 0.87 * scale, 0);
  const lPos = leafGeo.attributes.position;
  for (let i = 0; i < lPos.count; i++) {
    const t = lPos.getY(i) / (1.75 * scale);
    lPos.setZ(i, -t * t * 0.55 * scale);
  }
  leafGeo.computeVertexNormals();

  for (let i = 0; i < 6; i++) {
    const leafPivot = new THREE.Group();
    leafPivot.position.y = 1.55 * scale;
    leafPivot.rotation.y = (i * Math.PI * 2) / 6;
    const blade = new THREE.Mesh(leafGeo, mats.bananaLeaf);
    blade.rotation.x = 0.92 + (i % 2) * 0.25;
    leafPivot.add(blade);
    g.add(leafPivot);
  }
  return g;
}

/**
 * Multi-limb Tropical Western Ghats Shola / Rosewood Tree.
 */
function createRealisticSholaTree(
  mats: WayanadMaterialLibrary,
  scale = 1.0,
  seed = 1
): THREE.Group {
  const g = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18 * scale, 0.36 * scale, 3.2 * scale, 9),
    mats.treeTrunk
  );
  trunk.position.y = 1.6 * scale;
  trunk.rotation.z = Math.sin(seed) * 0.06;
  g.add(trunk);

  for (const side of [-1, 1]) {
    const limb = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08 * scale, 0.14 * scale, 1.35 * scale, 7),
      mats.treeTrunk
    );
    limb.position.set(side * 0.42 * scale, 2.7 * scale, 0);
    limb.rotation.z = -side * 0.52;
    g.add(limb);
  }

  const crownSpecs = [
    { x: 0, y: 3.55, z: 0, r: 1.52, sy: 0.62, mat: mats.sholaCanopy },
    { x: -0.78, y: 3.15, z: 0.25, r: 1.12, sy: 0.65, mat: mats.teaFoliage },
    { x: 0.82, y: 3.25, z: -0.2, r: 1.16, sy: 0.62, mat: mats.sholaCanopy },
    { x: 0.1, y: 4.25, z: -0.1, r: 0.98, sy: 0.58, mat: mats.teaFoliage },
  ];
  for (const c of crownSpecs) {
    const leafGeo = createOrganicRockGeometry(
      c.r * scale,
      1,
      seed + c.x * 3,
      c.sy
    );
    const leaf = new THREE.Mesh(leafGeo, c.mat);
    leaf.position.set(c.x * scale, c.y * scale, c.z * scale);
    g.add(leaf);
  }

  enableShadows(g, true, true);
  return g;
}

/**
 * Iconic Kerala Black-and-Yellow 3-Wheeler Autorickshaw ("Auto") parked by roadside tea stalls!
 */
function createKeralaAutorickshaw(mats: WayanadMaterialLibrary): THREE.Group {
  const auto = new THREE.Group();

  // Lower yellow steel body cabin + front cowl
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.26, 0.68, 2.15),
    mats.autoYellow
  );
  body.position.set(0, 0.54, 0);
  auto.add(body);

  const frontNose = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.44, 0.66, 12),
    mats.autoYellow
  );
  frontNose.position.set(0, 0.52, 1.12);
  auto.add(frontNose);

  // Curved black canvas monsoon roof hood
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.68, 1.95),
    mats.autoBlack
  );
  roof.position.set(0, 1.24, -0.06);
  auto.add(roof);

  const roofCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.64, 0.65, 1.95, 12, 1, false, 0, Math.PI),
    mats.autoBlack
  );
  roofCap.rotation.z = Math.PI / 2;
  roofCap.rotation.y = Math.PI / 2;
  roofCap.scale.set(1, 0.25, 1);
  roofCap.position.set(0, 1.58, -0.06);
  auto.add(roofCap);

  // Tinted glass windshield
  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(1.14, 0.52, 0.08),
    mats.vehicleGlass
  );
  windshield.position.set(0, 1.18, 0.92);
  windshield.rotation.x = -0.14;
  auto.add(windshield);

  // Single glowing cyclops headlamp + amber indicators
  const headlamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12),
    mats.headlampGlow
  );
  headlamp.rotation.x = Math.PI / 2;
  headlamp.position.set(0, 0.62, 1.48);
  auto.add(headlamp);

  // 3 Rubber Wheels (1 front, 2 rear)
  const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.16, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [
    [0, 1.18],
    [-0.64, -0.72],
    [0.64, -0.72],
  ]) {
    const w = new THREE.Mesh(wheelGeo, mats.tireRubber);
    w.position.set(wx, 0.24, wz);
    auto.add(w);
  }

  enableShadows(auto, true, true);
  return auto;
}

/**
 * Authentic Wayanad Roadside Village Tea & Spice Stall ("Chayakada")
 * with Mangalore clay-tile roof, blue monsoon tarpaulin, hanging banana bunches,
 * brass samovar, burlap spice sacks, and warm glowing tungsten bulb!
 */
function createWayanadChayakadaStall(mats: WayanadMaterialLibrary): THREE.Group {
  const shop = new THREE.Group();

  // Laterite stepped veranda plinth (flush on ground y=0)
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.36, 4.6),
    mats.lateriteBlock
  );
  plinth.position.set(0, 0.18, 0);
  shop.add(plinth);

  // Whitewashed lime-plaster rear & side walls
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(2.7, 2.25, 4.1),
    mats.limePlaster
  );
  backWall.position.set(-0.2, 1.45, 0);
  shop.add(backWall);

  // Front wooden tea counter facing the highway (+X)
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.92, 3.6),
    mats.rosewood
  );
  counter.position.set(0.95, 0.82, 0);
  shop.add(counter);

  // Gleaming Brass Chaya Samovar on the counter
  const samovar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.13, 0.52, 12),
    mats.brushedBrass
  );
  samovar.position.set(0.98, 1.54, -0.75);
  shop.add(samovar);

  // Hanging bunches of ripe yellow Nendran bananas under the eaves!
  for (const bz of [-1.25, 0.85]) {
    const bunch = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.16, 0.32, 4, 8),
      mats.autoYellow
    );
    bunch.position.set(1.25, 2.1, bz);
    shop.add(bunch);
  }

  // Open Burlap Spice Sacks in front of veranda
  for (let i = 0; i < 3; i++) {
    const sack = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.28, 0.46, 10),
      mats.bambooWood
    );
    sack.position.set(1.52, 0.42, -0.9 + i * 0.72);
    shop.add(sack);
  }

  // Pitched Mangalore Clay-Tile Gable Roof
  for (const side of [-1, 1]) {
    const slope = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.14, 4.9),
      mats.terracottaRoof
    );
    slope.position.set(side * 0.72, 2.92, 0);
    slope.rotation.z = -side * 0.44;
    shop.add(slope);
  }

  // Blue Monsoon Tarpaulin Front Awning
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(1.25, 0.06, 4.5),
    mats.tarpaulinBlue
  );
  awning.position.set(1.58, 2.42, 0);
  awning.rotation.z = -0.28;
  shop.add(awning);

  // Hand-Painted Wayanad Chayakada Signboard facing approaching runner (+Z / +X angled)
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.72, 2.85),
    mats.chayakadaSign
  );
  signBoard.position.set(1.55, 2.95, 0);
  signBoard.rotation.y = 0.22;
  shop.add(signBoard);

  // Warm Glowing Tungsten Shop Bulb
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 10, 8),
    mats.streetLampGlow
  );
  bulb.position.set(1.38, 2.25, 0);
  shop.add(bulb);

  enableShadows(shop, true, true);
  return shop;
}

/**
 * AAA NH-766 Kerala Ghat Highway Chunk (12m length, 12.52m seamless overlap):
 * Detailed wet tarmac, cat's-eye road studs, alternating black/yellow Indian highway kerbs,
 * contoured tea plantations, swaying coconut & banana groves, roadside Chayakada & Autorickshaw,
 * multi-tier waterfalls, volumetric golden sunbeams, and NH-766 signage.
 */
export function createTrackChunk(
  mats: WayanadMaterialLibrary,
  variantIndex: number
): TrackChunkRig {
  const group = new THREE.Group();
  const deckLen = CHUNK_LENGTH + 0.52;
  const hasVillageStall = variantIndex % 4 === 2;

  // 1. Wet 3-Lane NH-766 Macadam Highway Deck + Red Laterite Paved Shoulders
  const shoulderBase = new THREE.Mesh(
    new THREE.BoxGeometry(9.2, 0.86, deckLen),
    mats.lateriteBlock
  );
  shoulderBase.position.y = -0.46;
  shoulderBase.receiveShadow = true;
  group.add(shoulderBase);

  const roadMesh = new THREE.Mesh(
    new THREE.BoxGeometry(7.9, 0.9, deckLen),
    mats.asphaltRoad
  );
  roadMesh.position.y = -0.45;
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // Continuous Thermoplastic White Outer Highway Edge Lines
  const edgeLineGeo = new THREE.PlaneGeometry(0.14, deckLen);
  edgeLineGeo.rotateX(-Math.PI / 2);
  for (const xEdge of [-3.54, 3.54]) {
    const edgeLine = new THREE.Mesh(edgeLineGeo, mats.roadStripe);
    edgeLine.position.set(xEdge, 0.014, 0);
    group.add(edgeLine);
  }

  // Dashed Lane Dividers + Raised Glowing Amber Cat's-Eye Road Studs!
  const dashGeo = new THREE.PlaneGeometry(0.13, 2.35);
  dashGeo.rotateX(-Math.PI / 2);
  const studGeo = new THREE.BoxGeometry(0.13, 0.045, 0.13);

  for (let s = 0; s < 3; s++) {
    const zPos = -CHUNK_LENGTH / 2 + 2.0 + s * 4.0;
    for (const xLine of [-LANE_WIDTH * 0.5, LANE_WIDTH * 0.5]) {
      const stripe = new THREE.Mesh(
        dashGeo,
        s === 1 ? mats.roadYellowStripe : mats.roadStripe
      );
      stripe.position.set(xLine, 0.016, zPos);
      group.add(stripe);

      const stud = new THREE.Mesh(studGeo, mats.catsEyeAmber);
      stud.position.set(xLine, 0.024, zPos + 2.0);
      group.add(stud);
    }
  }

  // Alternating Black-and-Yellow / White-and-Black Indian Highway Kerb Blocks
  const kerbSegGeo = new THREE.BoxGeometry(0.32, 0.2, 1.98);
  for (let k = 0; k < 6; k++) {
    const zk = -CHUNK_LENGTH / 2 + 1.0 + k * 2.0;
    const matL = k % 2 === 0 ? mats.guardStoneOchre : mats.kerbBlack;
    const matR = k % 2 === 0 ? mats.guardStoneWhite : mats.kerbBlack;

    if (!hasVillageStall) {
      const kerbL = new THREE.Mesh(kerbSegGeo, matL);
      kerbL.position.set(-3.92, 0.09, zk);
      group.add(kerbL);
    }

    const kerbR = new THREE.Mesh(kerbSegGeo, matR);
    kerbR.position.set(3.92, 0.09, zk);
    group.add(kerbR);
  }

  // 2. Left Flank: Either Scenic Wayanad Chayakada & Auto Turnout OR Contoured Tea Plantation Terraces!
  if (hasVillageStall) {
    const courtyard = new THREE.Mesh(
      new THREE.BoxGeometry(6.5, 0.85, deckLen),
      mats.lateriteBlock
    );
    courtyard.position.set(-6.9, -0.42, 0);
    courtyard.receiveShadow = true;
    group.add(courtyard);

    const chayakada = createWayanadChayakadaStall(mats);
    chayakada.position.set(-6.95, 0, -1.2);
    group.add(chayakada);

    const parkedAuto = createKeralaAutorickshaw(mats);
    parkedAuto.position.set(-5.35, 0, 3.35);
    parkedAuto.rotation.y = 0.35;
    group.add(parkedAuto);

    const palmL = createKeralaCoconutPalm(mats, 1.02, 0.45);
    palmL.position.set(-9.1, 0, 3.8);
    group.add(palmL);

    const bananaL = createTropicalBananaPlant(mats, 1.05);
    bananaL.position.set(-8.6, 0, -4.4);
    group.add(bananaL);
  } else {
    const leftRetainingWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 1.55, deckLen),
      mats.lateriteBlock
    );
    leftRetainingWall.position.set(-4.42, 0.62, 0);
    leftRetainingWall.castShadow = true;
    leftRetainingWall.receiveShadow = true;
    group.add(leftRetainingWall);

    // Contoured Meppadi Tea Plantation Steps + Rounded Tea Bush Hedgerows
    const terrace1 = new THREE.Mesh(
      new THREE.BoxGeometry(7.8, 2.5, deckLen),
      mats.teaFoliage
    );
    terrace1.position.set(-8.5, 1.15, 0);
    terrace1.receiveShadow = true;
    group.add(terrace1);

    for (let r = 0; r < 2; r++) {
      const hedge = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.68, deckLen - 1.2, 4, 8),
        mats.teaFoliage
      );
      hedge.rotation.x = Math.PI / 2;
      hedge.position.set(-5.8 - r * 2.1, 2.45 + r * 0.55, 0);
      group.add(hedge);
    }

    const terrace2 = new THREE.Mesh(
      new THREE.BoxGeometry(10.0, 6.2, deckLen),
      mats.mossTurf
    );
    terrace2.position.set(-16.2, 3.4, 0);
    terrace2.receiveShadow = true;
    group.add(terrace2);

    const treeL = createRealisticSholaTree(
      mats,
      0.95 + (variantIndex % 3) * 0.16,
      variantIndex * 3.1
    );
    treeL.position.set(-6.6, 2.45, variantIndex % 2 === 0 ? -2.6 : 2.6);
    group.add(treeL);

    if (variantIndex % 2 === 0) {
      const palmHill = createKeralaCoconutPalm(mats, 0.92, 0.5);
      palmHill.position.set(-5.8, 2.35, 3.2);
      group.add(palmHill);
    }
  }

  // Curved Galvanized Ghat Highway Streetlamp
  if (variantIndex % 3 === 0) {
    const lampGroup = new THREE.Group();
    lampGroup.position.set(-4.25, 1.38, -2.0);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 4.3, 8),
      mats.galvanizedSteel
    );
    pole.position.y = 2.15;
    lampGroup.add(pole);

    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.055, 1.65, 8),
      mats.galvanizedSteel
    );
    arm.position.set(0.7, 4.22, 0);
    arm.rotation.z = -1.22;
    lampGroup.add(arm);

    const bulb = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.13, 0.25),
      mats.streetLampGlow
    );
    bulb.position.set(1.42, 4.38, 0);
    lampGroup.add(bulb);
    group.add(lampGroup);
  }

  // 3. Right Flank: Valley Cliff Edge, W-Beam Crash Guardrail, Coconut Palms & Banana Groves
  const wBeamUpper = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.25, deckLen),
    mats.galvanizedSteel
  );
  wBeamUpper.position.set(4.12, 0.72, 0);
  wBeamUpper.castShadow = true;
  group.add(wBeamUpper);

  for (let p = 0; p < 3; p++) {
    const zPost = -CHUNK_LENGTH / 2 + 2.0 + p * 4.0;
    const steelPost = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.88, 0.12),
      mats.galvanizedSteel
    );
    steelPost.position.set(4.18, 0.44, zPost);
    group.add(steelPost);

    const reflector = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.1, 0.1),
      mats.reflectorRed
    );
    reflector.position.set(4.06, 0.72, zPost);
    group.add(reflector);
  }

  // Authentic Indian Yellow-Domed Kilometer Milestone Stone on Shoulder
  if (variantIndex % 3 === 2) {
    const kmGroup = new THREE.Group();
    kmGroup.position.set(4.42, 0, -3.5);
    const kmBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.56, 0.16),
      mats.guardStoneWhite
    );
    kmBase.position.y = 0.28;
    kmGroup.add(kmBase);
    const kmTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.21, 0.16, 12, 1, false, 0, Math.PI),
      mats.guardStoneOchre
    );
    kmTop.rotation.x = Math.PI / 2;
    kmTop.rotation.z = Math.PI / 2;
    kmTop.position.y = 0.56;
    kmGroup.add(kmTop);
    group.add(kmGroup);
  }

  // Sloping Meppadi Valley Tea Estate Drop-Off + Coconut Palms on Right
  const valleySlope = new THREE.Mesh(
    new THREE.BoxGeometry(12.0, 2.8, deckLen),
    mats.teaFoliage
  );
  valleySlope.position.set(10.2, -1.7, 0);
  valleySlope.rotation.z = -0.19;
  group.add(valleySlope);

  if (variantIndex % 2 === 0) {
    const palmR = createKeralaCoconutPalm(mats, 1.08, -0.55);
    palmR.position.set(6.4, -0.85, -1.8);
    group.add(palmR);

    const bananaR = createTropicalBananaPlant(mats, 1.1);
    bananaR.position.set(5.4, -0.45, 2.6);
    group.add(bananaR);
  } else {
    const treeR = createRealisticSholaTree(mats, 1.08, variantIndex * 5.7);
    treeR.position.set(6.9, -0.85, 1.2);
    group.add(treeR);
  }

  // 4. NH-766 Green Destination Signboard OR Orange Convex Hairpin Mirror
  let highwaySignMesh: THREE.Mesh | null = null;
  if (variantIndex % 4 === 1) {
    const signGroup = new THREE.Group();
    signGroup.position.set(4.95, 0, -1.5);
    for (const px of [-0.95, 0.95]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 2.85, 8),
        mats.galvanizedSteel
      );
      leg.position.set(px, 1.42, 0);
      signGroup.add(leg);
    }
    const signIdx = variantIndex % mats.highwaySignMats.length;
    highwaySignMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.55, 1.28, 0.08),
      mats.highwaySignMats[signIdx]
    );
    highwaySignMesh.position.set(0, 2.48, 0);
    highwaySignMesh.rotation.y = -0.18;
    signGroup.add(highwaySignMesh);
    group.add(signGroup);
  } else if (variantIndex % 4 === 3) {
    const mirrorGroup = new THREE.Group();
    mirrorGroup.position.set(4.62, 0, 0);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.06, 2.75, 8),
      mats.guardStoneOchre
    );
    pole.position.y = 1.375;
    mirrorGroup.add(pole);

    const bezel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.48, 0.08, 18),
      mats.convexMirrorFrame
    );
    bezel.rotation.x = Math.PI / 2;
    bezel.rotation.z = 0.35;
    bezel.position.set(0, 2.65, 0);
    mirrorGroup.add(bezel);

    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.38),
      mats.convexMirrorLens
    );
    lens.rotation.x = Math.PI / 2;
    lens.rotation.z = 0.35;
    lens.position.set(-0.08, 2.65, 0.06);
    mirrorGroup.add(lens);
    group.add(mirrorGroup);
  }

  const chevronGroup = new THREE.Group();
  chevronGroup.position.set(4.55, 0, 3.2);
  const cPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 1.65, 6),
    mats.galvanizedSteel
  );
  cPost.position.y = 0.82;
  chevronGroup.add(cPost);
  const cBoard = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.58, 0.06),
    mats.chevronBoard
  );
  cBoard.position.y = 1.48;
  cBoard.rotation.y = -0.28;
  chevronGroup.add(cBoard);
  chevronGroup.visible = variantIndex % 2 === 0;
  group.add(chevronGroup);

  // 5. Multi-Tier Cascading Soochipara Waterfall with Rock Ledges & Churning Foam Mist!
  const waterfallRibbon = new THREE.Group();
  waterfallRibbon.position.set(-10.2, 0, 0);

  const cliffBackdrop = new THREE.Mesh(
    createOrganicRockGeometry(3.4, 1, variantIndex * 1.9, 2.3),
    mats.graniteRock
  );
  cliffBackdrop.position.set(-1.4, 5.2, 0);
  waterfallRibbon.add(cliffBackdrop);

  const upperCascade = new THREE.Mesh(
    new THREE.PlaneGeometry(3.9, 9.8),
    mats.kabiniWater
  );
  upperCascade.position.set(0.3, 5.2, 0);
  upperCascade.rotation.y = Math.PI * 0.44;
  waterfallRibbon.add(upperCascade);

  const splashCloud = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 3.2),
    mats.mistRibbon
  );
  splashCloud.position.set(1.2, 2.4, 0);
  splashCloud.rotation.y = Math.PI * 0.38;
  waterfallRibbon.add(splashCloud);

  waterfallRibbon.visible = !hasVillageStall && variantIndex % 3 === 0;
  group.add(waterfallRibbon);

  // Edakkal Prehistoric Petroglyph Crag
  const edakkalSpire = new THREE.Group();
  edakkalSpire.position.set(-8.8, 2.4, 1.5);
  const spireRock = new THREE.Mesh(
    createOrganicRockGeometry(2.5, 1, variantIndex * 2.1, 1.65),
    mats.graniteRock
  );
  edakkalSpire.add(spireRock);
  const glyphSlab = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 2.4, 2.1),
    mats.petroglyphWall
  );
  glyphSlab.position.set(1.65, 0.1, 0);
  edakkalSpire.add(glyphSlab);
  edakkalSpire.visible = !hasVillageStall && variantIndex % 3 === 1;
  group.add(edakkalSpire);

  // 6. Volumetric Golden Forest Sunbeam God-Rays!
  const sunbeamGroup = new THREE.Group();
  if (variantIndex % 3 === 1) {
    const ray1 = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 12.5),
      mats.sunbeamRay
    );
    ray1.position.set(1.2, 5.8, -1.5);
    ray1.rotation.z = -0.46;
    ray1.rotation.y = 0.25;
    sunbeamGroup.add(ray1);

    const ray2 = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 11.0),
      mats.sunbeamRay
    );
    ray2.position.set(-1.8, 5.4, 2.2);
    ray2.rotation.z = -0.46;
    ray2.rotation.y = -0.2;
    sunbeamGroup.add(ray2);
  }
  group.add(sunbeamGroup);

  // 7. Volumetric Drifting Mountain Mist Plane
  const mistPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(9.8, 3.6),
    mats.mistRibbon
  );
  mistPlane.position.set(((variantIndex % 3) - 1) * 2.5, 1.65, 0);
  mistPlane.visible = variantIndex % 2 === 0;
  group.add(mistPlane);

  return {
    group,
    zCenter: 0,
    waterfallRibbon,
    edakkalSpire,
    highwaySignMesh,
    chevronGroup,
    sunbeamGroup,
    mistPlane,
    mistPhase: variantIndex * 1.37,
  };
}

/**
 * Multi-layered Western Ghats Mountain Range Amphitheater & Instanced Shola Forest.
 */
export function createDistantGhatsBackdrop(
  mats: WayanadMaterialLibrary
): THREE.Group {
  const backdrop = new THREE.Group();

  const valleyFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420),
    mats.mossTurf
  );
  valleyFloor.rotation.x = -Math.PI / 2;
  valleyFloor.position.y = -12.0;
  backdrop.add(valleyFloor);

  // Sculpted Western Ghats Mountain Peaks (Chembra Peak, Banasura Hill, Vellarimala)
  const peakSpecs = [
    { x: -72, y: -8, z: -148, r: 40, sy: 1.6, seed: 1.1 },
    { x: -22, y: -8, z: -172, r: 52, sy: 1.72, seed: 2.4 },
    { x: 38, y: -10, z: -162, r: 46, sy: 1.55, seed: 3.8 },
    { x: 88, y: -11, z: -135, r: 40, sy: 1.4, seed: 5.2 },
    { x: 64, y: -10, z: -74, r: 30, sy: 1.35, seed: 6.7 },
    { x: -68, y: -6, z: -76, r: 32, sy: 1.48, seed: 8.1 },
  ];

  for (const p of peakSpecs) {
    const mtnGeo = createOrganicRockGeometry(p.r, 2, p.seed, p.sy);
    const mtn = new THREE.Mesh(mtnGeo, mats.sholaCanopy);
    mtn.position.set(p.x, p.y + p.r * 0.45, p.z);
    backdrop.add(mtn);
  }

  // Instanced valley Shola forest canopies (110 trees with natural emerald variation)
  const canopyGeo = createOrganicRockGeometry(2.4, 1, 4.2, 0.78);
  const instTrees = new THREE.InstancedMesh(canopyGeo, mats.sholaCanopy, 110);
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  for (let i = 0; i < 110; i++) {
    const leftSide = i % 2 === 0;
    const x = leftSide ? -22 - ((i * 17) % 36) : 18 + ((i * 19) % 44);
    const z = -170 + ((i * 23) % 190);
    const y = leftSide ? 4.2 + ((i * 7) % 9) : -4.8 - ((i * 5) % 5);
    const s = 0.85 + ((i * 13) % 38) / 100;

    dummy.position.set(x, y, z);
    dummy.scale.set(s * 1.15, s * 0.92, s * 1.15);
    dummy.rotation.y = i * 0.7;
    dummy.updateMatrix();
    instTrees.setMatrixAt(i, dummy.matrix);

    tint.setHSL(0.35 + ((i % 5) - 2) * 0.015, 0.5, 0.22 + (i % 4) * 0.042);
    instTrees.setColorAt(i, tint);
  }
  instTrees.instanceMatrix.needsUpdate = true;
  if (instTrees.instanceColor) instTrees.instanceColor.needsUpdate = true;
  instTrees.computeBoundingSphere();
  backdrop.add(instTrees);

  return backdrop;
}

/**
 * Ambient Tropical Malabar Pied Hornbill / Hill Bird Flock soaring across the mountain valley.
 */
export function createGlidingBirds(
  mats: WayanadMaterialLibrary,
  count = 6
): GlidingBirdRig[] {
  const birds: GlidingBirdRig[] = [];
  const wingGeo = new THREE.BoxGeometry(0.62, 0.03, 0.24);
  wingGeo.translate(0.31, 0, 0);

  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.08, 0.34, 4, 8),
      mats.autoBlack
    );
    body.rotation.x = Math.PI / 2;
    group.add(body);

    const beak = new THREE.Mesh(
      new THREE.ConeGeometry(0.055, 0.24, 6),
      mats.autoYellow
    );
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.03, 0.28);
    group.add(beak);

    const leftWing = new THREE.Group();
    const lwMesh = new THREE.Mesh(wingGeo, mats.guardStoneWhite);
    lwMesh.scale.x = -1;
    leftWing.add(lwMesh);
    group.add(leftWing);

    const rightWing = new THREE.Group();
    const rwMesh = new THREE.Mesh(wingGeo, mats.guardStoneWhite);
    rightWing.add(rwMesh);
    group.add(rightWing);

    birds.push({
      group,
      leftWing,
      rightWing,
      baseX: (i - count / 2) * 5.5,
      baseY: 9.5 + (i % 3) * 2.2,
      baseZ: -38 - i * 16,
      speed: 5.5 + (i % 3) * 1.4,
      phase: i * 1.3,
    });
  }
  return birds;
}

/**
 * Stalled Classic Kerala KSRTC "Aanavandi" Red-and-Ivory Ghat Mini-Bus Obstacle!
 * Fits cleanly inside a single highway lane (width ~1.76m) for crisp Subway Surfers-style lane dodging.
 */
function buildKsrtcBusObstacle(mats: WayanadMaterialLibrary): THREE.Group {
  const bus = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.05, 2.65),
    mats.contactShadow
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  bus.add(shadow);

  // Lower crimson body + upper ivory cabin
  const lowerHull = new THREE.Mesh(
    new THREE.BoxGeometry(1.74, 1.15, 2.25),
    mats.ksrtcRed
  );
  lowerHull.position.set(0, 0.82, -0.05);
  bus.add(lowerHull);

  const upperCabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.72, 0.95, 2.2),
    mats.ksrtcIvory
  );
  upperCabin.position.set(0, 1.84, -0.06);
  bus.add(upperCabin);

  // Authentic KSRTC Front Face with KALPETTA destination board, windshield, grille & KL-12 plate
  const frontFace = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 2.02),
    mats.ksrtcFront
  );
  frontFace.position.set(0, 1.28, 1.09);
  bus.add(frontFace);

  // Side tinted passenger windows
  for (const side of [-0.87, 0.87]) {
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(1.85, 0.56),
      mats.vehicleGlass
    );
    win.position.set(side, 1.82, -0.08);
    win.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    bus.add(win);
  }

  // Curved steel roof + luggage carrier rack
  const roofCap = new THREE.Mesh(
    new THREE.BoxGeometry(1.62, 0.12, 2.1),
    mats.ksrtcRed
  );
  roofCap.position.set(0, 2.36, -0.06);
  bus.add(roofCap);

  const rack = new THREE.Mesh(
    new THREE.BoxGeometry(1.36, 0.14, 1.5),
    mats.galvanizedSteel
  );
  rack.position.set(0, 2.48, -0.15);
  bus.add(rack);

  // Chrome front bumper + Glowing Headlamps + Amber Hazard Lights
  const bumper = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.18, 0.16),
    mats.galvanizedSteel
  );
  bumper.position.set(0, 0.34, 1.12);
  bus.add(bumper);

  for (const side of [-0.62, 0.62]) {
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.06, 12),
      mats.headlampGlow
    );
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(side, 0.64, 1.11);
    bus.add(lamp);

    const blinker = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.09, 0.06),
      mats.catsEyeAmber
    );
    blinker.position.set(side * 1.12, 0.48, 1.11);
    bus.add(blinker);
  }

  // 4 Heavy Rubber Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [
    [-0.82, 0.64],
    [0.82, 0.64],
    [-0.82, -0.68],
    [0.82, -0.68],
  ]) {
    const w = new THREE.Mesh(wheelGeo, mats.tireRubber);
    w.position.set(wx, 0.32, wz);
    bus.add(w);
  }

  enableShadows(bus, true, true);
  return bus;
}

/**
 * AAA Obstacles, Animals & Vehicles (Exact same 5 ObstacleKind collision dimensions & rules!).
 */
export function createObstacleMesh(
  kind: ObstacleKind,
  mats: WayanadMaterialLibrary
): {
  group: THREE.Group;
  animPivot?: THREE.Object3D;
  secondaryPivot?: THREE.Object3D;
} {
  const group = new THREE.Group();

  switch (kind) {
    case ObstacleKind.JumpHurdle: {
      // Kerala PWD Reflective Roadwork Barricade + Fallen Mossy Rosewood Trunk + Glowing Hazard Beacons
      for (const side of [-0.78, 0.78]) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.13, 0.9, 0.46),
          mats.galvanizedSteel
        );
        leg.position.set(side, 0.45, 0.14);
        group.add(leg);

        const beacon = new THREE.Mesh(
          new THREE.CylinderGeometry(0.075, 0.085, 0.12, 10),
          mats.catsEyeAmber
        );
        beacon.position.set(side, 0.94, 0.14);
        group.add(beacon);
      }

      const chevronPlank = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.34, 0.1),
        mats.chevronBoard
      );
      chevronPlank.position.set(0, 0.72, 0.16);
      group.add(chevronPlank);

      const lowerPlank = new THREE.Mesh(
        new THREE.BoxGeometry(1.86, 0.16, 0.08),
        mats.guardStoneWhite
      );
      lowerPlank.position.set(0, 0.38, 0.16);
      group.add(lowerPlank);

      const fallenLog = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.28, 1.96, 12),
        mats.rosewood
      );
      fallenLog.rotation.z = Math.PI / 2;
      fallenLog.position.set(0, 0.26, -0.24);
      group.add(fallenLog);

      enableShadows(group, true, true);
      return { group };
    }

    case ObstacleKind.SlideArch: {
      // Wayanad Carved Timber Temple/Forest Archway & NH-766 Gantry with Swaying Brass Bells & Banyan Roots
      for (const side of [-0.94, 0.94]) {
        const stoneBase = new THREE.Mesh(
          new THREE.BoxGeometry(0.34, 0.48, 0.42),
          mats.lateriteBlock
        );
        stoneBase.position.set(side, 0.24, 0);
        group.add(stoneBase);

        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.13, 0.15, 2.55, 10),
          mats.rosewood
        );
        pillar.position.set(side, 1.48, 0);
        group.add(pillar);
      }

      // Overhead Green Highway Sign Beam + Ornate Terracotta Eave Roof (y = 1.24 .. 2.85)
      const signBeam = new THREE.Mesh(
        new THREE.BoxGeometry(2.16, 0.92, 0.32),
        mats.highwaySignMats[0]
      );
      signBeam.position.set(0, 1.76, 0.08);
      group.add(signBeam);

      const archRoof = new THREE.Mesh(
        new THREE.BoxGeometry(2.42, 0.22, 0.68),
        mats.terracottaRoof
      );
      archRoof.position.set(0, 2.42, 0.02);
      group.add(archRoof);

      const banyanBranch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.24, 2.3, 10),
        mats.treeTrunk
      );
      banyanBranch.rotation.z = Math.PI / 2;
      banyanBranch.position.set(0, 2.66, -0.05);
      group.add(banyanBranch);

      const foliageCluster = new THREE.Mesh(
        createOrganicRockGeometry(0.76, 1, 2.8, 0.52),
        mats.sholaCanopy
      );
      foliageCluster.position.set(0, 2.92, 0);
      group.add(foliageCluster);

      // Swaying Brass Temple Bells & Red Reflectors underneath (clear below y = 1.18m!)
      const chainPivot = new THREE.Group();
      chainPivot.position.set(0, 1.28, 0.08);
      for (const xLink of [-0.52, 0, 0.52]) {
        const bell = new THREE.Mesh(
          new THREE.ConeGeometry(0.085, 0.14, 10),
          mats.brushedBrass
        );
        bell.position.set(xLink, -0.05, 0);
        chainPivot.add(bell);

        const reflector = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 0.06, 0.05),
          mats.reflectorRed
        );
        reflector.position.set(xLink, 0.03, 0.08);
        chainPivot.add(reflector);
      }
      group.add(chainPivot);

      enableShadows(group, true, true);
      return { group, animPivot: chainPivot };
    }

    case ObstacleKind.SolidMonolith: {
      // Alternates between Stalled Kerala KSRTC "Aanavandi" Ghat Bus AND Ancient Edakkal Petroglyph Monolith!
      monolithPoolCounter++;
      if (monolithPoolCounter % 2 === 0) {
        const ksrtcBus = buildKsrtcBusObstacle(mats);
        group.add(ksrtcBus);
        return { group };
      }

      const rubbleBase = new THREE.Mesh(
        createOrganicRockGeometry(0.96, 1, 7.1, 0.45),
        mats.lateriteBlock
      );
      rubbleBase.position.y = 0.32;
      group.add(rubbleBase);

      const mainBoulder = new THREE.Mesh(
        createOrganicRockGeometry(1.04, 2, 3.9, 1.5),
        mats.graniteRock
      );
      mainBoulder.scale.set(0.86, 1.05, 0.78);
      mainBoulder.position.y = 1.5;
      group.add(mainBoulder);

      const petroglyphFace = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 1.25, 0.14),
        mats.petroglyphWall
      );
      petroglyphFace.position.set(0, 1.45, 0.68);
      group.add(petroglyphFace);

      const warnBoard = new THREE.Mesh(
        new THREE.BoxGeometry(0.74, 0.32, 0.06),
        mats.chevronBoard
      );
      warnBoard.position.set(0, 0.58, 0.82);
      group.add(warnBoard);

      enableShadows(group, true, true);
      return { group };
    }

    case ObstacleKind.WildTusker: {
      // Majestic Sculpted Wayanad Wild Asian Elephant (Tusker) with Articulated Head/Trunk & Ears
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 2.75),
        mats.contactShadow
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.02;
      group.add(shadow);

      // Arched elephant back & barrel ribcage
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.86, 18, 14),
        mats.tuskerSkin
      );
      body.scale.set(0.94, 0.92, 1.34);
      body.position.set(0, 1.36, -0.14);
      group.add(body);

      const hindQuarters = new THREE.Mesh(
        new THREE.SphereGeometry(0.72, 14, 12),
        mats.tuskerSkin
      );
      hindQuarters.position.set(0, 1.28, -0.68);
      group.add(hindQuarters);

      const tail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.02, 0.72, 6),
        mats.tuskerSkin
      );
      tail.position.set(0, 0.96, -1.36);
      tail.rotation.x = -0.18;
      group.add(tail);

      for (const [lx, lz] of [
        [-0.43, 0.48],
        [0.43, 0.48],
        [-0.42, -0.65],
        [0.42, -0.65],
      ]) {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.21, 0.23, 0.98, 12),
          mats.tuskerSkin
        );
        leg.position.set(lx, 0.49, lz);
        group.add(leg);
      }

      const headPivot = new THREE.Group();
      headPivot.position.set(0, 1.68, 0.8);

      // Twin-domed Asian elephant forehead
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.56, 16, 14),
        mats.tuskerSkin
      );
      headPivot.add(head);

      for (const side of [-1, 1]) {
        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(0.26, 10, 8),
          mats.tuskerSkin
        );
        dome.position.set(side * 0.18, 0.34, 0.08);
        headPivot.add(dome);

        const ear = new THREE.Mesh(
          new THREE.SphereGeometry(0.46, 12, 10),
          mats.tuskerSkin
        );
        ear.scale.set(0.18, 1.12, 0.88);
        ear.position.set(side * 0.58, 0.04, -0.06);
        ear.rotation.y = -side * 0.38;
        headPivot.add(ear);

        // Curved gleaming ivory tusks!
        const tuskCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(side * 0.24, -0.16, 0.35),
          new THREE.Vector3(side * 0.28, -0.34, 0.68),
          new THREE.Vector3(side * 0.22, -0.18, 0.98),
        ]);
        const tusk = new THREE.Mesh(
          new THREE.TubeGeometry(tuskCurve, 10, 0.058, 8, false),
          mats.tuskerIvory
        );
        headPivot.add(tusk);
      }

      // Curved multi-segment trunk
      const trunkPivot = new THREE.Group();
      trunkPivot.position.set(0, -0.12, 0.44);
      const trunkCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, -0.38, 0.22),
        new THREE.Vector3(0, -0.78, 0.28),
        new THREE.Vector3(0, -0.92, 0.48),
      ]);
      const trunkMesh = new THREE.Mesh(
        new THREE.TubeGeometry(trunkCurve, 12, 0.12, 10, false),
        mats.tuskerSkin
      );
      trunkPivot.add(trunkMesh);
      headPivot.add(trunkPivot);

      group.add(headPivot);
      enableShadows(group, true, true);
      return { group, animPivot: headPivot, secondaryPivot: trunkPivot };
    }

    case ObstacleKind.GorgeGap: {
      // Collapsed Laterite Bridge Culvert over a Foaming Turquoise Mountain Torrent
      const darkVoid = new THREE.Mesh(
        new THREE.BoxGeometry(2.06, 0.16, 3.32),
        mats.basinRimStone
      );
      darkVoid.position.y = -0.03;
      group.add(darkVoid);

      const rushingWater = new THREE.Mesh(
        new THREE.PlaneGeometry(1.94, 3.08),
        mats.kabiniWater
      );
      rushingWater.rotation.x = -Math.PI / 2;
      rushingWater.position.y = 0.058;
      group.add(rushingWater);

      for (const zEdge of [-1.66, 1.66]) {
        const sill = new THREE.Mesh(
          new THREE.BoxGeometry(2.1, 0.26, 0.3),
          mats.lateriteBlock
        );
        sill.position.set(0, 0.12, zEdge);
        group.add(sill);
      }

      const lipWarn = new THREE.Mesh(
        new THREE.BoxGeometry(1.88, 0.16, 0.08),
        mats.chevronBoard
      );
      lipWarn.position.set(0, 0.3, 1.68);
      group.add(lipWarn);

      return { group, animPivot: rushingWater };
    }
  }
}

export function createPowerupMesh(
  kind: PowerupKind,
  mats: WayanadMaterialLibrary
): { group: THREE.Group; spinner: THREE.Group } {
  const group = new THREE.Group();
  const spinner = new THREE.Group();
  group.add(spinner);

  const outerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.46, 0.055, 8, 24),
    mats.brushedBrass
  );
  spinner.add(outerRing);

  const coreMat =
    kind === PowerupKind.CoinMagnet ? mats.magnetGlowCyan : mats.boostGlowAmber;

  const coreGem = new THREE.Mesh(
    kind === PowerupKind.CoinMagnet
      ? new THREE.OctahedronGeometry(0.28, 0)
      : new THREE.DodecahedronGeometry(0.28, 0),
    coreMat
  );
  spinner.add(coreGem);

  const topCap = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.2, 6),
    mats.goldCoin
  );
  topCap.position.y = 0.44;
  spinner.add(topCap);

  return { group, spinner };
}
