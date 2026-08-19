"""
a_star.py — Reachability-aware A* pathfinder for the lunar cost grid.

Two-phase approach:
  Phase 1 (BFS): Pre-compute reachability mask — marks cells unreachable from start
                 before A* wastes time in dead ends (e.g., inside steep crater walls).
  Phase 2 (A*):  Best-first search on the cost grid with Euclidean heuristic.

Movement model: 8-connected grid (cardinal + diagonal).
Diagonal moves incur a 1.414× distance penalty.
Includes automatic snap-to-nearest-navigable-cell for edge-case point selections.
Guarantees seamless line connection from exact start coordinate to exact goal coordinate.
"""
import heapq
import numpy as np
from collections import deque
from config import GRID_SIZE, SOUTH_POLE_BBOX, PIXEL_SIZE_M

_NEIGHBORS_8 = [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(-1,1),(1,-1),(1,1)]

def find_nearest_navigable_cell(cost_grid: np.ndarray, cell: tuple[int, int], max_radius: int = 15) -> tuple[int, int]:
    """
    If a selected point is in impassable terrain (slope > max_slope),
    finds the nearest navigable cell within a max_radius grid search.
    """
    H, W = cost_grid.shape
    if _in_bounds(cell, H, W) and cost_grid[cell] != np.inf:
        return cell

    r, c = cell
    best_cell = cell
    best_dist = float('inf')

    for dr in range(-max_radius, max_radius + 1):
        for dc in range(-max_radius, max_radius + 1):
            nr, nc = r + dr, c + dc
            if _in_bounds((nr, nc), H, W) and cost_grid[nr, nc] != np.inf:
                dist = dr * dr + dc * dc
                if dist < best_dist:
                    best_dist = dist
                    best_cell = (nr, nc)

    return best_cell

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
    Automatically snaps start and goal to nearest navigable cells if needed.
    """
    H, W = cost_grid.shape

    # ── Auto-snap impassable start/goal to nearest navigable cell ─────────
    start = find_nearest_navigable_cell(cost_grid, start)
    goal  = find_nearest_navigable_cell(cost_grid, goal)

    if not _in_bounds(start, H, W) or not _in_bounds(goal, H, W):
        return []
    if cost_grid[start] == np.inf or cost_grid[goal] == np.inf:
        return []
    if start == goal:
        return [start]

    # ── BFS reachability pre-filter ────────────────────────────────────────
    reachable = bfs_reachable(cost_grid, start)
    if not reachable[goal]:
        return []

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

def grid_to_lonlat(
    row: int, col: int, grid_size: int = GRID_SIZE, bbox: dict = SOUTH_POLE_BBOX
) -> tuple[float, float]:
    lon = bbox["lon_min"] + (col / grid_size) * (bbox["lon_max"] - bbox["lon_min"])
    lat = bbox["lat_max"] - (row / grid_size) * (bbox["lat_max"] - bbox["lat_min"])
    return round(lon, 6), round(lat, 6)

def lonlat_to_grid(
    lon: float, lat: float, grid_size: int = GRID_SIZE, bbox: dict = SOUTH_POLE_BBOX
) -> tuple[int, int]:
    col = int((lon - bbox["lon_min"]) / (bbox["lon_max"] - bbox["lon_min"]) * grid_size)
    row = int((bbox["lat_max"] - lat) / (bbox["lat_max"] - bbox["lat_min"]) * grid_size)
    col = max(0, min(col, grid_size - 1))
    row = max(0, min(row, grid_size - 1))
    return row, col

def path_to_geojson(
    path: list[tuple[int, int]],
    dem: np.ndarray = None,
    slope_grid: np.ndarray = None,
    exact_start: tuple[float, float] = None,
    exact_goal: tuple[float, float] = None,
    grid_size: int = GRID_SIZE,
    bbox: dict = SOUTH_POLE_BBOX,
    pixel_size_m: float = PIXEL_SIZE_M,
) -> dict:
    if not path:
        return {"type": "Feature", "geometry": None, "properties": {}}

    coordinates = [
        list(grid_to_lonlat(r, c, grid_size, bbox)) for r, c in path
    ]
    
    # Prepend exact start and append exact goal to guarantee seamless line join
    if exact_start is not None:
        coordinates[0] = [round(exact_start[0], 6), round(exact_start[1], 6)]
    if exact_goal is not None:
        coordinates[-1] = [round(exact_goal[0], 6), round(exact_goal[1], 6)]

    # Compute path metrics & elevation slice profile
    elevation_profile = []
    slopes = []
    total_dist_km = 0.0
    
    for i, (r, c) in enumerate(path):
        elev = float(dem[r, c]) if dem is not None and _in_bounds((r, c), *dem.shape) else 0.0
        slp = float(slope_grid[r, c]) if slope_grid is not None and _in_bounds((r, c), *slope_grid.shape) else 0.0
        slopes.append(slp)
        elevation_profile.append({
            "step": i,
            "lon": coordinates[i][0],
            "lat": coordinates[i][1],
            "elevation_m": round(elev, 1),
            "slope_deg": round(slp, 1)
        })
        if i > 0:
            dr = abs(path[i][0] - path[i-1][0])
            dc = abs(path[i][1] - path[i-1][1])
            step_m = (1.4142 if dr != 0 and dc != 0 else 1.0) * pixel_size_m
            total_dist_km += step_m / 1000.0

    max_slope = float(np.max(slopes)) if slopes else 0.0
    mean_slope = float(np.mean(slopes)) if slopes else 0.0
    # Estimated energy consumption: 15W baseline rover motor + 8W per deg slope per km
    est_energy_wh = round(total_dist_km * (15.0 + mean_slope * 8.0), 1)

    return {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": coordinates,
        },
        "properties": {
            "waypoints": len(coordinates),
            "distance_km": round(total_dist_km, 3),
            "max_slope_deg": round(max_slope, 1),
            "mean_slope_deg": round(mean_slope, 1),
            "est_energy_wh": est_energy_wh,
            "start_lonlat": coordinates[0],
            "goal_lonlat": coordinates[-1],
            "elevation_profile": elevation_profile
        },
    }

def _in_bounds(cell: tuple[int, int], H: int, W: int) -> bool:
    r, c = cell
    return 0 <= r < H and 0 <= c < W
