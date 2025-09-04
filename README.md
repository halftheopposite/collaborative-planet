# collaborative-planet

## Architecture

### Game Class

The `Game` class (`src/Game.ts`) serves as the main entrypoint and orchestrator for the entire application. It encapsulates:

- **Scene Management**: Three.js scene, camera, renderer, and lighting setup
- **Input Handling**: Pointer events for sculpting and camera controls
- **Game Loop**: Animation loop with delta time management
- **Game Objects**: Earth, celestials, birds system, and action layer
- **Persistence**: Auto-saving of camera position and terrain heights
- **Lifecycle Management**: Initialization, start, stop, and cleanup methods

The original `index.ts` now simply creates and starts a Game instance, providing a clean separation of concerns.

### Key Features

- **Terrain Sculpting**: Ctrl+click to raise, Alt+click to lower terrain
- **Orbital Camera**: Mouse controls for orbiting around the planet
- **Persistence**: Automatic saving of camera position and terrain modifications
- **Multi-body System**: Earth, Moon, Mars, Saturn, and Sun with realistic movement
- **Birds**: Flocking behavior system that interacts with the terrain
