// ═══════════════════════════════════════════════════════════════
// MOTEUR 3D TÔLERIE — Three.js Engine
// 39: Animation pliage, 40: Collision, 43: STEP export
// 44: Vue éclatée, 45: PBR matériaux, 46: Mesure 3D, 49: AR
// ═══════════════════════════════════════════════════════════════

import type { PieceConfig, Pli, Matiere } from './tolerie';
import { MATIERES } from './tolerie';

// ═══ Types 3D ═══

export interface Segment3D {
  fromX: number; fromZ: number; toX: number; toZ: number;
  length: number; pliIndex: number; // -1 = after last pli
}

export interface FoldedSegment extends Segment3D {
  angleCumul: number; // angle cumulé pour animation
}

export interface CollisionResult {
  hasCollision: boolean;
  collisions: { segA: number; segB: number; point: { x: number; z: number } }[];
}

// ═══ PBR Material Configs (45) ═══

export const PBR_MATERIALS: Record<Matiere, { color: number; metalness: number; roughness: number; envIntensity: number; name: string }> = {
  acier: { color: 0x8B8D8F, metalness: 0.8, roughness: 0.45, envIntensity: 0.6, name: 'Acier DC01' },
  inox304: { color: 0xC0C0C8, metalness: 0.9, roughness: 0.2, envIntensity: 0.9, name: 'Inox 304 brossé' },
  inox316: { color: 0xD0D0D8, metalness: 0.95, roughness: 0.15, envIntensity: 1.0, name: 'Inox 316L poli' },
  aluminium: { color: 0xDDE2E8, metalness: 0.85, roughness: 0.3, envIntensity: 0.8, name: 'Alu 5754 anodisé' },
  galvanise: { color: 0xA8B0B8, metalness: 0.7, roughness: 0.55, envIntensity: 0.5, name: 'Galva mat' },
};

// ═══ Calcul segments plats et pliés ═══

export function computeSegments(p: PieceConfig): Segment3D[] {
  const plis = [...p.plis].sort((a, b) => a.position - b.position);
  const segs: Segment3D[] = [];
  let last = 0;

  plis.forEach((pli, i) => {
    const len = pli.position - last;
    if (len > 0.1) segs.push({ fromX: last, fromZ: 0, toX: pli.position, toZ: 0, length: len, pliIndex: i });
    last = pli.position;
  });
  const remaining = p.largeur - last;
  if (remaining > 0.1) segs.push({ fromX: last, fromZ: 0, toX: p.largeur, toZ: 0, length: remaining, pliIndex: plis.length });

  return segs;
}

/**
 * Feature 39: Calcule les positions 3D des segments pour un ratio d'animation [0,1]
 * ratio=0 → tôle plate, ratio=1 → pièce pliée
 */
export function computeFoldedPositions(p: PieceConfig, ratio: number): { x: number; z: number; angle: number }[] {
  const plis = [...p.plis].sort((a, b) => a.position - b.position);
  const segs = computeSegments(p);
  const positions: { x: number; z: number; angle: number }[] = [];

  let px = 0, pz = 0, dxDir = 1, dzDir = 0, cumAngle = 0;

  segs.forEach((seg, i) => {
    const nx = px + dxDir * seg.length;
    const nz = pz + dzDir * seg.length;
    positions.push({ x: px, z: pz, angle: cumAngle });
    px = nx; pz = nz;

    // Appliquer le pli si il y en a un après ce segment
    if (i < plis.length) {
      const pli = plis[i];
      const animAngle = pli.angle * ratio; // interpoler l'angle
      const rad = (animAngle * Math.PI / 180) * (pli.direction === 'haut' ? -1 : 1);
      cumAngle += animAngle * (pli.direction === 'haut' ? -1 : 1);
      const ndx = dxDir * Math.cos(rad) - dzDir * Math.sin(rad);
      const ndz = dxDir * Math.sin(rad) + dzDir * Math.cos(rad);
      dxDir = ndx; dzDir = ndz;
    }
  });

  return positions;
}

/**
 * Feature 40: Détection de collision après pliage
 * Vérifie si des segments se chevauchent dans l'espace 3D
 */
export function detectCollisions(p: PieceConfig): CollisionResult {
  const positions = computeFoldedPositions(p, 1.0);
  const plis = [...p.plis].sort((a, b) => a.position - b.position);
  const segs = computeSegments(p);
  const collisions: CollisionResult['collisions'] = [];

  // Pour chaque paire de segments non adjacents
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 2; j < positions.length; j++) {
      const pi = positions[i], pj = positions[j];
      const si = segs[i], sj = segs[j];
      if (!si || !sj) continue;

      // Calculer les endpoints des segments dans l'espace 3D
      const ai = pi, bi = computeEndpoint(pi, si.length, pi.angle);
      const aj = pj, bj = computeEndpoint(pj, sj.length, pj.angle);

      // Test d'intersection de segments 2D (projection XZ)
      const inter = segmentsIntersect(ai.x, ai.z, bi.x, bi.z, aj.x, aj.z, bj.x, bj.z);
      if (inter) {
        collisions.push({ segA: i, segB: j, point: inter });
      }
    }
  }

  return { hasCollision: collisions.length > 0, collisions };
}

function computeEndpoint(start: { x: number; z: number }, length: number, angleDeg: number) {
  const rad = angleDeg * Math.PI / 180;
  return { x: start.x + length * Math.cos(rad), z: start.z + length * Math.sin(rad) };
}

function segmentsIntersect(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number): { x: number; z: number } | null {
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (Math.abs(d) < 0.001) return null;
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = -((x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1)) / d;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return { x: x1 + t * (x2 - x1), z: y1 + t * (y2 - y1) };
  }
  return null;
}

// ═══════════════════════════════════════════════════
// Feature 43: Export STEP (AP214 simplified)
// ═══════════════════════════════════════════════════

export function genererSTEP(p: PieceConfig): string {
  const positions = computeFoldedPositions(p, 1.0);
  const segs = computeSegments(p);
  const ep = p.epaisseur, h = p.hauteur;
  const lines: string[] = [];
  const w = (s: string) => lines.push(s);

  // STEP Header
  w('ISO-10303-21;');
  w('HEADER;');
  w(`FILE_DESCRIPTION(('AuvergneTech Tolerie'),'2;1');`);
  w(`FILE_NAME('${p.reference}.step','${new Date().toISOString()}',('AuvergneTech'),('Auvergne Ascenseurs'),'','AuvergneTech','');`);
  w("FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));");
  w('ENDSEC;');
  w('DATA;');

  // Product definition
  let id = 1;
  const pid = () => `#${id++}`;

  // Application context
  const ctxId = pid(); w(`${ctxId}=APPLICATION_CONTEXT('AuvergneTech');`);
  const pctxId = pid(); w(`${pctxId}=APPLICATION_PROTOCOL_DEFINITION('','automotive_design',2003,${ctxId});`);
  const prodId = pid(); w(`${prodId}=PRODUCT('${p.reference}','${p.nom}','',(${pid()}));`);
  w(`#${id - 1}=PRODUCT_CONTEXT('',${ctxId},'');`);

  // Pour chaque segment plié, créer un CLOSED_SHELL
  segs.forEach((seg, i) => {
    const pos = positions[i];
    if (!pos) return;
    const rad = pos.angle * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);

    // 8 vertices de la boîte
    const verts = [
      [pos.x, 0, pos.z],
      [pos.x + cos * seg.length, 0, pos.z + sin * seg.length],
      [pos.x + cos * seg.length, h, pos.z + sin * seg.length],
      [pos.x, h, pos.z],
      [pos.x, 0, pos.z + ep],
      [pos.x + cos * seg.length, 0, pos.z + sin * seg.length + ep],
      [pos.x + cos * seg.length, h, pos.z + sin * seg.length + ep],
      [pos.x, h, pos.z + ep],
    ];

    // CARTESIAN_POINT for each vertex
    const ptIds = verts.map(v => {
      const cid = pid();
      w(`${cid}=CARTESIAN_POINT('',(${v[0].toFixed(3)},${v[1].toFixed(3)},${v[2].toFixed(3)}));`);
      return cid;
    });

    // Simple B_REP_WITH_VOIDS representation
    const shellId = pid();
    w(`${shellId}=CLOSED_SHELL('Segment_${i}',()); /* simplified */`);
  });

  // Trous
  p.trous.forEach((t, i) => {
    const cid = pid();
    w(`${cid}=CARTESIAN_POINT('Hole_${i}',(${t.x.toFixed(3)},${t.y.toFixed(3)},0.000));`);
    const cylId = pid();
    w(`${cylId}=CYLINDRICAL_SURFACE('',${pid()},${(t.diametre / 2).toFixed(3)});`);
    w(`#${id - 1}=AXIS2_PLACEMENT_3D('',${cid},${pid()},${pid()});`);
    w(`#${id - 1}=DIRECTION('',(0.,0.,1.));`);
    w(`#${id - 1}=DIRECTION('',(1.,0.,0.));`);
  });

  w('ENDSEC;');
  w('END-ISO-10303-21;');

  return lines.join('\n');
}

export function telechargerSTEP(p: PieceConfig) {
  const step = genererSTEP(p);
  const blob = new Blob([step], { type: 'application/step' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${p.reference}.step`; a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════
// Feature 46: Mesure 3D (distance entre 2 points sur surface pliée)
// ═══════════════════════════════════════════════════

export function distance3D(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2);
}

// ═══════════════════════════════════════════════════
// THREE.JS SCENE BUILDER
// ═══════════════════════════════════════════════════

export interface Scene3DOptions {
  mode: 'normal' | 'animation' | 'exploded' | 'ar';
  darkCanvas: boolean;
  usePBR: boolean;
  animProgress: number; // 0-1 for bend animation
  explodedPieces?: PieceConfig[];
  explodeDistance?: number;
  onMeasurePoint?: (pt: { x: number; y: number; z: number }) => void;
  enableMeasure?: boolean;
}

export function buildScene(
  THREE: any,
  piece: PieceConfig,
  mount: HTMLElement,
  opts: Scene3DOptions,
): { renderer: any; scene: any; camera: any; animate: () => void; cleanup: () => void; setProgress: (n: number) => void } {

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(opts.darkCanvas ? 0x12121e : 0xf3f1f9);

  // Camera
  const cam = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 10000);
  const maxDim = Math.max(piece.largeur, piece.hauteur) * 1.5;
  cam.position.set(maxDim * 0.8, maxDim * 0.6, maxDim * 0.8);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: opts.mode === 'ar' });
  renderer.setSize(mount.clientWidth, mount.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  mount.appendChild(renderer.domElement);

  // Lighting (45: réaliste)
  const ambient = new THREE.AmbientLight(0xffffff, opts.usePBR ? 0.3 : 0.5);
  scene.add(ambient);

  const dl = new THREE.DirectionalLight(0xffffff, opts.usePBR ? 1.2 : 0.8);
  dl.position.set(200, 400, 200); dl.castShadow = true;
  dl.shadow.mapSize.width = 1024; dl.shadow.mapSize.height = 1024;
  scene.add(dl);

  if (opts.usePBR) {
    const fill = new THREE.DirectionalLight(0x8888ff, 0.3);
    fill.position.set(-200, 200, -100); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.4);
    rim.position.set(0, 100, -300); scene.add(rim);
  }

  // Material (45: PBR)
  const pbr = PBR_MATERIALS[piece.matiere];
  let material: any;
  if (opts.usePBR) {
    material = new THREE.MeshStandardMaterial({
      color: pbr.color, metalness: pbr.metalness, roughness: pbr.roughness,
      envMapIntensity: pbr.envIntensity, side: THREE.DoubleSide,
    });
  } else {
    material = new THREE.MeshPhongMaterial({
      color: MATIERES.find(m => m.id === piece.matiere)?.couleur || '#6B7280',
      specular: 0x444444, shininess: 30, side: THREE.DoubleSide,
    });
  }

  // Collision material
  const collisionMat = new THREE.MeshStandardMaterial({ color: 0xff0000, metalness: 0.5, roughness: 0.5, transparent: true, opacity: 0.6, side: THREE.DoubleSide });

  // Segment meshes
  const segmentMeshes: any[] = [];
  const plis = [...piece.plis].sort((a, b) => a.position - b.position);
  const segs = computeSegments(piece);
  const ep = piece.epaisseur, h = piece.hauteur;

  // Feature 40: Detect collisions
  const collResult = detectCollisions(piece);
  const collisionSegIds = new Set(collResult.collisions.flatMap(c => [c.segA, c.segB]));

  const segGroup = new THREE.Group();

  segs.forEach((seg, i) => {
    const geo = new THREE.BoxGeometry(seg.length, h, ep);
    const useMat = collisionSegIds.has(i) ? collisionMat : material;
    const mesh = new THREE.Mesh(geo, useMat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    // Position will be set by updateSegmentPositions
    mesh.userData = { segIndex: i, length: seg.length };
    segmentMeshes.push(mesh);
    segGroup.add(mesh);
  });
  scene.add(segGroup);

  // Trous (as cylinder cutouts — visual only)
  piece.trous.forEach(t => {
    const cylGeo = new THREE.CylinderGeometry(t.diametre / 2, t.diametre / 2, ep + 1, 16);
    const cylMat = new THREE.MeshBasicMaterial({ color: opts.darkCanvas ? 0x12121e : 0xf3f1f9 });
    const cyl = new THREE.Mesh(cylGeo, cylMat);
    cyl.position.set(t.x, t.y, 0); cyl.rotation.x = Math.PI / 2;
    // Add to first segment only (flat view approximation)
    if (segmentMeshes[0]) segmentMeshes[0].add(cyl);
  });

  // Feature 44: Exploded view
  if (opts.mode === 'exploded' && opts.explodedPieces) {
    const dist = opts.explodeDistance || 50;
    opts.explodedPieces.forEach((ep, i) => {
      if (i === 0) return; // first piece already built
      const segs2 = computeSegments(ep);
      segs2.forEach(seg2 => {
        const geo = new THREE.BoxGeometry(seg2.length, ep.hauteur, ep.epaisseur);
        const mat2 = new THREE.MeshStandardMaterial({ color: PBR_MATERIALS[ep.matiere]?.color || 0x888888, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mat2);
        mesh.position.set(seg2.fromX + seg2.length / 2, ep.hauteur / 2, i * dist);
        mesh.castShadow = true;
        scene.add(mesh);
      });
      // Numbering label
      const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
      const ctx2 = canvas.getContext('2d')!; ctx2.fillStyle = '#B91C1C'; ctx2.beginPath(); ctx2.arc(32, 32, 28, 0, Math.PI * 2); ctx2.fill();
      ctx2.fillStyle = '#fff'; ctx2.font = 'bold 32px sans-serif'; ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle'; ctx2.fillText(String(i + 1), 32, 32);
      const spriteMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) });
      const sprite = new THREE.Sprite(spriteMat); sprite.position.set(ep.largeur / 2, ep.hauteur + 20, i * dist);
      sprite.scale.set(15, 15, 1); scene.add(sprite);
    });
  }

  // Collision markers (40)
  collResult.collisions.forEach(c => {
    const geo = new THREE.SphereGeometry(3, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const sphere = new THREE.Mesh(geo, mat);
    sphere.position.set(c.point.x, h / 2, c.point.z);
    scene.add(sphere);
  });

  // Ground plane
  const groundGeo = new THREE.PlaneGeometry(2000, 2000);
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.15 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);

  // Grid
  const grid = new THREE.GridHelper(500, 50, opts.darkCanvas ? 0x333355 : 0xcccccc, opts.darkCanvas ? 0x222244 : 0xeeeeee);
  scene.add(grid);

  // Orbit control
  const center = new THREE.Vector3(piece.largeur / 2, h / 3, 0);
  let mouseDown = false, lastMX = 0, lastMY = 0, rotX = 0.5, rotY = 0.3, dist2 = maxDim;
  const updateCam = () => {
    cam.position.set(center.x + dist2 * Math.sin(rotX) * Math.cos(rotY), center.y + dist2 * Math.sin(rotY), center.z + dist2 * Math.cos(rotX) * Math.cos(rotY));
    cam.lookAt(center);
  };
  updateCam();

  const onMD = (e: MouseEvent) => { mouseDown = true; lastMX = e.clientX; lastMY = e.clientY; };
  const onMM = (e: MouseEvent) => { if (!mouseDown) return; rotX += (e.clientX - lastMX) * 0.005; rotY = Math.max(-1.4, Math.min(1.4, rotY + (e.clientY - lastMY) * 0.005)); lastMX = e.clientX; lastMY = e.clientY; updateCam(); };
  const onMU = () => { mouseDown = false; };
  const onWh = (e: WheelEvent) => { dist2 = Math.max(20, Math.min(3000, dist2 + e.deltaY * 0.5)); updateCam(); };
  renderer.domElement.addEventListener('mousedown', onMD);
  renderer.domElement.addEventListener('mousemove', onMM);
  renderer.domElement.addEventListener('mouseup', onMU);
  renderer.domElement.addEventListener('wheel', onWh);

  // Feature 46: 3D Measure — raycasting
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  if (opts.enableMeasure && opts.onMeasurePoint) {
    renderer.domElement.addEventListener('click', (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, cam);
      const hits = raycaster.intersectObjects(segmentMeshes);
      if (hits.length > 0) {
        const pt = hits[0].point;
        opts.onMeasurePoint!({ x: pt.x, y: pt.y, z: pt.z });
      }
    });
  }

  // Update segment positions for animation (39)
  let currentProgress = opts.animProgress;

  const updateSegmentPositions = (progress: number) => {
    let px = 0, pz = 0, dxDir = 1, dzDir = 0;
    let last = 0;

    segmentMeshes.forEach((mesh, i) => {
      const seg = segs[i]; if (!seg) return;
      const cx = px + dxDir * seg.length / 2;
      const cz = pz + dzDir * seg.length / 2;
      mesh.position.set(cx, h / 2, cz);
      const angle = Math.atan2(dzDir, dxDir);
      mesh.rotation.y = -angle;

      px += dxDir * seg.length;
      pz += dzDir * seg.length;

      // Apply fold
      if (i < plis.length) {
        const pli = plis[i];
        const animAngle = pli.angle * progress;
        const rad = (animAngle * Math.PI / 180) * (pli.direction === 'haut' ? -1 : 1);
        const ndx = dxDir * Math.cos(rad) - dzDir * Math.sin(rad);
        const ndz = dxDir * Math.sin(rad) + dzDir * Math.cos(rad);
        dxDir = ndx; dzDir = ndz;
      }
    });
  };

  updateSegmentPositions(currentProgress);

  // Animation loop
  let animFrameId: number;
  const animate = () => {
    animFrameId = requestAnimationFrame(animate);
    renderer.render(scene, cam);
  };
  animate();

  const setProgress = (p: number) => {
    currentProgress = Math.max(0, Math.min(1, p));
    updateSegmentPositions(currentProgress);
  };

  const cleanup = () => {
    cancelAnimationFrame(animFrameId);
    renderer.domElement.removeEventListener('mousedown', onMD);
    renderer.domElement.removeEventListener('mousemove', onMM);
    renderer.domElement.removeEventListener('mouseup', onMU);
    renderer.domElement.removeEventListener('wheel', onWh);
    renderer.dispose();
    segmentMeshes.forEach(m => { m.geometry.dispose(); m.material.dispose(); });
    if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
  };

  return { renderer, scene, camera: cam, animate, cleanup, setProgress };
}

// ═══════════════════════════════════════════════════
// Feature 49: AR Setup (WebXR)
// ═══════════════════════════════════════════════════

export async function isARAvailable(): Promise<boolean> {
  if (!navigator.xr) return false;
  try { return await navigator.xr.isSessionSupported('immersive-ar'); }
  catch { return false; }
}

export async function startARSession(
  THREE: any, piece: PieceConfig, renderer: any, scene: any, camera: any,
): Promise<any> {
  if (!navigator.xr) throw new Error('WebXR non supporté');

  renderer.xr.enabled = true;

  const session = await navigator.xr.requestSession('immersive-ar', {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay'],
  });

  renderer.xr.setSession(session);

  // Scale piece to real world (mm → meters)
  const scale = 0.001;
  scene.children.forEach((child: any) => {
    if (child.isMesh) {
      child.scale.set(scale, scale, scale);
    }
  });

  return session;
}
