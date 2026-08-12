"""
a_star.py — Reachability-aware A* pathfinder for the lunar cost grid.

Two-phase approach:
  Phase 1 (BFS): Pre-compute reachability mask — marks cells unreachable from start
                 before A* wastes time in dead ends (e.g., inside steep crater walls).
  Phase 2 (A*):  Best-first search on the cost grid with Euclidean heuristic.

Movement model: 8-connected grid (cardinal + diagonal).
Diagonal moves incur a 1.414× distance penalty.
"""
import heapq
import numpy as np
from collections import deque
from config import GRID_SIZE, SOUTH_POLE_BBOX


# ──────────────────────────────────────────────────────────────────────────────
# BFS Reachability pre-filter
# ──────────────────────────────────────────────────────────────────────────────
_NEIGHBORS_8 = [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(-1,1),(1,-1),(1,1)]

def bfs_reachable(cost_grid: np.ndarray, start: tuple[int, int]) -> np.ndarray:
    """
    BFS flood-fill from start through all finite-cost cells.
    Returns a boolean array: True = cell is reachable from start.
    """
    H, W = cost_grid.shape
    visited = np.zeros((H, W), dtype=bool)

    if not _in_bounds(start, H, W) or cost_grid[start] == np.inf:
        return visited

    queue = deque([start])
    visited[start] = True

    while queue:
        r, c = queue.popleft()
        for dr, dc in _NEIGHBORS_8:
            nr, nc = r + dr, c + dc
            if _in_bounds((nr, nc), H, W) and not visited[nr, nc] and cost_grid[nr, nc] != np.inf:
                visited[nr, nc] = True
                queue.append((nr, nc))

    return visited


# ──────────────────────────────────────────────────────────────────────────────
# A* search
# ──────────────────────────────────────────────────────────────────────────────
def _heuristic(a: tuple, b: tuple) -> float:
    """Euclidean distance heuristic (admissible for 8-connected grid)."""
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5


def a_star_search(
    cost_grid: np.ndarray,
    start: tuple[int, int],
    goal: tuple[int, int],
) -> list[tuple[int, int]]:
    """
    Find the minimum-cost path from start to goal on the cost grid.

    Returns:
        List of (row, col) tuples from start to goal (inclusive),
        or empty list if no path exists.
    """
    H, W = cost_grid.shape

    # ── Sanity checks ──────────────────────────────────────────────────────
    if not _in_bounds(start, H, W) or not _in_bounds(goal, H, W):
        return []
    if cost_grid[start] == np.inf:
        return []
    if cost_grid[goal] == np.inf:
        return []
    if start == goal:
        return [start]

    # ── BFS reachability pre-filter ────────────────────────────────────────
    reachable = bfs_reachable(cost_grid, start)
    if not reachable[goal]:
        return []          # Goal is unreachable — skip expensive A* entirely

    # ── A* search ─────────────────────────────────────────────────────────
    frontier: list = []
    heapq.heappush(frontier, (0.0, start))

    came_from: dict[tuple, tuple | None] = {start: None}
    g_score: dict[tuple, float] = {start: 0.0}

    while frontier:
        _, current = heapq.heappop(frontier)

        if current == goal:
            break

        cr, cc = current
        for dr, dc in _NEIGHBORS_8:
            nr, nc = cr + dr, cc + dc
            neighbor = (nr, nc)

            if not _in_bounds(neighbor, H, W):
                continue
            step_cost = float(cost_grid[neighbor])
            if step_cost == np.inf:
                continue

            # Diagonal moves are √2 longer
            if dr != 0 and dc != 0:
                step_cost *= 1.4142

            tentative_g = g_score[current] + step_cost

            if neighbor not in g_score or tentative_g < g_score[neighbor]:
                g_score[neighbor] = tentative_g
                f = tentative_g + _heuristic(neighbor, goal)
                heapq.heappush(frontier, (f, neighbor))
                came_from[neighbor] = current

    # ── Reconstruct path ───────────────────────────────────────────────────
    if goal not in came_from:
        return []

    path: list[tuple] = []
    node: tuple | None = goal
    while node is not None:
        path.append(node)
        node = came_from[node]
    path.reverse()
    return path


# ──────────────────────────────────────────────────────────────────────────────
# Coordinate conversion: grid pixel → lunar lon/lat
# ──────────────────────────────────────────────────────────────────────────────
def grid_to_lonlat(
    row: int, col: int, grid_size: int = GRID_SIZE, bbox: dict = SOUTH_POLE_BBOX
) -> tuple[float, float]:
    """
    Convert a grid (row, col) to lunar (longitude, latitude).
    The simulation grid spans the SOUTH_POLE_BBOX bounding box.
    """
    lon = bbox["lon_min"] + (col / grid_size) * (bbox["lon_max"] - bbox["lon_min"])
    lat = bbox["lat_max"] - (row / grid_size) * (bbox["lat_max"] - bbox["lat_min"])
    return round(lon, 6), round(lat, 6)


def lonlat_to_grid(
    lon: float, lat: float, grid_size: int = GRID_SIZE, bbox: dict = SOUTH_POLE_BBOX
) -> tuple[int, int]:
    """
    Convert lunar (longitude, latitude) to grid (row, col).
    """
    col = int((lon - bbox["lon_min"]) / (bbox["lon_max"] - bbox["lon_min"]) * grid_size)
    row = int((bbox["lat_max"] - lat) / (bbox["lat_max"] - bbox["lat_min"]) * grid_size)
    col = max(0, min(col, grid_size - 1))
    row = max(0, min(row, grid_size - 1))
    return row, col


def path_to_geojson(
    path: list[tuple[int, int]],
    grid_size: int = GRID_SIZE,
    bbox: dict = SOUTH_POLE_BBOX,
) -> dict:
    """
    Convert a list of grid (row, col) waypoints to a GeoJSON LineString
    with lon/lat coordinates.
    """
    if not path:
        return {"type": "Feature", "geometry": None, "properties": {}}

    coordinates = [
        list(grid_to_lonlat(r, c, grid_size, bbox)) for r, c in path
    ]
    return {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": coordinates,
        },
        "properties": {
            "waypoints": len(path),
            "start_lonlat": coordinates[0],
            "goal_lonlat":  coordinates[-1],
        },
    }


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────
def _in_bounds(cell: tuple[int, int], H: int, W: int) -> bool:
    r, c = cell
    return 0 <= r < H and 0 <= c < W
