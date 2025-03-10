const fs = require('fs');
const path = require('path');
const https = require('https');

const planets = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'space'];
const faces = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

const skyboxDir = path.join(__dirname, '..', 'textures', 'skybox');

// Create skybox directory if it doesn't exist
if (!fs.existsSync(skyboxDir)) {
    fs.mkdirSync(skyboxDir, { recursive: true });
}

// URLs for skybox textures (replace with actual URLs)
const textureUrls = {
    mercury: 'https://example.com/skybox/mercury/',
    venus: 'https://example.com/skybox/venus/',
    earth: 'https://example.com/skybox/earth/',
    mars: 'https://example.com/skybox/mars/',
    jupiter: 'https://example.com/skybox/jupiter/',
    saturn: 'https://example.com/skybox/saturn/',
    uranus: 'https://example.com/skybox/uranus/',
    neptune: 'https://example.com/skybox/neptune/',
    space: 'https://example.com/skybox/space/'
};

// Download function
function downloadTexture(url, filename) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
                return;
            }

            const file = fs.createWriteStream(filename);
            response.pipe(file);

            file.on('finish', () => {
                file.close();
                resolve();
            });

            file.on('error', (err) => {
                fs.unlink(filename);
                reject(err);
            });
        }).on('error', reject);
    });
}

// Download all textures
async function downloadAllTextures() {
    for (const planet of planets) {
        console.log(`Downloading textures for ${planet}...`);
        for (const face of faces) {
            const url = `${textureUrls[planet]}${face}.jpg`;
            const filename = path.join(skyboxDir, `${planet}_${face}.jpg`);
            try {
                await downloadTexture(url, filename);
                console.log(`Downloaded ${filename}`);
            } catch (error) {
                console.error(`Error downloading ${url}:`, error);
            }
        }
    }
}

downloadAllTextures().then(() => {
    console.log('All textures downloaded successfully!');
}).catch((error) => {
    console.error('Error downloading textures:', error);
});
