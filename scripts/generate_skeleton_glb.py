"""
Generates public/models/skeleton.glb — a detailed, anatomically-proportioned
procedural human skeleton built from primitives (boxes, spheres, capsules and
swept tubes) using only numpy + the stdlib (no trimesh/pygltflib/network).

The rig is ~1.78 m tall, feet at y = 0, facing +Z, and every mesh is named to
match components/anatomy/anatomyMapping.ts keyword patterns, so each bone
auto-classifies into its anatomy group (skull, spine, ribCage, shoulder, arm,
hand, pelvis, hip, knee, ankle, foot) with zero unassigned meshes.

Meshes in groups whose scroll section sets `separate: true` also carry a
`separationOffset` node extra (a unit direction vector). AnatomyController.tsx
reads it to drive the exploded-joint effect — ribs push outward, vertebrae
spread vertically, limb bones slide along the limb, the patella pops forward.

All triangle winding is verified outward-facing at build time (per-triangle
face normal vs. analytic vertex normals), so the model renders correctly with
three.js's default front-face culling.

Run:  python3 scripts/generate_skeleton_glb.py
"""

import json
import re
import struct
from pathlib import Path

import numpy as np

OUT_PATH = Path(__file__).resolve().parent.parent / "public" / "models" / "skeleton.glb"

# ---------------------------------------------------------------------------
# Primitive geometry generators.
# Each returns (positions Nx3 float32, normals Nx3 float32, indices Mx3 int64)
# in local space, with outward-facing CCW winding (verified by check_winding).
# ---------------------------------------------------------------------------

def make_box(size):
    sx, sy, sz = [s / 2 for s in size]
    # 24 verts (4 per face) so normals stay flat per face.
    faces = [
        ((0, 0, 1), [(-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz)]),
        ((0, 0, -1), [(sx, -sy, -sz), (-sx, -sy, -sz), (-sx, sy, -sz), (sx, sy, -sz)]),
        ((0, 1, 0), [(-sx, sy, sz), (sx, sy, sz), (sx, sy, -sz), (-sx, sy, -sz)]),
        ((0, -1, 0), [(-sx, -sy, -sz), (sx, -sy, -sz), (sx, -sy, sz), (-sx, -sy, sz)]),
        ((1, 0, 0), [(sx, -sy, sz), (sx, -sy, -sz), (sx, sy, -sz), (sx, sy, sz)]),
        ((-1, 0, 0), [(-sx, -sy, -sz), (-sx, -sy, sz), (-sx, sy, sz), (-sx, sy, -sz)]),
    ]
    positions, normals, indices = [], [], []
    for normal, corners in faces:
        base = len(positions)
        for c in corners:
            positions.append(c)
            normals.append(normal)
        indices += [(base, base + 1, base + 2), (base, base + 2, base + 3)]
    return (
        np.array(positions, dtype=np.float32),
        np.array(normals, dtype=np.float32),
        np.array(indices, dtype=np.int64),
    )


def make_sphere(radius, segments=12, rings=8):
    positions, normals = [], []
    for i in range(rings + 1):
        theta = np.pi * i / rings
        for j in range(segments + 1):
            phi = 2 * np.pi * j / segments
            x = np.sin(theta) * np.cos(phi)
            y = np.cos(theta)
            z = np.sin(theta) * np.sin(phi)
            positions.append((x * radius, y * radius, z * radius))
            normals.append((x, y, z))
    indices = []
    for i in range(rings):
        for j in range(segments):
            a = i * (segments + 1) + j
            b = a + segments + 1
            indices += [(a, a + 1, b), (b, a + 1, b + 1)]
    return (
        np.array(positions, dtype=np.float32),
        np.array(normals, dtype=np.float32),
        np.array(indices, dtype=np.int64),
    )


def make_cylinder(radius, height, segments=12):
    positions, normals = [], []
    half = height / 2
    # Side wall (verified outward).
    for i in range(2):
        y = -half if i == 0 else half
        for j in range(segments + 1):
            phi = 2 * np.pi * j / segments
            x, z = np.cos(phi) * radius, np.sin(phi) * radius
            positions.append((x, y, z))
            normals.append((x / radius, 0, z / radius))
    indices = []
    for j in range(segments):
        a, b = j, j + segments + 1
        indices += [(a, b, a + 1), (a + 1, b, b + 1)]
    # Caps get dedicated rim verts with axial normals so the winding check
    # stays meaningful (radial normals would be ~perpendicular to the face).
    top_center = len(positions)
    positions.append((0, half, 0)); normals.append((0, 1, 0))
    bottom_center = len(positions)
    positions.append((0, -half, 0)); normals.append((0, -1, 0))
    top_ring_start = len(positions)
    for j in range(segments + 1):
        phi = 2 * np.pi * j / segments
        positions.append((np.cos(phi) * radius, half, np.sin(phi) * radius))
        normals.append((0, 1, 0))
    bottom_ring_start = len(positions)
    for j in range(segments + 1):
        phi = 2 * np.pi * j / segments
        positions.append((np.cos(phi) * radius, -half, np.sin(phi) * radius))
        normals.append((0, -1, 0))
    for j in range(segments):
        a, b = top_ring_start + j, top_ring_start + j + 1
        indices.append((top_center, b, a))      # outward = +Y
        a, b = bottom_ring_start + j, bottom_ring_start + j + 1
        indices.append((bottom_center, a, b))   # outward = -Y
    return (
        np.array(positions, dtype=np.float32),
        np.array(normals, dtype=np.float32),
        np.array(indices, dtype=np.int64),
    )


def make_capsule(radius, length, segments=12, rings=8):
    """Capsule along +Y: cylinder of `length` with hemispherical caps.
    Total height = length + 2 * radius."""
    positions, normals = [], []
    rows = rings * 2
    for i in range(rows + 1):
        theta = np.pi * i / rows
        s = 1.0 if theta <= np.pi / 2 else -1.0
        y = radius * np.cos(theta) + s * length / 2
        rho = radius * np.sin(theta)
        for j in range(segments + 1):
            phi = 2 * np.pi * j / segments
            positions.append((rho * np.cos(phi), y, rho * np.sin(phi)))
            normals.append((np.sin(theta) * np.cos(phi), np.cos(theta), np.sin(theta) * np.sin(phi)))
    indices = []
    for i in range(rows):
        for j in range(segments):
            a = i * (segments + 1) + j
            b = a + segments + 1
            indices += [(a, a + 1, b), (b, a + 1, b + 1)]
    return (
        np.array(positions, dtype=np.float32),
        np.array(normals, dtype=np.float32),
        np.array(indices, dtype=np.int64),
    )


def _catmull_rom(points, samples_per_segment=10):
    pts = [np.array(p, dtype=np.float64) for p in points]
    out = []
    for i in range(len(pts) - 1):
        p0 = pts[max(0, i - 1)]
        p1 = pts[i]
        p2 = pts[i + 1]
        p3 = pts[min(len(pts) - 1, i + 2)]
        for s in range(samples_per_segment):
            t = s / samples_per_segment
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t +
                              (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                              (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(pts[-1].copy())
    return out


def make_tube(points, radius, radial_segments=7, samples_per_segment=10):
    """Swept circular tube along a 3D path (for ribs, clavicles). Capped."""
    spine = _catmull_rom(points, samples_per_segment)
    n = len(spine)
    tangents = []
    for i in range(n):
        a = spine[max(0, i - 1)]
        b = spine[min(n - 1, i + 1)]
        t = b - a
        tangents.append(t / (np.linalg.norm(t) + 1e-12))

    positions, normals = [], []
    # Parallel-transport frames: propagate the ring orientation along the
    # curve with minimal twist. (A fixed world-up reference would swing the
    # frame wildly where the tangent turns quickly, e.g. the rib angle,
    # shearing quads until some triangles face inward.)
    t0 = tangents[0]
    up = np.array([0.0, 1.0, 0.0])
    if abs(float(np.dot(t0, up))) > 0.92:
        up = np.array([1.0, 0.0, 0.0])
    n0 = np.cross(up, t0); n0 /= np.linalg.norm(n0)
    b0 = np.cross(t0, n0)
    frames = [(n0, b0)]
    for i in range(1, n):
        t = tangents[i]
        n_prev = frames[-1][0]
        nn = n_prev - t * float(np.dot(n_prev, t))
        nl = np.linalg.norm(nn)
        if nl < 1e-9:  # degenerate: rebuild from world up
            nn = np.cross(up, t); nl = np.linalg.norm(nn)
        nn /= nl
        frames.append((nn, np.cross(t, nn)))
    for i in range(n):
        nrm, binorm = frames[i]
        for j in range(radial_segments + 1):
            phi = 2 * np.pi * j / radial_segments
            d = np.cos(phi) * nrm + np.sin(phi) * binorm
            positions.append(spine[i] + radius * d)
            normals.append(d)
    indices = []
    ring = radial_segments + 1
    for i in range(n - 1):
        for j in range(radial_segments):
            a = i * ring + j
            b = (i + 1) * ring + j
            indices += [(a, a + 1, b), (b, a + 1, b + 1)]

    def add_cap(center_idx_point, tangent, flip):
        ci = len(positions)
        positions.append(spine[center_idx_point])
        cap_n = (-tangent if flip else tangent)
        normals.append(cap_n)
        rim_start = len(positions)
        # Rebuild the end ring with axial (cap) normals, reusing the
        # parallel-transport frame at that end of the tube.
        nrm, binorm = frames[center_idx_point]
        for j in range(radial_segments + 1):
            phi = 2 * np.pi * j / radial_segments
            d = np.cos(phi) * nrm + np.sin(phi) * binorm
            positions.append(spine[center_idx_point] + radius * d)
            normals.append(cap_n)
        for j in range(radial_segments):
            a, b = rim_start + j, rim_start + j + 1
            # Order chosen so the fan normal matches cap_n (verified below).
            tri = (ci, b, a) if flip else (ci, a, b)
            v0 = np.array(positions[tri[0]]); v1 = np.array(positions[tri[1]]); v2 = np.array(positions[tri[2]])
            fn = np.cross(v1 - v0, v2 - v0)
            if float(np.dot(fn, cap_n)) < 0:
                tri = (tri[0], tri[2], tri[1])
            indices.append(tri)

    add_cap(0, tangents[0], flip=True)    # start cap faces backwards
    add_cap(n - 1, tangents[-1], flip=False)  # end cap faces forwards
    return (
        np.array(positions, dtype=np.float32),
        np.array(normals, dtype=np.float32),
        np.array(indices, dtype=np.int64),
    )


def make_torus(R, r, tubular_segments=20, radial_segments=10):
    """Torus in the XY plane (axis = +Z), centered at origin."""
    positions, normals = [], []
    for i in range(tubular_segments + 1):
        u = 2 * np.pi * i / tubular_segments
        cu, su = np.cos(u), np.sin(u)
        for j in range(radial_segments + 1):
            v = 2 * np.pi * j / radial_segments
            cv, sv = np.cos(v), np.sin(v)
            positions.append(((R + r * cv) * cu, (R + r * cv) * su, r * sv))
            normals.append((cv * cu, cv * su, sv))
    indices = []
    ring = radial_segments + 1
    for i in range(tubular_segments):
        for j in range(radial_segments):
            a = i * ring + j
            b = (i + 1) * ring + j
            indices += [(a, b, a + 1), (a + 1, b, b + 1)]
    return (
        np.array(positions, dtype=np.float32),
        np.array(normals, dtype=np.float32),
        np.array(indices, dtype=np.int64),
    )


def merge_geos(geos):
    """Concatenate several geometries into one mesh (winding preserved)."""
    positions, normals, indices = [], [], []
    offset = 0
    for pos, nrm, idx in geos:
        positions.append(np.asarray(pos, dtype=np.float32))
        normals.append(np.asarray(nrm, dtype=np.float32))
        indices.append(np.asarray(idx, dtype=np.int64).reshape(-1, 3) + offset)
        offset += np.asarray(pos).shape[0]
    return (
        np.concatenate(positions),
        np.concatenate(normals),
        np.concatenate(indices),
    )


def make_curved_plate(w, h, t, R, nu=12, nv=8, taper_bottom=1.0):
    """Plate of width w bent around the Y axis with radius R (edges sweep
    toward -Z), height h, thickness t. The convex face points +Z at center —
    used for the iliac blades of the pelvis. taper_bottom < 1 narrows the
    plate toward its bottom edge (fan shape of the iliac blade)."""
    positions, normals, indices = [], [], []
    spread = w / R

    def frame(fu, fv):
        wscale = taper_bottom + (1.0 - taper_bottom) * fv
        a = (fu - 0.5) * spread * wscale
        sa, ca = np.sin(a), np.cos(a)
        center = (R * sa, (fv - 0.5) * h, -R * (1 - ca))
        return center, (sa, 0.0, ca), a

    def vert(fu, fv, side, normal):
        (cx, cy, cz), (nx, _ny, nz) = frame(fu, fv)[:2]
        positions.append((cx + nx * side * t / 2, cy, cz + nz * side * t / 2))
        normals.append(normal)
        return len(positions) - 1

    for side in (1, -1):  # convex face, then concave face
        grid = []
        for iv in range(nv + 1):
            row = []
            for iu in range(nu + 1):
                fu, fv = iu / nu, iv / nv
                _, (nx, _ny, nz), _ = frame(fu, fv)
                row.append(vert(fu, fv, side, (nx * side, 0.0, nz * side)))
            grid.append(row)
        for iv in range(nv):
            for iu in range(nu):
                a, b = grid[iv][iu], grid[iv][iu + 1]
                c, d = grid[iv + 1][iu], grid[iv + 1][iu + 1]
                indices += [(a, b, c), (b, d, c)] if side == 1 else [(a, c, b), (b, c, d)]

    def strip(edge, normal_fn):
        # Edge strips duplicate the boundary verts with the edge normal so
        # shading stays crisp; winding auto-corrected like make_tube caps.
        f_idx = [vert(fu, fv, 1, normal_fn(fu, fv)) for fu, fv in edge]
        b_idx = [vert(fu, fv, -1, normal_fn(fu, fv)) for fu, fv in edge]
        for k in range(len(edge) - 1):
            for tri in ((f_idx[k], f_idx[k + 1], b_idx[k]),
                        (b_idx[k], f_idx[k + 1], b_idx[k + 1])):
                v0 = np.array(positions[tri[0]])
                v1 = np.array(positions[tri[1]])
                v2 = np.array(positions[tri[2]])
                fn = np.cross(v1 - v0, v2 - v0)
                dn = np.array(normal_fn(*edge[k]), dtype=np.float64)
                if float(np.dot(fn, dn)) < 0:
                    tri = (tri[0], tri[2], tri[1])
                indices.append(tri)

    top = [(iu / nu, 1.0) for iu in range(nu + 1)]
    bottom = [(iu / nu, 0.0) for iu in range(nu + 1)]
    left = [(0.0, iv / nv) for iv in range(nv + 1)]
    right = [(1.0, iv / nv) for iv in range(nv + 1)]
    def _edge_angle(fu, fv):
        wscale = taper_bottom + (1.0 - taper_bottom) * fv
        return (fu - 0.5) * spread * wscale
    strip(top, lambda fu, fv: (0.0, 1.0, 0.0))
    strip(bottom, lambda fu, fv: (0.0, -1.0, 0.0))
    strip(left, lambda fu, fv: (-np.cos(_edge_angle(fu, fv)), 0.0, np.sin(_edge_angle(fu, fv))))
    strip(right, lambda fu, fv: (np.cos(_edge_angle(fu, fv)), 0.0, -np.sin(_edge_angle(fu, fv))))
    return (
        np.array(positions, dtype=np.float32),
        np.array(normals, dtype=np.float32),
        np.array(indices, dtype=np.int64),
    )


# ---------------------------------------------------------------------------
# Transforms (baked into vertex data; nodes carry translation only).
# ---------------------------------------------------------------------------

def xform(geo, scale=None, rotate=None, translate=None):
    pos, nrm, idx = geo
    pos = pos.astype(np.float64).copy()
    nrm = nrm.astype(np.float64).copy()
    if scale is not None:
        s = np.array(scale, dtype=np.float64)
        pos *= s
        nrm /= s
    if rotate is not None:
        rx, ry, rz = rotate
        cx, sx_ = np.cos(rx), np.sin(rx)
        cy, sy_ = np.cos(ry), np.sin(ry)
        cz, sz_ = np.cos(rz), np.sin(rz)
        Rx = np.array([[1, 0, 0], [0, cx, -sx_], [0, sx_, cx]])
        Ry = np.array([[cy, 0, sy_], [0, 1, 0], [-sy_, 0, cy]])
        Rz = np.array([[cz, -sz_, 0], [sz_, cz, 0], [0, 0, 1]])
        R = Rz @ Ry @ Rx
        pos = pos @ R.T
        nrm = nrm @ R.T
    if translate is not None:
        pos += np.array(translate, dtype=np.float64)
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-12
    return pos.astype(np.float32), nrm.astype(np.float32), idx


def capsule_between(p0, p1, radius, segments=12, rings=6):
    """Capsule stretched between two points."""
    p0 = np.array(p0, dtype=np.float64)
    p1 = np.array(p1, dtype=np.float64)
    d = p1 - p0
    length = float(np.linalg.norm(d)) - 2 * radius
    length = max(length, 0.001)
    geo = make_capsule(radius, length, segments=segments, rings=rings)
    # Align +Y to d.
    dn = d / (np.linalg.norm(d) + 1e-12)
    y = np.array([0.0, 1.0, 0.0])
    axis = np.cross(y, dn)
    angle = np.arccos(np.clip(float(np.dot(y, dn)), -1, 1))
    if np.linalg.norm(axis) < 1e-9:
        # d is parallel/anti-parallel to +Y: rotate π about Z (proper
        # rotation, det=+1) or identity. A bare -I would be a reflection
        # (det=-1) and flip triangle winding.
        R = np.eye(3) if angle < 1e-9 else np.diag([-1.0, -1.0, 1.0])
    else:
        axis = axis / np.linalg.norm(axis)
        K = np.array([[0, -axis[2], axis[1]], [axis[2], 0, -axis[0]], [-axis[1], axis[0], 0]])
        R = np.eye(3) + np.sin(angle) * K + (1 - np.cos(angle)) * (K @ K)
    pos, nrm, idx = geo
    pos = (pos.astype(np.float64) @ R.T) + (p0 + p1) / 2
    nrm = nrm.astype(np.float64) @ R.T
    return pos.astype(np.float32), nrm.astype(np.float32), idx


def check_winding(name, geo):
    """Assert every non-degenerate triangle faces outward: the geometric
    face normal must agree with the analytic vertex normals."""
    pos, nrm, idx = geo
    pos = pos.astype(np.float64)
    nrm = nrm.astype(np.float64)
    idx = np.asarray(idx, dtype=np.int64)
    bad = 0
    for tri in idx:
        v0, v1, v2 = pos[tri[0]], pos[tri[1]], pos[tri[2]]
        e1, e2 = v1 - v0, v2 - v0
        fn = np.cross(e1, e2)
        area = np.linalg.norm(fn)
        if area < 1e-12:
            continue  # degenerate pole triangles are harmless
        fn /= area
        vn = nrm[tri[0]] + nrm[tri[1]] + nrm[tri[2]]
        vn /= np.linalg.norm(vn) + 1e-12
        if float(np.dot(fn, vn)) <= 1e-6:
            bad += 1
    assert bad == 0, f"{name}: {bad} inward-facing triangles"

# ---------------------------------------------------------------------------
# Skeleton layout.
# Each entry: (name, geometry-factory-lambda, separationOffset or None).
# Names match components/anatomy/anatomyMapping.ts keyword patterns.
# separationOffset is a unit direction written to the GLB node extras; the
# AnatomyController multiplies it by ~3 cm * emphasis for the exploded view.
# ---------------------------------------------------------------------------

def _norm(v):
    v = np.array(v, dtype=np.float64)
    n = np.linalg.norm(v)
    return (v / n).tolist() if n > 1e-9 else [0.0, 0.0, 0.0]

BONES = []

def bone(name, geo_fn, separation=None):
    BONES.append((name, geo_fn, _norm(separation) if separation else None))

# -- Skull -----------------------------------------------------------------
# A proper cranial vault + facial skeleton: orbits with dark sockets and
# rims, nasal aperture, zygomatic arches, maxilla with teeth, and a
# U-shaped mandible (body + rami + chin) articulating at the TMJ — no more
# floating face-box.
def _teeth_row(y, z_front, z_back, half_spread, w, h, d, count=10):
    geos = []
    for k in range(count):
        f = k / (count - 1) * 2 - 1  # -1..1 across the dental arcade
        x = f * half_spread
        z = z_front - abs(f) * (z_front - z_back)
        geos.append(xform(make_box((w, h, d)), translate=(x, y, z)))
    return merge_geos(geos)


bone("Skull_Cranium",
     lambda: xform(make_sphere(0.105), scale=(0.94, 1.10, 1.02), translate=(0, 1.700, -0.020)),
     separation=(0, 1, -0.15))
for s, side in ((-1, "L"), (1, "R")):
    bone(f"Skull_Mastoid_{side}",
         lambda s=s: xform(make_sphere(0.015), translate=(s * 0.075, 1.620, -0.025)),
         separation=(s * 0.4, 0, -0.6))
    bone(f"Skull_OrbitSocket_{side}",  # dark inset: reads as the eye socket
         lambda s=s: xform(make_sphere(0.027), scale=(1, 1.12, 0.55),
                           translate=(s * 0.040, 1.648, 0.072)),
         separation=(s * 0.3, 0.2, 0.9))
    bone(f"Skull_OrbitRim_{side}",
         lambda s=s: xform(make_torus(0.030, 0.007), translate=(s * 0.040, 1.648, 0.082)),
         separation=(s * 0.3, 0.2, 0.9))
    bone(f"Skull_NasalBone_{side}",
         lambda s=s: xform(make_box((0.016, 0.036, 0.014)),
                           rotate=(0.12, 0, -s * 0.06),
                           translate=(s * 0.010, 1.630, 0.088)),
         separation=(0, 0.2, 1))
    bone(f"Skull_Zygomatic_{side}",  # cheekbone arch sweeping back to the ear
         lambda s=s: make_tube([
             (s * 0.058, 1.628, 0.062), (s * 0.078, 1.626, 0.034),
             (s * 0.089, 1.634, 0.000), (s * 0.091, 1.643, -0.024),
         ], 0.0085, samples_per_segment=8),
         separation=(s * 0.8, 0, 0.3))
    bone(f"Skull_Cheek_{side}",
         lambda s=s: xform(make_box((0.026, 0.030, 0.024)),
                           rotate=(0, s * 0.35, 0),
                           translate=(s * 0.058, 1.624, 0.052)),
         separation=(s * 0.6, -0.1, 0.7))
bone("Skull_BrowRidge",
     lambda: capsule_between((-0.055, 1.670, 0.082), (0.055, 1.670, 0.082), 0.0115),
     separation=(0, 0.35, 0.9))
bone("Skull_NasalCavity",  # dark inset: the nasal aperture
     lambda: xform(make_box((0.026, 0.036, 0.014)), translate=(0, 1.602, 0.076)),
     separation=(0, 0, 1))
bone("Skull_Maxilla",
     lambda: xform(make_box((0.076, 0.046, 0.062)), translate=(0, 1.594, 0.052)),
     separation=(0, -0.25, 0.95))
bone("Skull_UpperTeeth",
     lambda: _teeth_row(1.568, 0.078, 0.056, 0.027, 0.0095, 0.014, 0.009),
     separation=(0, -0.4, 0.9))

# -- Mandible: U-shaped body, rami rising to the TMJ condyles, chin, teeth --
# The body's back ends dive INTO the ramus plates so the jaw reads as one
# fused bone instead of a floating strap.
_mand_points = [(-0.068, 1.614, -0.004), (-0.068, 1.584, 0.018),
                (-0.042, 1.560, 0.056), (0, 1.552, 0.070),
                (0.042, 1.560, 0.056), (0.068, 1.584, 0.018),
                (0.068, 1.614, -0.004)]
bone("Mandible_Body",
     lambda: make_tube(_mand_points, 0.015, samples_per_segment=10),
     separation=(0, -1, 0.25))
for s, side in ((-1, "L"), (1, "R")):
    bone(f"Mandible_Ramus_{side}",
         lambda s=s: merge_geos([
             xform(make_box((0.022, 0.088, 0.020)),
                   rotate=(0, s * 0.06, -s * 0.08),
                   translate=(s * 0.068, 1.590, -0.004)),
             xform(make_sphere(0.0115), translate=(s * 0.072, 1.630, -0.010)),
         ]),
         separation=(s * 0.5, -0.8, 0))
bone("Mandible_Chin",
     lambda: xform(make_box((0.042, 0.028, 0.026)), translate=(0, 1.550, 0.070)),
     separation=(0, -0.7, 0.7))
bone("Mandible_LowerTeeth",
     lambda: _teeth_row(1.560, 0.066, 0.048, 0.024, 0.0085, 0.012, 0.008),
     separation=(0, -0.9, 0.4))

# -- Spine: 24 vertebrae + sacrum ------------------------------------------
def vertebra(name, y, z, body, proc=None, pz=0.0, transverse=None):
    bone(name, lambda: xform(make_box(body), translate=(0, y, z)),
         separation=(0, 1 if y > 1.2 else -1, 0))
    if proc:
        def _proc(body=body, proc=proc, y=y, z=z, pz=pz, transverse=transverse):
            parts = [xform(make_box(proc), translate=(0, y, z + pz))]
            if transverse:
                tw, th, td = transverse
                for s in (-1, 1):
                    parts.append(xform(
                        make_box((tw, th, td)),
                        translate=(s * (body[0] / 2 + tw / 2 - 0.004), y, z - 0.005)))
            return merge_geos(parts)
        bone(name + "_Process", _proc,
             separation=(0, 1 if y > 1.2 else -1, -0.4))

cerv_y = [1.505 - i * 0.0175 for i in range(7)]
for i, y in enumerate(cerv_y):
    vertebra(f"Vertebra_C{i + 1}", y, 0.006, (0.040, 0.016, 0.036),
             transverse=(0.020, 0.010, 0.012))
thor_y = [1.385 - i * 0.026 for i in range(12)]
for i, y in enumerate(thor_y):
    vertebra(f"Vertebra_T{i + 1}", y, -0.012, (0.052, 0.022, 0.048),
             proc=(0.014, 0.014, 0.045), pz=-0.042,
             transverse=(0.030, 0.012, 0.014))
lumb_y = [1.075 - i * 0.036 for i in range(5)]
for i, y in enumerate(lumb_y):
    vertebra(f"Vertebra_L{i + 1}", y, 0.008, (0.072, 0.030, 0.062),
             proc=(0.018, 0.018, 0.055), pz=-0.052,
             transverse=(0.036, 0.014, 0.016))
bone("Sacrum",
     lambda: xform(make_box((0.080, 0.105, 0.045)), translate=(0, 0.878, -0.010)),
     separation=(0, -1, -0.2))

# -- Rib cage: 12 swept rib pairs + sternum ---------------------------------
rib_widths = [0.075, 0.095, 0.110, 0.122, 0.130, 0.136, 0.140, 0.138, 0.130, 0.118, 0.100, 0.085]
for i in range(12):
    y = 1.425 - i * 0.0295
    w = rib_widths[i]
    for s, side in ((-1, "L"), (1, "R")):
        # Rounded control polygon: the rib sweeps back to its angle, then
        # curves gently forward. Turns stay well under 90° so the swept tube
        # never self-intersects (which would flip triangle winding).
        pts = [
            (s * 0.026, y, -0.030),
            (s * w * 0.45, y + 0.010, -0.070),
            (s * w * 0.75, y + 0.002, -0.075),
            (s * w * 1.00, y - 0.015, -0.030),
        ]
        if i < 7:
            pts += [(s * w * 0.90, y - 0.042, 0.050),
                    (s * w * 0.52, y - 0.062, 0.125)]
        elif i < 10:
            pts += [(s * w * 0.90, y - 0.042, 0.050),
                    (s * w * 0.72, y - 0.055, 0.095)]
        else:
            # Floating ribs (11-12) taper off laterally — no forward hook.
            pts.append((s * w * 1.02, y - 0.028, 0.005))
        bone(f"Rib_{i + 1:02d}_{side}",
             lambda p=pts: make_tube(p, 0.007, samples_per_segment=12),
             separation=(s * 0.9, 0, 0.25))
bone("Sternum",
     lambda: xform(make_box((0.045, 0.185, 0.018)), translate=(0, 1.315, 0.148)),
     separation=(0, 0, 1))
bone("Sternum_Manubrium",
     lambda: xform(make_box((0.062, 0.050, 0.020)), translate=(0, 1.425, 0.144)),
     separation=(0, 0.3, 1))
bone("Sternum_Xiphoid",
     lambda: xform(make_box((0.024, 0.038, 0.012)), translate=(0, 1.208, 0.145)),
     separation=(0, -0.3, 1))
# Costal cartilage bridging the true ribs (1-7) to the sternum.
for i in range(7):
    _cy = 1.425 - i * 0.0295
    _cw = rib_widths[i]
    _sy = min(max(_cy - 0.015, 1.240), 1.400)
    for s, side in ((-1, "L"), (1, "R")):
        bone(f"CostalCartilage_{i + 1:02d}_{side}",
             lambda s=s, _cw=_cw, _cy=_cy, _sy=_sy: make_tube([
                 (s * _cw * 0.52, _cy - 0.062, 0.125),
                 (s * _cw * 0.34, _cy - 0.058, 0.140),
                 (s * 0.022, _sy, 0.146),
             ], 0.0062, samples_per_segment=8),
             separation=(s * 0.5, 0, 0.8))

# -- Shoulder girdle ---------------------------------------------------------
for s, side in ((-1, "L"), (1, "R")):
    bone(f"Clavicle_{side}",
         lambda s=s: make_tube([
             (s * 0.030, 1.458, 0.138), (s * 0.100, 1.472, 0.115),
             (s * 0.160, 1.468, 0.060), (s * 0.205, 1.452, 0.012),
         ], 0.0105),
         separation=(s, 0.15, 0))
    bone(f"Scapula_{side}",
         lambda s=s: xform(make_box((0.095, 0.135, 0.016)),
                                    rotate=(0.06, -s * 0.38, s * 0.08),
                                    translate=(s * 0.128, 1.345, -0.112)),
         separation=(s, 0.1, -0.35))

# -- Arms --------------------------------------------------------------------
for s, side in ((-1, "L"), (1, "R")):
    bone(f"Humerus_Head_{side}",
         lambda s=s: xform(make_sphere(0.028), translate=(s * 0.212, 1.442, 0.002)),
         separation=(s * 0.3, 1, 0))
    bone(f"Humerus_{side}",
         lambda s=s: capsule_between((s * 0.222, 1.425, 0), (s * 0.243, 1.135, 0), 0.026),
         separation=(s * 0.25, -1, 0))
    bone(f"Radius_{side}",
         lambda s=s: capsule_between((s * 0.248, 1.100, 0.010), (s * 0.252, 0.872, 0.010), 0.015),
         separation=(s * 0.25, -1, 0))
    bone(f"Ulna_{side}",
         lambda s=s: capsule_between((s * 0.233, 1.105, -0.012), (s * 0.238, 0.868, -0.006), 0.017),
         separation=(s * 0.25, -1, 0))
    bone(f"Carpal_{side}_01",
         lambda s=s: xform(make_sphere(0.019), translate=(s * 0.245, 0.848, 0.012)),
         separation=(s * 0.2, -1, 0.1))
    bone(f"Carpal_{side}_02",
         lambda s=s: xform(make_sphere(0.019), translate=(s * 0.245, 0.848, -0.014)),
         separation=(s * 0.2, -1, 0.1))

# -- Hands -------------------------------------------------------------------
for s, side in ((-1, "L"), (1, "R")):
    for f in range(4):
        x = s * (0.222 + f * 0.016)
        bone(f"Metacarpal_{side}_{f + 1:02d}",
             lambda x=x: capsule_between((x, 0.830, 0.008), (x, 0.758, 0.010), 0.0085),
             separation=(s * 0.2, -1, 0.1))
        y0, r = 0.758, [0.0075, 0.0065, 0.0055]
        segs = [(0.034, r[0]), (0.027, r[1]), (0.022, r[2])]
        for p, (ln, pr) in enumerate(segs):
            # Stacked segments along -Y; capsule_between makes each segment
            # `ln` tall including its rounded ends.
            a = (x, y0 - 0.004, 0.010)
            b = (x, y0 - ln - 0.004, 0.010)
            bone(f"Finger_{side}_{f + 1}_Phalanx_{p + 1}",
                 lambda a=a, b=b, pr=pr: capsule_between(a, b, pr),
                 separation=(s * 0.2, -1, 0.1))
            y0 -= ln + 0.006
    bone(f"Thumb_{side}_1",
         lambda s=s: capsule_between((s * 0.208, 0.815, 0.012), (s * 0.190, 0.772, 0.028), 0.0085),
         separation=(s * 0.35, -0.9, 0.2))
    bone(f"Thumb_{side}_2",
         lambda s=s: capsule_between((s * 0.190, 0.772, 0.028), (s * 0.178, 0.738, 0.040), 0.0075),
         separation=(s * 0.35, -0.9, 0.2))

# -- Pelvis: curved iliac blades, sacrum, ring-like ischium/pubis -----------
for s, side in ((-1, "L"), (1, "R")):
    bone(f"Pelvis_Ilium_{side}",
         # Yaw ~150°: the dished iliac fossa faces anteromedial (into the
         # pelvic bowl, as in a real anterior view); the crest runs from
         # ASIS (front) back-out to the posterior crest. Roll flares the
         # crest outward. Tapered fan: wide crest narrowing to the hip joint.
         lambda s=s: xform(make_curved_plate(0.110, 0.120, 0.020, 0.150, taper_bottom=0.55),
                           rotate=(0.05, s * 2.61, -s * 0.18),
                           translate=(s * 0.090, 0.930, -0.006)),
         separation=(s * 0.8, 0.25, -0.2))
    bone(f"Pelvis_Ischium_{side}",
         lambda s=s: make_tube([
             (s * 0.078, 0.895, -0.018), (s * 0.066, 0.848, -0.002),
             (s * 0.052, 0.822, 0.020), (s * 0.038, 0.818, 0.038),
         ], 0.016, samples_per_segment=10),
         separation=(s * 0.5, -0.8, 0.1))
    bone(f"Pelvis_Pubis_{side}",
         lambda s=s: make_tube([
             (s * 0.038, 0.818, 0.038), (s * 0.024, 0.824, 0.052),
             (s * 0.010, 0.838, 0.058),
         ], 0.013, samples_per_segment=8),
         separation=(s * 0.4, -0.5, 0.6))
bone("Pelvis_Symphysis",
     lambda: xform(make_box((0.026, 0.038, 0.026)), translate=(0, 0.840, 0.058)))

# -- Legs ----------------------------------------------------------------------
for s, side in ((-1, "L"), (1, "R")):
    bone(f"Hip_Femur_Trochanter_{side}",
         lambda s=s: xform(make_box((0.028, 0.050, 0.030)),
                           rotate=(0, 0, -s * 0.10),
                           translate=(s * 0.120, 0.850, -0.002)),
         separation=(s * 0.9, -0.2, 0))
    bone(f"Femoral_Head_{side}",
         lambda s=s: xform(make_sphere(0.042), translate=(s * 0.092, 0.888, 0.008)),
         separation=(s * 0.85, -0.35, 0))
    bone(f"Hip_Femur_{side}",
         lambda s=s: capsule_between((s * 0.098, 0.858, 0.002), (s * 0.112, 0.535, 0.006), 0.029),
         separation=(s * 0.85, -0.35, 0))
    bone(f"Knee_Distal_Femur_{side}",
         lambda s=s: capsule_between((s * 0.112, 0.535, 0.006), (s * 0.114, 0.452, 0.010), 0.035),
         separation=(0, 0.9, 0.15))
    bone(f"Patella_{side}",
         lambda s=s: xform(make_sphere(0.027), scale=(1, 1.15, 0.55),
                            translate=(s * 0.114, 0.452, 0.048)),
         separation=(0, 0, 1))
    bone(f"Knee_Proximal_Tibia_{side}",
         lambda s=s: capsule_between((s * 0.114, 0.432, 0.006), (s * 0.115, 0.335, 0.006), 0.031),
         separation=(0, -1, 0))
    bone(f"Knee_Tibia_{side}",
         lambda s=s: capsule_between((s * 0.115, 0.335, 0.006), (s * 0.115, 0.135, 0.006), 0.023),
         separation=(0, -1, 0))
    bone(f"Knee_Fibula_{side}",
         lambda s=s: capsule_between((s * 0.148, 0.400, -0.004), (s * 0.146, 0.125, -0.004), 0.0105),
         separation=(s * 0.3, -1, 0))
    bone(f"Distal_Tibia_{side}",
         lambda s=s: xform(make_box((0.052, 0.058, 0.048)),
                                    translate=(s * 0.115, 0.105, 0.006)))
    bone(f"Distal_Fibula_{side}",
         lambda s=s: xform(make_box((0.028, 0.065, 0.032)),
                                    translate=(s * 0.148, 0.098, -0.004)))
    bone(f"Talus_{side}",
         lambda s=s: xform(make_sphere(0.029), translate=(s * 0.117, 0.068, 0.012)))
    bone(f"Calcaneus_{side}",
         lambda s=s: xform(make_box((0.052, 0.052, 0.082)),
                                    translate=(s * 0.117, 0.030, -0.028)))
    bone(f"Tarsal_{side}_01",
         lambda s=s: xform(make_sphere(0.020), translate=(s * 0.117, 0.052, 0.048)))
    bone(f"Tarsal_{side}_02",
         lambda s=s: xform(make_sphere(0.018), translate=(s * 0.117, 0.046, 0.078)))
    for t in range(5):
        off = -0.024 + t * 0.012
        bone(f"Metatarsal_{side}_{t + 1:02d}",
             lambda s=s, off=off: capsule_between(
                 (s * 0.117 + off, 0.030, 0.055), (s * 0.117 + off, 0.026, 0.128), 0.0075))
        pr = 0.0075 if t == 2 else 0.006
        # Named without "Phalanx" — that keyword belongs to the hand group;
        # /toe/i alone routes these to the foot group.
        bone(f"Toe_{side}_{t + 1:02d}",
             lambda s=s, off=off, pr=pr: capsule_between(
                 (s * 0.117 + off, 0.026, 0.132), (s * 0.117 + off, 0.024, 0.158), pr))

# ---------------------------------------------------------------------------
# Build-time self-checks: every mesh must classify into its expected anatomy
# group (ports the ANATOMY_KEYWORDS regexes from anatomyMapping.ts), and every
# triangle must wind outward.
# ---------------------------------------------------------------------------

KEYWORDS = {
    "skull": [r"skull", r"cranium", r"mandible", r"^jaw", r"head[_-]?bone"],
    "spine": [r"spine", r"vertebra", r"vertebrae", r"cervical", r"lumbar", r"sacrum",
              r"coccyx", r"^c[1-7]$", r"^t[1-9]$|^t1[0-2]$", r"^l[1-5]$"],
    "ribCage": [r"rib", r"sternum", r"thora[cx]", r"costal"],
    "shoulder": [r"clavicle", r"scapula", r"shoulder"],
    "arm": [r"humerus", r"radius", r"ulna", r"forearm", r"(^|[_-])arm([_-]|$)"],
    "hand": [r"carpal", r"metacarpal", r"phalan(x|ge)", r"(^|[_-])hand([_-]|$)",
             r"finger", r"thumb"],
    "pelvis": [r"pelvis", r"pelvic", r"ilium", r"ischium", r"pubis"],
    "hip": [r"hip", r"femur[_-]?head", r"femoral[_-]?head", r"acetabulum"],
    "knee": [r"knee", r"patella", r"distal[_-]?femur", r"proximal[_-]?tibia",
             r"tibial[_-]?plateau"],
    "ankle": [r"ankle", r"talus", r"distal[_-]?tibia", r"distal[_-]?fibula", r"malleolus"],
    "foot": [r"tarsal", r"metatarsal", r"calcaneus", r"(^|[_-])foot([_-]|$)", r"toe"],
}
GROUP_ORDER = ["skull", "spine", "ribCage", "shoulder", "arm", "hand",
               "pelvis", "hip", "knee", "ankle", "foot"]
COMPILED = {k: [re.compile(p, re.IGNORECASE) for p in v] for k, v in KEYWORDS.items()}


def classify(name):
    for key in GROUP_ORDER:
        if any(p.search(name) for p in COMPILED[key]):
            return key
    return None


EXPECTED_GROUP = {}
for _name, _geo_fn, _sep in BONES:
    if _name.startswith("Skull") or _name.startswith("Mandible"):
        EXPECTED_GROUP[_name] = "skull"
    elif _name.startswith("Vertebra") or _name == "Sacrum":
        EXPECTED_GROUP[_name] = "spine"
    elif _name.startswith("Rib") or _name.startswith("Sternum") or _name.startswith("Costal"):
        EXPECTED_GROUP[_name] = "ribCage"
    elif _name.startswith("Clavicle") or _name.startswith("Scapula"):
        EXPECTED_GROUP[_name] = "shoulder"
    elif any(_name.startswith(p) for p in ("Humerus", "Radius", "Ulna")):
        EXPECTED_GROUP[_name] = "arm"
    elif any(_name.startswith(p) for p in ("Carpal", "Metacarpal", "Finger", "Thumb")):
        EXPECTED_GROUP[_name] = "hand"
    elif _name.startswith("Pelvis"):
        EXPECTED_GROUP[_name] = "pelvis"
    elif _name.startswith("Femoral") or _name.startswith("Hip_Femur"):
        EXPECTED_GROUP[_name] = "hip"
    elif _name.startswith("Knee") or _name.startswith("Patella"):
        EXPECTED_GROUP[_name] = "knee"
    elif _name.startswith("Distal") or _name.startswith("Talus"):
        EXPECTED_GROUP[_name] = "ankle"
    elif any(_name.startswith(p) for p in ("Calcaneus", "Tarsal", "Metatarsal", "Toe")):
        EXPECTED_GROUP[_name] = "foot"
    else:
        raise AssertionError(f"No expected group for {_name}")


# ---------------------------------------------------------------------------
# glTF 2.0 binary writer.
# ---------------------------------------------------------------------------

def build_gltf():
    buffer_bytes = bytearray()
    accessors, buffer_views, meshes, nodes = [], [], [], []

    def push_accessor(array, component_type, gltf_type, target, min_max=False):
        byte_offset = len(buffer_bytes)
        data = array.tobytes()
        buffer_bytes.extend(data)
        pad = (-len(buffer_bytes)) % 4
        buffer_bytes.extend(b"\x00" * pad)
        buffer_views.append({
            "buffer": 0, "byteOffset": byte_offset,
            "byteLength": len(data), "target": target,
        })
        accessor = {
            "bufferView": len(buffer_views) - 1,
            "componentType": component_type,
            "count": array.shape[0], "type": gltf_type,
        }
        if min_max:
            accessor["min"] = array.min(axis=0).tolist()
            accessor["max"] = array.max(axis=0).tolist()
        accessors.append(accessor)
        return len(accessors) - 1

    for name, geo_fn, separation in BONES:
        geo = geo_fn()
        check_winding(name, geo)
        actual = classify(name)
        expected = EXPECTED_GROUP[name]
        assert actual == expected, f"{name}: classified as {actual}, expected {expected}"

        positions, normals, indices = geo
        pos_idx = push_accessor(positions, 5126, "VEC3", 34962, min_max=True)
        norm_idx = push_accessor(normals, 5126, "VEC3", 34962)
        idx_idx = push_accessor(indices.reshape(-1).astype(np.uint32), 5125, "SCALAR", 34963)

        meshes.append({
            "name": name,
            "primitives": [{
                "attributes": {"POSITION": pos_idx, "NORMAL": norm_idx},
                "indices": idx_idx, "mode": 4, "material": 0,
            }],
        })
        node = {"name": name, "mesh": len(meshes) - 1}
        if separation is not None:
            node["extras"] = {"separationOffset": separation}
        nodes.append(node)

    gltf = {
        "asset": {"version": "2.0", "generator": "physio-site skeleton exporter v2"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": meshes,
        "accessors": accessors,
        "bufferViews": buffer_views,
        "materials": [{
            "name": "Bone",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.937, 0.914, 0.863, 1.0],
                "metallicFactor": 0.03, "roughnessFactor": 0.55,
            },
        }],
        "buffers": [{"byteLength": len(buffer_bytes)}],
    }
    return gltf, bytes(buffer_bytes)


def write_glb(gltf, bin_chunk, out_path):
    json_chunk = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_chunk += b" " * ((-len(json_chunk)) % 4)
    bin_chunk = bin_chunk + b"\x00" * ((-len(bin_chunk)) % 4)
    total_length = 12 + (8 + len(json_chunk)) + (8 + len(bin_chunk))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total_length))
        f.write(struct.pack("<II", len(json_chunk), 0x4E4F534A))
        f.write(json_chunk)
        f.write(struct.pack("<II", len(bin_chunk), 0x004E4942))
        f.write(bin_chunk)


if __name__ == "__main__":
    gltf, bin_chunk = build_gltf()
    write_glb(gltf, bin_chunk, OUT_PATH)
    size_kb = OUT_PATH.stat().st_size / 1024
    groups = {}
    for name, _, _ in BONES:
        groups[classify(name)] = groups.get(classify(name), 0) + 1
    print(f"Wrote {OUT_PATH} ({size_kb:.1f} KB, {len(BONES)} meshes)")
    print("Group counts:", {k: groups.get(k, 0) for k in GROUP_ORDER})
