// Diorama kit v5.7.0 (c) 2026 Nehal Kanak / Sloemo01, MIT: ver LICENSE en esta carpeta.
// Adaptado de templates/camera.js (commit c790df5): la configuración de la cámara llega por parámetro en vez de una
// constante del módulo, para usar el punto de partida del preset stroked-toon. La solución es la misma (bisección).
import * as THREE from 'three';

/**
 * Reset hero three-quarter camera. Distance is solved against fit points
 * (slab corners plus tall props) for a stable margin at each aspect ratio.
 * REQUIRED: attach createDioramaOrbit from orbit.js after fitting in every preset.
 * This module only solves the deterministic hero pose; it never auto-spins.
 */
export function cameraDirection(cfg, out = new THREE.Vector3()) {
  const ce = Math.cos(cfg.elevation);
  return out.set(ce * Math.cos(cfg.azimuth), Math.sin(cfg.elevation), ce * Math.sin(cfg.azimuth));
}

function fits(cfg, dir, right, up, aspect, distance, points) {
  const tanHalf = Math.tan((cfg.fov * Math.PI) / 360);
  const p = new THREE.Vector3();
  for (const fit of points) {
    p.subVectors(fit, cfg.target);
    const depth = distance - p.dot(dir);
    if (depth < 0.4) return false;
    const x = p.dot(right) / (depth * tanHalf * aspect);
    const y = p.dot(up) / (depth * tanHalf);
    if (Math.abs(x) > cfg.fillX) return false;
    if (Math.abs(y) > cfg.fillY) return false;
  }
  return true;
}

export function solveDistance(cfg, aspect, points) {
  const a = Math.max(0.3, aspect);
  const dir = cameraDirection(cfg);
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
  const up = new THREE.Vector3().crossVectors(dir, right).normalize();
  let lo = 2;
  let hi = 300;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) * 0.5;
    if (fits(cfg, dir, right, up, a, mid, points)) hi = mid;
    else lo = mid;
  }
  return hi;
}

export function updateCamera(camera, cfg, aspect, points) {
  const a = Math.max(0.3, aspect);
  const fit = solveDistance(cfg, a, points);
  const scale = cfg.subjectScale ?? 1;
  const d = fit / Math.max(0.1, scale);
  const dir = cameraDirection(cfg);
  camera.position.copy(cfg.target).addScaledVector(dir, d);
  camera.lookAt(cfg.target);
  camera.aspect = a;
  camera.near = Math.max(0.3, d * 0.05);
  camera.far = d * 4 + 80;
  camera.updateProjectionMatrix();
  camera.userData.fitDistance = fit;
  camera.userData.subjectScale = scale;
  camera.userData.distance = d;
}
