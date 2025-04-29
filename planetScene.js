import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.145.0/build/three.module.js';
import { PlanetEnvironment } from './planetEnvironment.js';

export class PlanetScene {
    constructor(scene, camera) {
        // Initialize scene, camera and related properties
        this.scene = scene;
        this.camera = camera;
        this.environment = null;
        this.clock = new THREE.Clock();
        this.transitionDuration = 1000; // Duration for any transitions (in ms)
        this.isActive = false;
    }

    async setup(planetName) {
        try {
            // Clean up any existing environment
            if (this.environment) {
                this.cleanup();
            }
            
            // Create and set up the planet environment
            this.environment = new PlanetEnvironment(this.scene, this.camera);
            await this.environment.setup(planetName);
            
            // Start the clock if needed
            this.clock.start();
            this.isActive = true;
        } catch (error) {
            console.error('Error setting up planet scene:', error);
            this.cleanup();
            throw error;
        }
    }

    update() {
        if (this.environment && this.isActive) {
            // Call the environment's update method.
            // The PlanetEnvironment update loop is self-managed via requestAnimationFrame.
            this.environment.update();
        }
    }

    // The updateBallPosition method has been removed as ball positioning is handled
    // within the PlanetEnvironment (via attachBallToCharacter and trajectory updates).

    // Optionally, you can implement throwBall functionality as needed.
    // throwBall() {
    //     if (this.environment && this.isActive) {
    //         this.environment.throwBall();
    //         setTimeout(() => {
    //             if (this.environment && this.isActive) {
    //                 this.environment.resetBall();
    //             }
    //         }, 2000);
    //     }
    // }

    cleanup() {
        if (this.environment) {
            this.environment.cleanup();
            this.environment = null;
        }
        this.isActive = false;
        this.clock.stop();
    }
}
