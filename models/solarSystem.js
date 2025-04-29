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
        this.planetOrder = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
        this.currentlyHighlightedOrderedPlanet = null;
        this.lastTapTime = 0;


        // Initialize immediately
        this.init();
    }
    showStatusMessage(message, isError = false) {
        // Create a container for the status message
        const statusElement = document.createElement('div');
        statusElement.style.position = 'fixed';
        statusElement.style.top = '20px';
        statusElement.style.left = '50%';
        statusElement.style.transform = 'translateX(-50%)';
        statusElement.style.backgroundColor = isError ? 'rgba(255, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.7)';
        statusElement.style.color = 'white';
        statusElement.style.padding = '10px 20px';
        statusElement.style.borderRadius = '5px';
        statusElement.style.fontFamily = 'Arial, sans-serif';
        statusElement.style.fontSize = '14px';
        statusElement.style.zIndex = '1000';
        statusElement.textContent = message;
        
        // Append the status element to the document body
        document.body.appendChild(statusElement);
        
        // Remove the message after a few seconds (e.g., 3 seconds)
        setTimeout(() => {
            if (statusElement.parentNode) {
                statusElement.parentNode.removeChild(statusElement);
            }
        }, 3000);
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
            
            // Add interactive flag and interaction radius for gesture detection
            planet.userData = {
                isPlanet: true,
                interactive: true,
                interactionRadius: data.radius * 3, // Make interaction radius 3x the planet radius
                originalScale: planet.scale.clone()
            };
            
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
        if (!planet || !planet.name) {
            console.error('Invalid planet provided to enterPlanet method');
            return;
        }
        
        console.log('Entering planet:', planet.name);
        
        try {
            // Add visual feedback when planet is selected
            this.pulseEffectOnPlanet(planet);
            
            // Show loading indicator
            const loadingElement = document.createElement('div');
            loadingElement.style.position = 'fixed';
            loadingElement.style.top = '50%';
            loadingElement.style.left = '50%';
            loadingElement.style.transform = 'translate(-50%, -50%)';
            loadingElement.style.padding = '20px';
            loadingElement.style.background = 'rgba(0, 0, 0, 0.7)';
            loadingElement.style.color = 'white';
            loadingElement.style.borderRadius = '5px';
            loadingElement.style.zIndex = '1000';
            loadingElement.textContent = `Entering ${planet.name.charAt(0).toUpperCase() + planet.name.slice(1)}...`;
            document.body.appendChild(loadingElement);

            // Stop planet animations
            this.planets.forEach(p => {
                if (p.orbitAnimation) {
                    cancelAnimationFrame(p.orbitAnimation);
                }
            });

            // Hide solar system objects with a short delay to allow for visual feedback
            setTimeout(() => {
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
                    console.log('Planet environment setup complete');
                    
                    // Remove loading indicator
                    if (loadingElement.parentNode) {
                        document.body.removeChild(loadingElement);
                    }
                    this.planetEnvironment.solarSystem = this;

                                       
                    
                }).catch(error => {
                    console.error('Failed to setup planet environment:', error);
                    if (loadingElement.parentNode) {
                        document.body.removeChild(loadingElement);
                    }
                    // this.showStatusMessage('Failed to enter planet environment', true);
                    
                    // Make solar system objects visible again on error
                    this.scene.children.forEach(child => {
                        if (child.isMesh || child.isGroup) {
                            child.visible = true;
                        }
                    });
                });

                // Disable controls temporarily
                if (this.controls) {
                    this.controls.enabled = false;
                }

                // Trigger the planet environment
                if (typeof this.onPlanetSelected === 'function') {
                    this.onPlanetSelected(planet.name);
                }
            }, 500); // Short delay to allow for visual feedback
            
        } catch (error) {
            console.error('Error entering planet:', error);
            this.showStatusMessage('Error entering planet: ' + error.message, true);
        }
    }
    
    // Add visual feedback when a planet is selected
    pulseEffectOnPlanet(planet) {
        if (!planet) return;
        
        // Save original scale
        const originalScale = planet.scale.clone();
        
        // Create animation sequence
        const scaleFactor = 1.3;
        const duration = 500; // ms
        const startTime = performance.now();
        
        const animatePulse = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(1.0, elapsed / duration);
            
            if (progress < 0.5) {
                // Scale up
                const currentScale = 1.0 + (scaleFactor - 1.0) * (progress / 0.5);
                planet.scale.copy(originalScale).multiplyScalar(currentScale);
            } else {
                // Scale down
                const currentScale = scaleFactor - (scaleFactor - 1.0) * ((progress - 0.5) / 0.5);
                planet.scale.copy(originalScale).multiplyScalar(currentScale);
            }
            
            if (progress < 1.0) {
                requestAnimationFrame(animatePulse);
            } else {
                // Reset to original scale
                planet.scale.copy(originalScale);
            }
        };
        
        // Start animation
        requestAnimationFrame(animatePulse);
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

    // --- Updated Highlighting Methods in your SolarSystem class ---

      // --- Updated Highlighting Methods in SolarSystem class ---

// Call this method to set the highlight on a planet by adding a bright green ring around it.
        highlightPlanet(planet) {
            // If the same planet is already highlighted, do nothing.
            if (this.currentlyHighlightedOrderedPlanet === planet) {
            return;
            }
        
            // Remove any previous highlight.
            this.removeHighlight();
        
            // Create and attach a new highlight circle to the planet.
            this.createHighlightCircle(planet);
        }
        
        // Helper: Create a highlight ring around the given planet.
            createHighlightCircle(planet) {
                // Remove any existing highlight circle.
                if (this.highlightCircle) {
                if (this.highlightCircle.parent) {
                    this.highlightCircle.parent.remove(this.highlightCircle);
                }
                this.highlightCircle = null;
                }
            
                // Assume the planet's geometry is a sphere.
                const radius = planet.geometry?.parameters?.radius || 1;
                
                // Define inner and outer radius for the ring (adjust these multipliers if desired)
                const innerRadius = radius * 1.2;
                const outerRadius = radius * 1.4;
                const segments = 32; // More segments gives a smoother circle
            
                // Create a ring geometry.
                const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, segments);
            
                // Create a basic material with bright green color.
                const ringMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff00,       // bright green
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.8
                });
            
                const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
            
                // Rotate the ring so it lays horizontally (flat on the XZ plane).
                ringMesh.rotation.x = -Math.PI / 2;
            
                // Set position to the center of the planet.
                ringMesh.position.set(0, 0, 0);
            
                // Attach the ring as a child of the planet so it moves/rotates along with it.
                planet.add(ringMesh);
            
                // Save references for later removal.
                this.highlightCircle = ringMesh;
                this.currentlyHighlightedOrderedPlanet = planet;
            
                console.debug(`Highlight: ${planet.name} is now highlighted with a green ring.`);
            }
            
            // Remove the highlight ring from the currently highlighted planet.
            removeHighlight() {
                if (this.highlightCircle && this.highlightCircle.parent) {
                this.highlightCircle.parent.remove(this.highlightCircle);
                }
                this.highlightCircle = null;
                this.currentlyHighlightedOrderedPlanet = null;
                console.debug("Highlight removed.");
            }
            
            // Optionally, remove highlights from all planets (calls removeHighlight internally).
            removeHighlights() {
                this.removeHighlight();
            }
            
    // Optionally, add a method to highlight the next planet in the order.  
      
      // …rest of your SolarSystem class methods…
    

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
                            this.enterPlanet(this.getPlanetByName(planetName));
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
    
    // Helper to get a planet by name
    getPlanetByName(name) {
        if (!this.planets.has(name)) return null;
        return this.planets.get(name).mesh;
    }
    exitPlanet() {
        console.log('Exiting planet environment...');
      
        // 1. Clear hand tracking callbacks (if any)
        if (this.handTracker) {
          this.handTracker.setThrowCallback(null);
          if (typeof this.handTracker.setPickupCallback === 'function') {
            this.handTracker.setPickupCallback(null);
          }
        }
      
        // 2. Clean up the active planet environment
        if (this.planetEnvironment) {
          this.planetEnvironment.cleanup();
          this.planetEnvironment = null;
        }
        
        // 3. Ensure that all objects that belong to the solar system are visible.
        this.scene.children.forEach(child => {
          child.visible = true;
        });
        
        // 4. Animate the camera back to its original solar system position.
        if (this.controls) {
          this.controls.enabled = false; // disable controls during animation
        }
        new TWEEN.Tween(this.camera.position)
          .to(this.originalCameraPosition, 1000)
          .easing(TWEEN.Easing.Cubic.InOut)
          .onUpdate(() => {
            this.camera.lookAt(0, 0, 0);
          })
          .onComplete(() => {
            if (this.controls) {
              this.controls.target.set(0, 0, 0);
              this.controls.update();
              this.controls.enabled = true;
            }
            this.showStatusMessage('Returned to Solar System view');
            
            // 5. Reinitialize the solar system completely.
            this.reinitializeSolarSystem();
          })
          .start();
      }
      
      /**
       * Reinitialize solar system objects and configurations.
       * This method removes any stale solar system objects and then calls the initialization
       * function (e.g. init()) to recreate the solar system as if the page were reloaded.
       */
      reinitializeSolarSystem() {
        console.log("Reinitializing solar system...");
        // Option 1: If your SolarSystem instance created groups or stores objects,
        // remove (and dispose) them before re-creating everything.
        // For example, if you store your planet meshes in a Map:
        this.planets.forEach((planetData, planetName) => {
          if (planetData.mesh) {
            // Optionally dispose geometry and material:
            if (planetData.mesh.geometry) planetData.mesh.geometry.dispose();
            if (planetData.mesh.material) planetData.mesh.material.dispose();
            this.scene.remove(planetData.mesh);
            planetData.mesh = null;
          }
        });
        this.orbits.forEach(orbit => {
          if (orbit.geometry) orbit.geometry.dispose();
          if (orbit.material) orbit.material.dispose();
          this.scene.remove(orbit);
        });
        this.planets.clear();
        this.orbits.clear();
      
        // Option 2: If you maintained a dedicated Group for solar system objects,
        // remove it entirely from the scene.
        // (Example code if you had "this.solarGroup":)
        // if(this.solarGroup) {
        //   this.scene.remove(this.solarGroup);
        //   this.solarGroup = null;
        // }
      
        // Now call the same initialization function that was originally called in your constructor.
        // For example, if your constructor calls this.init(), then call it here to re-create objects.
        this.init();
      
        console.log("Solar system reinitialized.");
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
                
                // Show planet zoom message
               // this.showStatusMessage(`Zoomed to ${planetName.charAt(0).toUpperCase() + planetName.slice(1)}`);
                
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
                
                // Show zoom out message
            })
            .start();
    }
    toggleGestureControl() {
        this.gestureEnabled = !this.gestureEnabled;
            
            if (this.handTracker) {
                if (this.gestureEnabled) {
                    this.handTracker.isTracking = true;
                    this.handTracker.track();
                    this.showStatusMessage('Gesture controls enabled');
                } else {
                    this.handTracker.isTracking = false;
                    this.showStatusMessage('Gesture controls disabled');
                }
            }
            
            return this.gestureEnabled;
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
            
            // Configure hand tracking for the planet environment if available
            if (this.handTracker) {
                console.log('Configuring hand tracking for planet environment');
                
                // Set callback for throwing ball via gesture remains the same.
                // this.handTracker.setThrowCallback((position, velocity) => {
                //     if (this.planetEnvironment && this.planetEnvironment.isInUpdateLoop) {
                //         console.log('Hand gesture: throw ball');
                //         this.planetEnvironment.throwBall();
                //     }
                // }
                // );
            
                // Optionally, if your handTracker class is enhanced with a pickup callback (setPickupCallback),
                // you can use it here. Otherwise, ensure that your hand tracker’s gesture detection
                // calls planetEnvironment.pickupBall() internally when a closed fist is detected.
                // if (typeof this.handTracker.setPickupCallback === 'function') {
                //     this.handTracker.setPickupCallback(() => {
                //         if (this.planetEnvironment && !this.planetEnvironment.isHoldingBall) {
                //             console.log('Hand gesture: closed fist detected - picking up ball');
                //             this.planetEnvironment.pickupBall();
                //         }
                //     });
                // }
                
                // Updated status message now instructs the user on both pickup and throw gestures.
                this.showStatusMessage('Gesture controls active: Use closed fist to pick up the ball and throw gesture to launch it.');
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
    
            this.showStatusMessage('Failed to load planet environment. Please try again.', true);
        }
    }
    
    // Toggle gesture control on/off

