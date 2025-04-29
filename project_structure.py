import os

# Define project structure
project_structure = {
    "my-solar-system-project": [
        "index.html",
        "package.json",
        "README.md",
        "css/styles.css",
        "assets/models/solarSystem.glb",
        "assets/models/planetSurface1.glb",
        "assets/models/planetSurface2.glb",
        "assets/textures/",
        "js/app.js",
        "js/renderer.js",
        "js/sceneManager.js",
        "js/models/solarSystem.js",
        "js/models/planet.js",
        "js/cameras/mainCamera.js",
        "js/cameras/planetCamera.js",
        "js/controls/cursorControls.js",
        "js/utils/loader.js",
        "js/xr/arController.js",
        "js/xr/vrController.js"
    ]
}

# Function to create files and directories
def create_project_structure(structure):
    for root, files in structure.items():
        os.makedirs(root, exist_ok=True)
        for file_path in files:
            file_full_path = os.path.join(root, file_path)
            if file_full_path.endswith("/"):  # Create directories
                os.makedirs(file_full_path, exist_ok=True)
            else:  # Create empty files
                os.makedirs(os.path.dirname(file_full_path), exist_ok=True)
                with open(file_full_path, "w") as f:
                    pass
    print("Project structure created successfully!")

# Execute function
create_project_structure(project_structure)
