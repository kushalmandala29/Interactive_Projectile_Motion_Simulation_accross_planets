import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.145.0/build/three.module.js';
import * as TWEEN from 'https://cdn.jsdelivr.net/npm/@tweenjs/tween.js@18.6.4/dist/tween.esm.js';
import { PlanetEnvironment } from '../planetEnvironment.js';

export default class SolarSystem {
    constructor(scene, camera, renderer) {
        console.log('Initializing SolarSystem...');
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer.renderer || renderer; // Handle both Renderer class and raw THREE.WebGLRenderer
        this.planets = new Map();
        this.orbits = new Map();
        this.controls = null;
        this.originalCameraPosition = new THREE.Vector3(0, 30, 50);
        this.planetEnvironment = null;
        this.handTracker = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.lastClickTime = 0;
        this.selectedPlanet = null;
        
        // Initialize immediately
        this.init();
    }

    init() {
        try {
            console.log('Creating star field...');
            this.createStarField();
            
            console.log('Creating sun...');
            this.createSun();
            
            console.log('Creating planets...');
            this.createPlanets();
            
            console.log('Setting up lighting...');
            this.setupLighting();

            // Hide loading message
            const loadingElement = document.getElementById('loading');
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
        } catch (error) {
            console.error('Error initializing solar system:', error);
            const loadingElement = document.getElementById('loading');
            if (loadingElement) {
                loadingElement.textContent = 'Error loading solar system. Please refresh the page.';
            }
        }
    }

    createStarField() {
        const starGeometry = new THREE.BufferGeometry();
        const starMaterial = new THREE.PointsMaterial({
            color: 0xFFFFFF,
            size: 0.1,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true
        });

        const stars = [];
        for (let i = 0; i < 10000; i++) {
            const x = (Math.random() - 0.5) * 2000;
            const y = (Math.random() - 0.5) * 2000;
            const z = (Math.random() - 0.5) * 2000;
            stars.push(x, y, z);
        }

        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
        this.starField = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.starField);
    }

    createSun() {
        // Create sun geometry
        const sunGeometry = new THREE.SphereGeometry(5, 32, 32);
        
        // Create basic sun material
        const sunMaterial = new THREE.MeshBasicMaterial({
            color: 0xffdd00,
            emissive: 0xffdd00,
            emissiveIntensity: 1
        });

        this.sun = new THREE.Mesh(sunGeometry, sunMaterial);
        this.scene.add(this.sun);

        // Add sun glow
        const glowGeometry = new THREE.SphereGeometry(5.2, 32, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffdd00,
            transparent: true,
            opacity: 0.5,
            side: THREE.BackSide
        });

        const sunGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.sun.add(sunGlow);
    }

    createPlanets() {
        const planetData = {
            mercury: { radius: 1, distance: 10, color: 0x8C8C8C, speed: 0.0009, atmosphere: true },
            venus: { radius: 1.5, distance: 15, color: 0xE6B800, speed: 0.001, atmosphere: true },
            earth: { radius: 2, distance: 20, color: 0x2E5CB8, speed: 0.002, atmosphere: true },
            mars: { radius: 2, distance: 25, color: 0xCC4D29, speed: 0.001, atmosphere: true },
            jupiter: { radius: 4, distance: 35, color: 0xD8CA9D, speed: 0.002, atmosphere: true },
            saturn: { radius: 3.5, distance: 45, color: 0xF4D03F, speed: 0.001, atmosphere: true },
            uranus: { radius: 2.5, distance: 55, color: 0x73C6B6, speed: 0.0008, atmosphere: true },
            neptune: { radius: 2.4, distance: 65, color: 0x2E86C1, speed: 0.0006, atmosphere: true }
        };

        Object.entries(planetData).forEach(([name, data]) => {
            console.log(`Creating planet: ${name}`);
            // Create planet
            const planetGeometry = new THREE.SphereGeometry(data.radius, 32, 32);
            const planetMaterial = new THREE.MeshPhongMaterial({
                color: data.color,
                shininess: 30,
                emissive: new THREE.Color(data.color).multiplyScalar(0.1)
            });
            
            const planet = new THREE.Mesh(planetGeometry, planetMaterial);
            planet.position.x = data.distance;
            planet.name = name;
            planet.isPlanet = true;
            
            // Add atmosphere if needed
            if (data.atmosphere) {
                const atmosphereGeometry = new THREE.SphereGeometry(data.radius * 1.2, 32, 32);
                const atmosphereMaterial = new THREE.MeshBasicMaterial({
                    color: data.color,
                    transparent: true,
                    opacity: 0.2,
                    side: THREE.BackSide
                });
                const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
                planet.add(atmosphere);
            }

            // Create orbit
            const orbitGeometry = new THREE.RingGeometry(data.distance - 0.1, data.distance + 0.1, 128);
            const orbitMaterial = new THREE.MeshBasicMaterial({
                color: 0x666666,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide
            });
            const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
            orbit.rotation.x = Math.PI / 2;
            
            this.scene.add(orbit);
            this.scene.add(planet);
            
            this.planets.set(name, {
                mesh: planet,
                speed: data.speed,
                distance: data.distance,
                angle: Math.random() * Math.PI * 2
            });
            this.orbits.set(name, orbit);
        });

        this.setupPlanetInteraction();
    }

    setupLighting() {
        // Add point light at sun's position
        const sunLight = new THREE.PointLight(0xffffff, 2, 100);
        this.sun.add(sunLight);

        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0x333333);
        this.scene.add(ambientLight);
    }

    setupPlanetInteraction() {
        // Track clicks for double-click detection
        window.addEventListener('mousedown', (event) => this.onPlanetClick(event));
        window.addEventListener('touchstart', (event) => this.onPlanetTouch(event));
    }

    onPlanetClick(event) {
        event.preventDefault();
        const currentTime = performance.now();
        
        // Update mouse position
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Check for intersection
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        if (intersects.length > 0) {
            const planet = this.findPlanetObject(intersects[0].object);
            if (planet) {
                // Check if it's a double click (within 300ms)
                if (currentTime - this.lastClickTime < 1200 && this.selectedPlanet === planet) {
                    this.enterPlanet(planet);
                }
                this.selectedPlanet = planet;
            }
        }
        this.lastClickTime = currentTime;
    }

    onPlanetTouch(event) {
        event.preventDefault();
        const currentTime = performance.now();
        
        // Get touch position
        const touch = event.touches[0];
        this.mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        
        // Check for intersection
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        if (intersects.length > 0) {
            const planet = this.findPlanetObject(intersects[0].object);
            if (planet) {
                // Check if it's a double tap (within 300ms)
                if (currentTime - this.lastClickTime < 300 && this.selectedPlanet === planet) {
                    this.enterPlanet(planet);
                }
                this.selectedPlanet = planet;
            }
        }
        this.lastClickTime = currentTime;
    }

    findPlanetObject(object) {
        // Traverse up the parent hierarchy to find the planet object
        while (object && !object.isPlanet) {
            object = object.parent;
        }
        return object;
    }

    enterPlanet(planet) {
        if (!planet || !planet.name) return;
        
        console.log('Entering planet:', planet.name);
        
        try {
            // Stop planet animations
            this.planets.forEach(p => {
                if (p.orbitAnimation) {
                    cancelAnimationFrame(p.orbitAnimation);
                }
            });

            // Hide solar system objects
            this.scene.children.forEach(child => {
                if (child.isMesh || child.isGroup) {
                    child.visible = false;
                }
            });

            // Create planet environment if not exists
            if (!this.planetEnvironment) {
                console.log('Creating new planet environment');
                this.planetEnvironment = new PlanetEnvironment(this.scene, this.camera, this.renderer);
            }

            // Setup planet environment
            console.log('Setting up planet environment');
            this.planetEnvironment.setup(planet.name).then(() => {
            //     console.log('Planet environment setup complete');
            //     // Add to animation loop
            //     // if (!this.planetEnvironment.isInUpdateLoop) {
            //     //     this.planetEnvironment.isInUpdateLoop = true;
            //     // }

            //     // Setup hand tracking to control the ball
            // //     if (this.handTracker) {
            // //         this.handTracker.onThrowCallback = (position, velocity) => {
            // //             if (this.planetEnvironment && this.planetEnvironment.ballBody) {
            // //                 this.planetEnvironment.throwBall(velocity.multiplyScalar(10));
            // //             }
            // //         };
            // //     }
            }).catch(error => {
                console.error('Failed to setup planet environment:', error);
            });

            // Disable controls temporarily
            if (this.controls) {
                this.controls.enabled = false;
            }

            // Trigger the planet environment
            if (typeof this.onPlanetSelected === 'function') {
                this.onPlanetSelected(planet.name);
            }
        } catch (error) {
            console.error('Error entering planet:', error);
        }
    }

    update() {
        // Update planets
        for (const [name, planet] of this.planets) {
            planet.angle += planet.speed;
            planet.mesh.position.x = Math.cos(planet.angle) * planet.distance;
            planet.mesh.position.z = Math.sin(planet.angle) * planet.distance;
            planet.mesh.rotation.y += planet.speed * 2;
        }

        // Update planet environment if active
        if (this.planetEnvironment && this.planetEnvironment.isInUpdateLoop) {
            this.planetEnvironment.update();
        }

        // Rotate star field slowly
        if (this.starField) {
            this.starField.rotation.y += 0.0001;
        }
    }

    setupClickEvents(camera, renderer) {
        this.renderer = renderer.renderer || renderer; // Handle both Renderer class and raw THREE.WebGLRenderer
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        let lastClickTime = 0;
        const doubleClickDelay = 300; // milliseconds

        renderer.domElement.addEventListener('click', (event) => {
            const currentTime = Date.now();
            const timeDiff = currentTime - lastClickTime;
            lastClickTime = currentTime;

            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(this.scene.children, true);

            if (intersects.length > 0) {
                const clickedObject = intersects.find(intersect => {
                    const object = intersect.object;
                    let parent = object;
                    while (parent && !parent.name) {
                        parent = parent.parent;
                    }
                    return parent && this.planets.has(parent.name);
                });

                if (clickedObject) {
                    const planet = clickedObject.object;
                    let planetName = planet.name;
                    if (!planetName) {
                        let parent = planet.parent;
                        while (parent && !parent.name) {
                            parent = parent.parent;
                        }
                        if (parent) planetName = parent.name;
                    }

                    if (planetName) {
                        console.log(`Clicked on planet: ${planetName}`);
                        if (timeDiff < doubleClickDelay) {
                            // Double click - enter planet environment
                            this.enterPlanet(planetName);
                        } else {
                            // Single click - zoom to planet
                            this.zoomToPlanet(planetName);
                        }
                    }
                }
            }
        });

        // Add ESC key listener to exit planet environment
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.exitPlanet();
            }
        });
    }

    exitPlanet() {
        console.log('Exiting planet environment');
        
        // Remove hand tracking callback
        // if (this.handTracker) {
        //     this.handTracker.onThrowCallback = null;
        // }

        // Cleanup planet environment
        if (this.planetEnvironment) {
            this.planetEnvironment.cleanup();
            this.planetEnvironment = null;
        }

        // Show solar system objects
        this.scene.children.forEach(child => {
            if (child.isMesh || child.isGroup) {
                child.visible = true;
            }
        });

        // Reset camera with animation
        new TWEEN.Tween(this.camera.position)
            .to(this.originalCameraPosition, 1000)
            .easing(TWEEN.Easing.Cubic.InOut)
            .onComplete(() => {
                this.camera.lookAt(0, 0, 0);
                // Re-enable controls
                if (this.controls) {
                    this.controls.enabled = true;
                }
            })
            .start();
    }

    zoomToPlanet(planetName) {
        if (!this.planets.has(planetName)) return;
        
        const planet = this.planets.get(planetName);
        const planetPosition = planet.mesh.position;
        const targetPosition = new THREE.Vector3(
            planetPosition.x,
            planetPosition.y,
            planetPosition.z
        );

        if (this.controls) {
            this.controls.enabled = false;
        }

        const startPosition = this.camera.position.clone();
        const distance = startPosition.distanceTo(targetPosition);
        const zoomDistance = distance * 0.3; // Zoom to 30% of the distance

        const finalPosition = targetPosition.clone().add(
            new THREE.Vector3(zoomDistance, zoomDistance * 0.5, zoomDistance)
        );

        new TWEEN.Tween(this.camera.position)
            .to(finalPosition, 1000)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(() => {
                if (this.controls) {
                    this.controls.target.copy(targetPosition);
                }
            })
            .onComplete(() => {
                if (this.controls) {
                    this.controls.enabled = true;
                }
                
                const onDoubleClick = () => {
                    this.zoomOut();
                    this.renderer.domElement.removeEventListener('dblclick', onDoubleClick);
                };
                this.renderer.domElement.addEventListener('dblclick', onDoubleClick);
            })
            .start();
    }

    zoomOut() {
        if (this.controls) {
            this.controls.enabled = false;
        }

        new TWEEN.Tween(this.camera.position)
            .to(this.originalCameraPosition, 1000)
            .easing(TWEEN.Easing.Cubic.InOut)
            .onUpdate(() => {
                this.camera.lookAt(0, 0, 0);
            })
            .onComplete(() => {
                if (this.controls) {
                    this.controls.enabled = true;
                    this.controls.target.set(0, 0, 0);
                }
            })
            .start();
    }

    async enterPlanetEnvironment(planetName) {
        let loadingElement = null;
        try {
            const planet = this.planets.get(planetName);
            if (!planet) {
                throw new Error(`Planet ${planetName} not found`);
            }

            if (this.controls) {
                this.controls.enabled = false;
            }

            this.originalCameraPosition.copy(this.camera.position);
            
            loadingElement = document.createElement('div');
            loadingElement.style.position = 'fixed';
            loadingElement.style.top = '50%';
            loadingElement.style.left = '50%';
            loadingElement.style.transform = 'translate(-50%, -50%)';
            loadingElement.style.color = 'white';
            loadingElement.style.fontSize = '24px';
            loadingElement.style.fontFamily = 'Arial, sans-serif';
            loadingElement.style.padding = '20px';
            loadingElement.style.background = 'rgba(0, 0, 0, 0.7)';
            loadingElement.style.borderRadius = '10px';
            loadingElement.style.zIndex = '1000';
            loadingElement.textContent = 'Loading Planet Environment...';
            document.body.appendChild(loadingElement);
            
            const targetPosition = planet.mesh.position.clone();
            const radius = planet.mesh.geometry.parameters.radius;
            const distance = radius * 5; 
            targetPosition.normalize().multiplyScalar(planet.mesh.position.length() - distance);
            
            await new Promise((resolve) => {
                new TWEEN.Tween(this.camera.position)
                    .to(targetPosition, 2000)
                    .easing(TWEEN.Easing.Cubic.InOut)
                    .start()
                    .onComplete(resolve);
            });

            this.camera.lookAt(planet.mesh.position);
            
            if (this.planetEnvironment) {
                this.planetEnvironment.cleanup();
            }
            this.planetEnvironment = new PlanetEnvironment(this.scene, this.camera, this.renderer);
            await this.planetEnvironment.setup(planetName);
            
            if (loadingElement) {
                document.body.removeChild(loadingElement);
                loadingElement = null;
            }
        } catch (error) {
            console.error('Error entering planet:', error);
            
            if (this.planetEnvironment) {
                this.planetEnvironment.cleanup();
                this.planetEnvironment = null;
            }
            
            await new Promise((resolve) => {
                new TWEEN.Tween(this.camera.position)
                    .to(this.originalCameraPosition, 1000)
                    .easing(TWEEN.Easing.Cubic.InOut)
                    .start()
                    .onComplete(() => {
                        this.camera.lookAt(0, 0, 0);
                        resolve();
                    });
            });
            
            if (this.controls) {
                this.controls.enabled = true;
            }
            
            if (loadingElement) {
                document.body.removeChild(loadingElement);
            }
            
            const errorElement = document.createElement('div');
            errorElement.style.position = 'fixed';
            errorElement.style.top = '50%';
            errorElement.style.left = '50%';
            errorElement.style.transform = 'translate(-50%, -50%)';
            errorElement.style.color = 'white';
            errorElement.style.fontSize = '20px';
            errorElement.style.fontFamily = 'Arial, sans-serif';
            errorElement.style.padding = '20px';
            errorElement.style.background = 'rgba(255, 0, 0, 0.7)';
            errorElement.style.borderRadius = '10px';
            errorElement.style.zIndex = '1000';
            errorElement.textContent = 'Failed to load planet environment. Please try again.';
            document.body.appendChild(errorElement);
            
            setTimeout(() => {
                document.body.removeChild(errorElement);
            }, 3000);
        }
    }
}
