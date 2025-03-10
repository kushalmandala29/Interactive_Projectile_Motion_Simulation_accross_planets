# AR Solar System

An immersive 3D Solar System simulation with AR capabilities, featuring explorable planets and an interactive astronaut character.

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|----------|
| JavaScript | ES6+ | Core programming language |
| Three.js | ^0.128.0 | 3D graphics rendering and scene management |
| Cannon.js | ^0.15.1 | Physics engine for realistic movements and interactions |
| TensorFlow.js | ^3.0.0 | Hand tracking and gesture recognition |
| WebGL | 2.0 | Hardware-accelerated graphics rendering |
| HTML5 | Latest | Structure and canvas elements |
| CSS3 | Latest | Styling and animations |

## Table of Contents
- [Features](#features)
- [Quick Start](#quick-start)
- User Guide
- Project Architecture
- Installation
- Customization Guide
- Development Guide
- Troubleshooting

## Quick Start

1. Clone and install:
git clone https://github.com/yourusername/ar-solar-system.git
cd ar-solar-system
npm install
npm start

2. Open http://localhost:8080 in your browser
3. Allow camera access when prompted

## User Guide

### Navigation Controls

1. Solar System View
   - Left Click: Select planet
   - Right Click + Drag: Rotate camera
   - Mouse Wheel: Zoom in/out
   - Spacebar: Reset camera position

2. Planet Environment
   - WASD: Move astronaut
   - Mouse Move: Look around
   - Left Click: Throw ball
   - E: Pick up ball
   - Q: Return to solar system
   - R: Reset astronaut position

### Gesture Controls

1. Hand Tracking Setup
   - Enable camera access
   - Hold hand up with palm facing camera
   - Wait for hand skeleton overlay
   - Use following gestures:
     - Open Palm: Grab ball
     - Closed Fist: Hold ball
     - Quick Open: Throw ball
     - Peace Sign: Switch view mode
     - Thumbs Up: Return to solar system

2. Calibrating Hand Tracking
   - Ensure good lighting
   - Keep hand within camera frame
   - Perform slow movements initially
   - Maintain 0.5-1.5m distance from camera

### Environment Interaction

1. Planet Selection
   - Click on any planet in solar system view
   - Wait for environment to load
   - Explore unique atmosphere and physics

2. Ball Physics
   - Each planet has unique gravity
   - Ball bounces affected by surface material
   - Throwing force proportional to gesture speed

## Customization Guide

### 1. Planet Properties

Edit models/solarSystem.js:
// Modify planet properties
this.planets = {
    'Earth': {
        radius: 6371,              // Planet size (km)
        distance: 149.6e6,         // Distance from sun (km)
        rotationSpeed: 0.001,      // Rotation speed
        orbitSpeed: 0.01,          // Orbit speed
        texture: '/textures/earth.jpg',
        atmosphere: true,          // Enable atmosphere
        rings: false               // Enable rings (like Saturn)
    }
};

### 2. Environment Colors

Edit models/planetEnvironment.js:
// Customize planet environment
this.planetEnvironments = {
    'Mars': {
        sky: 0xCD5C5C,            // Sky color (hex)
        ground: 0x8B4513,         // Ground color (hex)
        ambient: 0xFA8072,        // Ambient light color
        fog: 0xBC8F8F,           // Fog color
        fogDensity: 0.002         // Fog density
    }
};

### 3. Physics Settings

// Modify physics in planetEnvironment.js
this.physicsWorld = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0),  // Gravity strength
    friction: 0.5,                          // Surface friction
    restitution: 0.7                        // Bounce factor
});

### 4. Character Settings

```javascript
// Adjust character properties
this.character = {
    height: 2,                    // Character height
    mass: 80,                     // Physics mass
    jumpForce: 400,              // Jump strength
    moveSpeed: 10,               // Movement speed
    turnSpeed: 0.1               // Rotation speed
    Rotation speed
};

## Development Guide

### Project Structure
ar-solar-system/
├── models/
│   ├── solarSystem.js       # Solar system logic
│   ├── planetEnvironment.js # Planet environments
│   └── character.js         # Character controls
├── textures/
│   ├── planets/            # Planet textures
│   └── environment/        # Environment maps
├── shaders/
│   ├── atmosphere.glsl     # Atmosphere effects
│   └── space.glsl         # Space background
├── app.js                  # Main application
└── index.html             # Entry point
```

### Adding New Features

1. **New Planet Features**
   ```javascript
   // Add new planet feature in solarSystem.js
   addPlanetFeature(planet, featureType) {
       switch(featureType) {
           case 'rings':
               // Add ring geometry
               break;
           case 'moons':
               // Add moons
               break;
       }
   }
   ```

2. New Gestures
      // Add gesture in handTracking.js
   addGesture(name, fingerPositions) {
       this.gestures[name] = {
           positions: fingerPositions,
           threshold: 0.8
       };
   }
   

## Troubleshooting

### Common Issues

1. Performance Issues
   - Reduce texture sizes
   - Lower particle count
   - Disable post-processing
   - Update graphics drivers

2. Hand Tracking Problems
   - Ensure good lighting
   - Keep hands in camera view
   - Reduce background movement
   - Check camera permissions

3. Physics Glitches
   - Reduce time step
   - Increase iteration count
   - Check collision margins
   - Adjust body masses

### Debug Mode

Enable debug mode for development:
// In app.js
const DEBUG = true;
if (DEBUG) {
    this.stats.show();           // Show FPS counter
    this.physics.debugRenderer.enable(); // Show physics wireframes
    this.showGridHelper();      // Show grid
}

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments
- Planet textures from NASA
- Three.js community for resources
- TensorFlow team for hand tracking models"# ar-vr" 
"# ar-vr" 
"# ar-vr" 
