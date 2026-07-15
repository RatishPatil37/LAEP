import streamlit as st
import numpy as np
import matplotlib.pyplot as plt
from scipy.ndimage import gaussian_filter, generic_filter
import heapq

# --- SETTINGS ---
GRID_SIZE = 100
PIXEL_SIZE_M = 25.0

# --- PHASE 1: DATA MOCKUP ---
@st.cache_data
def generate_simulated_data():
    """Generates a simulated crater DEM and shadow map for the demo."""
    # Base terrain (flatish with slight noise)
    dem = np.random.normal(loc=100.0, scale=2.0, size=(GRID_SIZE, GRID_SIZE))
    
    # Create a large primary crater
    x, y = np.ogrid[:GRID_SIZE, :GRID_SIZE]
    center_x, center_y = GRID_SIZE // 2, GRID_SIZE // 2
    dist_from_center = np.sqrt((x - center_x)**2 + (y - center_y)**2)
    
    crater_radius = 35
    crater_depth = 40
    
    # Apply crater shape (parabolic bowl)
    crater_mask = dist_from_center < crater_radius
    dem[crater_mask] -= (crater_depth * (1 - (dist_from_center[crater_mask] / crater_radius)**2))
    
    # Smooth the DEM to simulate natural terrain
    dem = gaussian_filter(dem, sigma=3)
    
    # Simulated shadow persistence (deepest parts are shadowed)
    shadow_map = np.clip((100 - dem) / 40.0, 0, 1)
    
    # Simulated Ice Score (high in the shadowed crater center)
    ice_score = np.zeros((GRID_SIZE, GRID_SIZE))
    ice_radius = 10
    ice_mask = dist_from_center < ice_radius
    ice_score[ice_mask] = 1.0 - (dist_from_center[ice_mask] / ice_radius)
    
    return dem, shadow_map, ice_score

# --- PHASE 2: TERRAIN INTELLIGENCE & COST GRID ---
def compute_slope(dem):
    """Calculates slope in degrees."""
    dz_dx, dz_dy = np.gradient(dem, PIXEL_SIZE_M)
    slope_rad = np.arctan(np.sqrt(dz_dx**2 + dz_dy**2))
    return np.degrees(slope_rad)

def build_cost_grid(slope, shadow_map, w_slope, w_shadow, max_slope=15.0):
    """Fuses slope and shadow into a pathfinding cost grid."""
    cost_grid = np.ones_like(slope) # Base cost
    
    # Hard safety constraint: Impassable if too steep
    impassable = slope > max_slope
    
    cost_grid += (w_slope * slope)
    cost_grid += (w_shadow * shadow_map * 50) # Penalize shadows heavily
    
    cost_grid[impassable] = np.inf
    return cost_grid

# --- PHASE 3: REACHABILITY-AWARE A* ALGORITHM ---
def heuristic(a, b):
    return np.sqrt((a[0] - b[0])**2 + (a[1] - b[1])**2)

def a_star_search(cost_grid, start, goal):
    """Finds the lowest-cost path on the grid."""
    if cost_grid[start] == np.inf or cost_grid[goal] == np.inf:
        return []

    frontier = []
    heapq.heappush(frontier, (0, start))
    came_from = {start: None}
    cost_so_far = {start: 0}

    neighbors_offsets = [(-1,0), (1,0), (0,-1), (0,1), (-1,-1), (-1,1), (1,-1), (1,1)]

    while frontier:
        _, current = heapq.heappop(frontier)

        if current == goal:
            break

        for dx, dy in neighbors_offsets:
            next_node = (current[0] + dx, current[1] + dy)
            
            # Bounds check
            if 0 <= next_node[0] < GRID_SIZE and 0 <= next_node[1] < GRID_SIZE:
                step_cost = cost_grid[next_node]
                if step_cost == np.inf:
                    continue
                
                # Diagonal penalty
                if dx != 0 and dy != 0:
                    step_cost *= 1.414
                    
                new_cost = cost_so_far[current] + step_cost
                if next_node not in cost_so_far or new_cost < cost_so_far[next_node]:
                    cost_so_far[next_node] = new_cost
                    priority = new_cost + heuristic(next_node, goal)
                    heapq.heappush(frontier, (priority, next_node))
                    came_from[next_node] = current

    # Reconstruct path
    if goal not in came_from:
        return [] # Path not found
        
    path = []
    current = goal
    while current != start:
        path.append(current)
        current = came_from[current]
    path.append(start)
    path.reverse()
    return path

# --- PHASE 4: STREAMLIT DASHBOARD ---
def main():
    st.set_page_config(layout="wide", page_title="LAEP Mission Simulator")
    st.title("🌔 Lunar Autonomous Exploration Pipeline (LAEP) Simulator")
    st.markdown("This dashboard demonstrates pathfinding from a safe landing site to a subsurface ice deposit without GPS.")
    
    dem, shadow_map, ice_score = generate_simulated_data()
    slope = compute_slope(dem)
    
    st.sidebar.header("Navigation Constraints")
    w_slope = st.sidebar.slider("Slope Penalty Weight", 0.0, 5.0, 1.0)
    w_shadow = st.sidebar.slider("Shadow Penalty Weight (Battery Drain)", 0.0, 5.0, 2.0)
    max_slope = st.sidebar.slider("Max Navigable Slope (Degrees)", 5.0, 30.0, 15.0)
    
    cost_grid = build_cost_grid(slope, shadow_map, w_slope, w_shadow, max_slope)
    
    # Fixed targets for demo
    start = (15, 15) # Safe, flat crater rim
    goal = (GRID_SIZE // 2, GRID_SIZE // 2) # Center of the crater (ice target)
    
    # Calculate Path
    path = a_star_search(cost_grid, start, goal)
    
    st.subheader("Mission Planning Visualization")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        fig1, ax1 = plt.subplots(figsize=(5,5))
        im1 = ax1.imshow(dem, cmap="terrain")
        ax1.set_title("Digital Elevation Model (DEM)")
        plt.colorbar(im1, ax=ax1, fraction=0.046, pad=0.04)
        ax1.axis('off')
        st.pyplot(fig1)
        
    with col2:
        fig2, ax2 = plt.subplots(figsize=(5,5))
        im2 = ax2.imshow(cost_grid, cmap="hot", vmax=np.percentile(cost_grid[cost_grid != np.inf], 95))
        ax2.set_title("Traversal Cost Grid")
        plt.colorbar(im2, ax=ax2, fraction=0.046, pad=0.04)
        ax2.axis('off')
        st.pyplot(fig2)
        
    with col3:
        fig3, ax3 = plt.subplots(figsize=(5,5))
        im3 = ax3.imshow(dem, cmap="gray")
        
        # Overlay Ice
        ice_overlay = np.ma.masked_where(ice_score < 0.1, ice_score)
        ax3.imshow(ice_overlay, cmap="Blues", alpha=0.6)
        
        # Overlay Path
        if path:
            path_y = [p[0] for p in path]
            path_x = [p[1] for p in path]
            ax3.plot(path_x, path_y, color='lime', linewidth=2.5, label="Rover Path")
            ax3.scatter(start[1], start[0], color='green', marker='s', s=100, label="Lander (Start)")
            ax3.scatter(goal[1], goal[0], color='cyan', marker='*', s=150, label="Ice Deposit (Goal)")
            ax3.legend(loc="upper right")
            
        ax3.set_title("Final Mission Traverse")
        ax3.axis('off')
        st.pyplot(fig3)
        
    if not path:
        st.error("No valid path found! The rover cannot reach the target under these constraints. Try increasing the Max Navigable Slope.")
    else:
        st.success(f"Safe path found! Total Waypoints: {len(path)}")

if __name__ == "__main__":
    main()
