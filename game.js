// ========================================
// ASTEROID BLASTER - COMPLETE GAME ENGINE
// With Sound, Cat Aliens, Coins, Shop
// Balanced Difficulty + New Powerups
// ========================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game States
const GameState = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover' };
let currentState = GameState.MENU;

// Game Variables
let score = 0, level = 1, lives = 3, coinsThisGame = 0;
let asteroidsDestroyed = 0, aliensDestroyed = 0;

// Persistent Data (loaded from localStorage)
let gameData = {
    highScore: 0,
    totalCoins: 0,
    ownedItems: { skins: ['default'], trails: ['default'], bullets: ['default'] },
    equippedItems: { skin: 'default', trail: 'default', bullet: 'default' },
    stats: { totalGames: 0, totalAsteroids: 0, totalAliens: 0, totalCoinsEarned: 0 }
};

// Timing
let lastTime = 0, deltaTime = 0;
const keys = {};

// Game Objects
let ship = null, bullets = [], asteroids = [], particles = [], powerups = [], stars = [];
let catAliens = [], alienBullets = [], coinItems = [];
let bossPhase = false, bossWaveComplete = false;

// Notification Queue System
let notificationQueue = [];
let currentNotification = null;
let notificationTimer = 0;

// Constants
const SHIP_SIZE = 20, SHIP_THRUST = 300, SHIP_FRICTION = 0.99, SHIP_ROTATION_SPEED = 4;
const SHIP_INVULNERABILITY_TIME = 3000;
const BULLET_SPEED = 500, BULLET_LIFETIME = 8000, FIRE_RATE = 250, RAPID_FIRE_RATE = 100; // 8 seconds bullet lifetime!
const ASTEROID_SPEED_BASE = 50, ASTEROID_SPEED_VARIANCE = 30;
const ASTEROID_SIZES = { large: { radius: 50, points: 20 }, medium: { radius: 30, points: 50 }, small: { radius: 15, points: 100 } };
const POWERUP_DURATION = 12000;
const TIMESLOW_DURATION = 10000; // Time Slow only lasts 10 seconds
const POWERUP_SPAWN_CHANCE_PER_TYPE = 0.03; // 3% per powerup type

// ========================================
// DATA PERSISTENCE
// ========================================
function loadGameData() {
    const saved = localStorage.getItem('asteroidBlasterData');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            gameData = { ...gameData, ...parsed };
        } catch (e) { console.log('Failed to load save data'); }
    }
}

function saveGameData() {
    localStorage.setItem('asteroidBlasterData', JSON.stringify(gameData));
}

function getEquippedSkin() { return SHOP_ITEMS.skins.find(s => s.id === gameData.equippedItems.skin) || SHOP_ITEMS.skins[0]; }
function getEquippedTrail() { return SHOP_ITEMS.trails.find(t => t.id === gameData.equippedItems.trail) || SHOP_ITEMS.trails[0]; }
function getEquippedBullet() { return SHOP_ITEMS.bullets.find(b => b.id === gameData.equippedItems.bullet) || SHOP_ITEMS.bullets[0]; }

// ========================================
// SOUND SYSTEM
// ========================================
class SoundManager {
    constructor() { this.ctx = null; this.initialized = false; }
    init() {
        if (this.initialized) return;
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.initialized = true; } catch (e) {}
    }
    playShoot() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.start(); osc.stop(this.ctx.currentTime + 0.1);
    }
    playAlienShoot() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(250, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
        osc.start(); osc.stop(this.ctx.currentTime + 0.15);
    }
    playExplosion() {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 0.25;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        const source = this.ctx.createBufferSource(), gain = this.ctx.createGain();
        source.buffer = buffer; source.connect(gain); gain.connect(this.ctx.destination);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
        source.start();
    }
    playCoin() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.setValueAtTime(1200, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        osc.start(); osc.stop(this.ctx.currentTime + 0.2);
    }
    playPowerup() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.15);
        osc.frequency.exponentialRampToValueAtTime(1000, this.ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        osc.start(); osc.stop(this.ctx.currentTime + 0.3);
    }
}
const soundManager = new SoundManager();

// ========================================
// SHOP SYSTEM
// ========================================
const SHOP_ITEMS = {
    skins: [
        // Basic Tier (Free - 100)
        { id: 'default', name: 'Classic', price: 0, colors: ['#0066aa', '#00ccff', '#00ffff'] },
        { id: 'fire', name: 'Inferno', price: 75, colors: ['#aa2200', '#ff4400', '#ff8800'] },
        { id: 'green', name: 'Toxic', price: 80, colors: ['#006622', '#00aa44', '#00ff66'] },
        { id: 'ice', name: 'Frozen', price: 90, colors: ['#224488', '#4488cc', '#88ccff'] },
        // Mid Tier (100 - 200)
        { id: 'purple', name: 'Nebula', price: 120, colors: ['#6622aa', '#9944ff', '#cc88ff'] },
        { id: 'pink', name: 'Sakura', price: 130, colors: ['#aa2266', '#ff4488', '#ffaacc'] },
        { id: 'gold', name: 'Golden', price: 150, colors: ['#aa7700', '#ddaa00', '#ffdd00'] },
        { id: 'dark', name: 'Shadow', price: 175, colors: ['#222222', '#444444', '#888888'] },
        // Premium Tier (200 - 400)
        { id: 'crimson', name: 'Blood Moon', price: 225, colors: ['#440000', '#880022', '#cc0044'] },
        { id: 'electric', name: 'Lightning', price: 250, colors: ['#ffff00', '#88ffff', '#ffffff'] },
        { id: 'sunset', name: 'Sunset', price: 275, colors: ['#ff4400', '#ff8844', '#ffcc88'] },
        { id: 'ocean', name: 'Deep Sea', price: 300, colors: ['#002244', '#004488', '#0088aa'] },
        // Legendary Tier (400+)
        { id: 'galaxy', name: 'Galaxy', price: 450, colors: ['#220044', '#4400aa', '#8844ff'] },
        { id: 'phoenix', name: 'Phoenix', price: 500, colors: ['#ff2200', '#ff6600', '#ffcc00'] },
        { id: 'diamond', name: 'Diamond', price: 600, colors: ['#aaddff', '#88ffff', '#ffffff'] },
        { id: 'void', name: 'Void Walker', price: 800, colors: ['#110022', '#220044', '#440088'] },
        // 🎄 Christmas Special Tier (Most Expensive!)
        { id: 'xmas_tree', name: '🎄 Festive Tree', price: 950, colors: ['#004400', '#006600', '#00aa00'], special: 'christmas_tree' },
        { id: 'xmas_present', name: '🎁 Gift Box', price: 1000, colors: ['#cc0000', '#ff0000', '#ffdd00'], special: 'christmas_present' }
    ],
    trails: [
        // Basic Tier
        { id: 'default', name: 'Classic', price: 0, colors: ['#ff6600', '#ffcc00'] },
        { id: 'blue', name: 'Plasma', price: 60, colors: ['#0066ff', '#00ffff'] },
        { id: 'green', name: 'Acid', price: 65, colors: ['#00ff00', '#88ff00'] },
        { id: 'purple', name: 'Void', price: 80, colors: ['#8800ff', '#ff00ff'] },
        // Mid Tier
        { id: 'white', name: 'Starlight', price: 100, colors: ['#ffffff', '#aaaaff'] },
        { id: 'pink', name: 'Bubblegum', price: 110, colors: ['#ff66aa', '#ffaacc'] },
        { id: 'red', name: 'Inferno', price: 120, colors: ['#ff0000', '#ff6600'] },
        // Premium Tier
        { id: 'rainbow', name: 'Rainbow', price: 200, colors: ['rainbow'] },
        { id: 'electric', name: 'Electric Storm', price: 250, colors: ['#00ffff', '#ffff00'] },
        { id: 'neon', name: 'Neon Dreams', price: 300, colors: ['#ff00ff', '#00ffff'] },
        // Legendary Tier
        { id: 'cosmic', name: 'Cosmic Dust', price: 400, colors: ['#8844ff', '#ff44aa'] },
        { id: 'supernova', name: 'Supernova', price: 550, colors: ['#ffffff', '#ffff00', '#ff4400'] },
        // 🎄 Christmas Special Tier (Most Expensive!)
        { id: 'xmas_tinsel', name: '✨ Tinsel', price: 700, colors: ['#ff0000', '#00ff00', '#ffdd00'], special: 'tinsel' },
        { id: 'xmas_snow', name: '❄️ Snowfall', price: 750, colors: ['#ffffff', '#aaddff', '#88ccff'], special: 'snow' }
    ],
    bullets: [
        // Basic Tier
        { id: 'default', name: 'Cyan', price: 0, color: '#00ffff', glow: 'rgba(0, 255, 255, 0.3)' },
        { id: 'red', name: 'Crimson', price: 50, color: '#ff3333', glow: 'rgba(255, 51, 51, 0.3)' },
        { id: 'green', name: 'Emerald', price: 50, color: '#33ff33', glow: 'rgba(51, 255, 51, 0.3)' },
        { id: 'orange', name: 'Blaze', price: 55, color: '#ff8800', glow: 'rgba(255, 136, 0, 0.3)' },
        // Mid Tier
        { id: 'gold', name: 'Solar', price: 85, color: '#ffdd00', glow: 'rgba(255, 221, 0, 0.3)' },
        { id: 'purple', name: 'Mystic', price: 90, color: '#dd44ff', glow: 'rgba(221, 68, 255, 0.3)' },
        { id: 'white', name: 'Pure Light', price: 100, color: '#ffffff', glow: 'rgba(255, 255, 255, 0.4)' },
        { id: 'pink', name: 'Rose', price: 95, color: '#ff66aa', glow: 'rgba(255, 102, 170, 0.3)' },
        // Premium Tier
        { id: 'electric', name: 'Thunder', price: 150, color: '#88ffff', glow: 'rgba(136, 255, 255, 0.4)' },
        { id: 'blood', name: 'Blood', price: 175, color: '#aa0022', glow: 'rgba(170, 0, 34, 0.4)' },
        { id: 'ice', name: 'Frost', price: 180, color: '#aaddff', glow: 'rgba(170, 221, 255, 0.4)' },
        // Legendary Tier
        { id: 'plasma', name: 'Plasma Core', price: 300, color: '#ff00ff', glow: 'rgba(255, 0, 255, 0.5)' },
        { id: 'antimatter', name: 'Antimatter', price: 400, color: '#220044', glow: 'rgba(100, 0, 200, 0.6)' },
        { id: 'nova', name: 'Nova Burst', price: 500, color: '#ffffaa', glow: 'rgba(255, 255, 200, 0.6)' },
        // 🎄 Christmas Special Tier (Most Expensive!)
        { id: 'xmas_bulb', name: '🔴 Xmas Bulb', price: 650, color: '#ff0000', glow: 'rgba(255, 0, 0, 0.5)', special: 'bulb' },
        { id: 'xmas_snowball', name: '⚪ Snowball', price: 700, color: '#ffffff', glow: 'rgba(200, 230, 255, 0.6)', special: 'snowball' }
    ]
};

// ========================================
// UTILITY FUNCTIONS
// ========================================
function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; generateStars(); }
function randomRange(min, max) { return Math.random() * (max - min) + min; }
function randomInt(min, max) { return Math.floor(randomRange(min, max + 1)); }
function distance(x1, y1, x2, y2) { return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2); }
function wrapPosition(obj) {
    if (obj.x < -50) obj.x = canvas.width + 50;
    if (obj.x > canvas.width + 50) obj.x = -50;
    if (obj.y < -50) obj.y = canvas.height + 50;
    if (obj.y > canvas.height + 50) obj.y = -50;
}
function generateStars() {
    stars = [];
    const count = Math.floor((canvas.width * canvas.height) / 3000);
    for (let i = 0; i < count; i++) {
        stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, radius: Math.random() * 1.5 + 0.5, brightness: Math.random() * 0.5 + 0.5, twinkleSpeed: Math.random() * 2 + 1 });
    }
}

// ========================================
// NOTIFICATION QUEUE SYSTEM
// ========================================
function queueNotification(id, duration) {
    notificationQueue.push({ id, duration });
}

function processNotifications(dt) {
    if (currentNotification) {
        notificationTimer -= dt * 1000;
        if (notificationTimer <= 0) {
            hideNotificationNow(currentNotification.id);
            currentNotification = null;
        }
    }
    
    if (!currentNotification && notificationQueue.length > 0) {
        currentNotification = notificationQueue.shift();
        notificationTimer = currentNotification.duration;
        showNotificationNow(currentNotification.id);
    }
}

function showNotificationNow(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('hidden');
        el.classList.add('visible');
    }
}

function hideNotificationNow(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('visible');
        el.classList.add('hidden');
    }
}

// ========================================
// SHIP CLASS
// ========================================
class Ship {
    constructor() { this.reset(); }
    reset() {
        this.x = canvas.width / 2; this.y = canvas.height / 2;
        this.vx = 0; this.vy = 0; this.angle = -Math.PI / 2;
        this.thrusting = false; this.lastFireTime = 0;
        this.invulnerable = true; this.invulnerableTime = SHIP_INVULNERABILITY_TIME;
        this.shieldActive = false; this.shieldTime = 0;
        this.rapidFireActive = false; this.rapidFireTime = 0;
        this.magnetActive = false; this.magnetTime = 0;
        this.timeSlowActive = false; this.timeSlowTime = 0;
        this.piercingActive = false; this.piercingTime = 0;
        this.visible = true; this.blinkTimer = 0;
    }
    update(dt) {
        // Time slow affects everything except the ship
        const gameDt = this.timeSlowActive ? dt * 0.4 : dt;
        
        if (this.invulnerable) {
            this.invulnerableTime -= dt * 1000;
            this.blinkTimer += dt * 1000;
            this.visible = Math.floor(this.blinkTimer / 100) % 2 === 0;
            if (this.invulnerableTime <= 0) { this.invulnerable = false; this.visible = true; }
        }
        
        // Update powerups
        if (this.shieldActive) { this.shieldTime -= dt * 1000; if (this.shieldTime <= 0) this.shieldActive = false; updatePowerupIndicator('shield', this.shieldTime, POWERUP_DURATION); }
        if (this.rapidFireActive) { this.rapidFireTime -= dt * 1000; if (this.rapidFireTime <= 0) this.rapidFireActive = false; updatePowerupIndicator('rapidfire', this.rapidFireTime, POWERUP_DURATION); }
        if (this.magnetActive) { this.magnetTime -= dt * 1000; if (this.magnetTime <= 0) this.magnetActive = false; updatePowerupIndicator('magnet', this.magnetTime, POWERUP_DURATION); }
        if (this.timeSlowActive) { this.timeSlowTime -= dt * 1000; if (this.timeSlowTime <= 0) this.timeSlowActive = false; updatePowerupIndicator('timeslow', this.timeSlowTime, TIMESLOW_DURATION); }
        if (this.piercingActive) { this.piercingTime -= dt * 1000; if (this.piercingTime <= 0) this.piercingActive = false; updatePowerupIndicator('piercing', this.piercingTime, POWERUP_DURATION); }
        
        if (keys['ArrowLeft'] || keys['KeyA']) this.angle -= SHIP_ROTATION_SPEED * dt;
        if (keys['ArrowRight'] || keys['KeyD']) this.angle += SHIP_ROTATION_SPEED * dt;
        this.thrusting = keys['ArrowUp'] || keys['KeyW'];
        if (this.thrusting) {
            this.vx += Math.cos(this.angle) * SHIP_THRUST * dt;
            this.vy += Math.sin(this.angle) * SHIP_THRUST * dt;
            if (Math.random() < 0.5) createThrustParticle(this);
        }
        this.vx *= SHIP_FRICTION; this.vy *= SHIP_FRICTION;
        this.x += this.vx * dt; this.y += this.vy * dt;
        wrapPosition(this);
        
        const fireRate = this.rapidFireActive ? RAPID_FIRE_RATE : FIRE_RATE;
        if (keys['Space'] && Date.now() - this.lastFireTime > fireRate) { this.fire(); this.lastFireTime = Date.now(); }
        
        return gameDt; // Return the game delta time for other objects
    }
    fire() {
        soundManager.playShoot();
        const bx = this.x + Math.cos(this.angle) * SHIP_SIZE;
        const by = this.y + Math.sin(this.angle) * SHIP_SIZE;
        bullets.push(new Bullet(bx, by, this.angle, true, this.piercingActive));
        if (this.shieldActive) {
            bullets.push(new Bullet(bx, by, this.angle - 0.2, true, this.piercingActive));
            bullets.push(new Bullet(bx, by, this.angle + 0.2, true, this.piercingActive));
        }
    }
    draw() {
        if (!this.visible) return;
        const skin = getEquippedSkin();
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        if (this.shieldActive || this.invulnerable) {
            ctx.beginPath(); ctx.arc(0, 0, SHIP_SIZE + 10, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 240, 255, ${this.shieldActive ? 0.3 : 0.15})`;
            ctx.fill(); ctx.strokeStyle = `rgba(0, 240, 255, 0.5)`; ctx.lineWidth = 2; ctx.stroke();
        }
        
        ctx.beginPath();
        ctx.moveTo(SHIP_SIZE, 0);
        ctx.lineTo(-SHIP_SIZE * 0.7, SHIP_SIZE * 0.6);
        ctx.lineTo(-SHIP_SIZE * 0.4, 0);
        ctx.lineTo(-SHIP_SIZE * 0.7, -SHIP_SIZE * 0.6);
        ctx.closePath();
        const gradient = ctx.createLinearGradient(-SHIP_SIZE, 0, SHIP_SIZE, 0);
        gradient.addColorStop(0, skin.colors[0]);
        gradient.addColorStop(0.5, skin.colors[1]);
        gradient.addColorStop(1, skin.colors[2]);
        ctx.fillStyle = gradient; ctx.fill();
        ctx.strokeStyle = skin.colors[2]; ctx.lineWidth = 2;
        ctx.shadowColor = skin.colors[2]; ctx.shadowBlur = 10; ctx.stroke();
        
        // Christmas Tree decorations
        if (skin.special === 'christmas_tree') {
            ctx.shadowBlur = 0;
            // Ornaments with twinkling effect
            const twinkle = Math.sin(Date.now() / 200) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(255, 0, 0, ${twinkle})`; ctx.beginPath(); ctx.arc(8, -5, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `rgba(255, 221, 0, ${1 - twinkle + 0.5})`; ctx.beginPath(); ctx.arc(2, 4, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `rgba(0, 136, 255, ${twinkle})`; ctx.beginPath(); ctx.arc(-4, -2, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `rgba(0, 255, 0, ${1 - twinkle + 0.5})`; ctx.beginPath(); ctx.arc(5, 2, 2, 0, Math.PI * 2); ctx.fill();
            // Glowing star on tip
            ctx.fillStyle = '#ffff00'; ctx.shadowColor = '#ffff00'; ctx.shadowBlur = 15;
            ctx.beginPath(); ctx.arc(SHIP_SIZE + 2, 0, 4, 0, Math.PI * 2); ctx.fill();
        }
        
        // Gift Box decorations
        if (skin.special === 'christmas_present') {
            ctx.shadowBlur = 0;
            // Golden ribbon cross
            ctx.strokeStyle = '#ffdd00'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(-SHIP_SIZE * 0.6, 0); ctx.lineTo(SHIP_SIZE * 0.8, 0); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, -SHIP_SIZE * 0.4); ctx.lineTo(0, SHIP_SIZE * 0.4); ctx.stroke();
            // Shiny bow on tip
            ctx.fillStyle = '#ffdd00'; ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(SHIP_SIZE, 0, 5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(SHIP_SIZE - 4, -4, 4, 2, -0.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(SHIP_SIZE - 4, 4, 4, 2, 0.5, 0, Math.PI * 2); ctx.fill();
        }
        
        if (this.thrusting) {
            const trail = getEquippedTrail();
            ctx.beginPath();
            ctx.moveTo(-SHIP_SIZE * 0.4, 0);
            ctx.lineTo(-SHIP_SIZE * 0.7, SHIP_SIZE * 0.3);
            ctx.lineTo(-SHIP_SIZE * (0.9 + Math.random() * 0.4), 0);
            ctx.lineTo(-SHIP_SIZE * 0.7, -SHIP_SIZE * 0.3);
            ctx.closePath();
            let c1, c2;
            if (trail.colors[0] === 'rainbow') {
                c1 = `hsl(${(Date.now() / 10) % 360}, 100%, 50%)`;
                c2 = `hsl(${(Date.now() / 10 + 60) % 360}, 100%, 70%)`;
            } else if (trail.special === 'tinsel') {
                // Tinsel alternates Christmas colors
                const phase = Math.floor(Date.now() / 150) % 3;
                const tinselColors = ['#ff0000', '#00ff00', '#ffdd00'];
                c1 = tinselColors[phase];
                c2 = tinselColors[(phase + 1) % 3];
            } else if (trail.special === 'snow') {
                // Snow is white with ice blue
                c1 = '#ffffff';
                c2 = '#aaddff';
            } else { c1 = trail.colors[0]; c2 = trail.colors[1]; }
            const fg = ctx.createLinearGradient(-SHIP_SIZE, 0, -SHIP_SIZE * 1.3, 0);
            fg.addColorStop(0, c1); fg.addColorStop(1, c2);
            ctx.fillStyle = fg; ctx.shadowColor = c1; ctx.shadowBlur = 15; ctx.fill();
        }
        ctx.restore();
        
        // Draw magnet effect
        if (this.magnetActive) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.beginPath();
            ctx.arc(0, 0, 150, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 68, 170, ${0.2 + Math.sin(Date.now() / 200) * 0.1})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 10]);
            ctx.stroke();
            ctx.restore();
        }
    }
    isCollidingWith(obj) { return !(this.invulnerable || this.shieldActive) && distance(this.x, this.y, obj.x, obj.y) < SHIP_SIZE + obj.radius; }
    activateShield() { this.shieldActive = true; this.shieldTime = POWERUP_DURATION; showPowerupIndicator('shield'); }
    activateRapidFire() { this.rapidFireActive = true; this.rapidFireTime = POWERUP_DURATION; showPowerupIndicator('rapidfire'); }
    activateMagnet() { this.magnetActive = true; this.magnetTime = POWERUP_DURATION; showPowerupIndicator('magnet'); }
    activateTimeSlow() { this.timeSlowActive = true; this.timeSlowTime = TIMESLOW_DURATION; showPowerupIndicator('timeslow'); }
    activatePiercing() { this.piercingActive = true; this.piercingTime = POWERUP_DURATION; showPowerupIndicator('piercing'); }
}

// ========================================
// BULLET CLASS
// ========================================
class Bullet {
    constructor(x, y, angle, isPlayer = true, piercing = false) {
        this.x = x; this.y = y; this.isPlayer = isPlayer; this.piercing = piercing;
        this.vx = Math.cos(angle) * BULLET_SPEED * (isPlayer ? 1 : 0.5);
        this.vy = Math.sin(angle) * BULLET_SPEED * (isPlayer ? 1 : 0.5);
        this.createdAt = Date.now(); this.radius = piercing ? 5 : 3;
        this.hitCount = 0;
    }
    update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; wrapPosition(this); }
    draw() {
        const bullet = this.isPlayer ? getEquippedBullet() : { color: '#ff3366', glow: 'rgba(255,51,102,0.3)' };
        ctx.save(); ctx.translate(this.x, this.y);
        
        // Special Christmas bullet rendering
        if (this.isPlayer && bullet.special === 'bulb') {
            // Christmas Bulb - looks like an ornament
            const r = this.piercing ? 6 : 4;
            ctx.beginPath(); ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'; ctx.fill();
            // Main bulb with gradient
            const g = ctx.createRadialGradient(-r/3, -r/3, 0, 0, 0, r);
            g.addColorStop(0, '#ff6666'); g.addColorStop(0.5, '#ff0000'); g.addColorStop(1, '#aa0000');
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fillStyle = g; ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 12; ctx.fill();
            // Shine highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.beginPath(); ctx.arc(-r/2, -r/2, r/3, 0, Math.PI * 2); ctx.fill();
        } else if (this.isPlayer && bullet.special === 'snowball') {
            // Snowball - icy white with sparkle texture
            const r = this.piercing ? 6 : 4;
            ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(200, 230, 255, 0.4)'; ctx.fill();
            // Main snowball with gradient
            const g = ctx.createRadialGradient(-r/3, -r/3, 0, 0, 0, r);
            g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#ddeeff'); g.addColorStop(1, '#aaccee');
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fillStyle = g; ctx.shadowColor = '#88ccff'; ctx.shadowBlur = 10; ctx.fill();
            // Ice crystal sparkles
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath(); ctx.arc(-r/2, -r/2, r/4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(r/3, -r/4, r/5, 0, Math.PI * 2); ctx.fill();
        } else {
            // Standard bullet rendering
            ctx.beginPath(); ctx.arc(0, 0, this.radius + 4, 0, Math.PI * 2);
            ctx.fillStyle = bullet.glow; ctx.fill();
            ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.piercing ? '#ffaa00' : bullet.color;
            ctx.shadowColor = this.piercing ? '#ffaa00' : bullet.color;
            ctx.shadowBlur = this.piercing ? 15 : 10; ctx.fill();
            if (this.piercing) {
                ctx.beginPath(); ctx.arc(0, 0, this.radius + 2, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 170, 0, 0.5)'; ctx.lineWidth = 2; ctx.stroke();
            }
        }
        ctx.restore();
    }
    isExpired() { return Date.now() - this.createdAt > BULLET_LIFETIME || (this.piercing && this.hitCount >= 3); }
    isCollidingWith(obj) { return distance(this.x, this.y, obj.x, obj.y) < this.radius + obj.radius; }
}

// ========================================
// ASTEROID CLASS
// ========================================
class Asteroid {
    constructor(x, y, size, lvl = 1) {
        this.x = x; this.y = y; this.size = size;
        this.radius = ASTEROID_SIZES[size].radius;
        this.points = ASTEROID_SIZES[size].points;
        const speed = ASTEROID_SPEED_BASE + (lvl * 8) + randomRange(-ASTEROID_SPEED_VARIANCE, ASTEROID_SPEED_VARIANCE);
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
        this.rotation = 0; this.rotationSpeed = randomRange(-2, 2);
        this.vertices = [];
        const numV = randomInt(7, 12);
        for (let i = 0; i < numV; i++) {
            const a = (i / numV) * Math.PI * 2;
            const v = randomRange(0.7, 1.0);
            this.vertices.push({ x: Math.cos(a) * this.radius * v, y: Math.sin(a) * this.radius * v });
        }
    }
    update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.rotation += this.rotationSpeed * dt; wrapPosition(this); }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rotation);
        ctx.beginPath(); ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        ctx.closePath();
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
        g.addColorStop(0, '#8b7355'); g.addColorStop(0.5, '#5c4a3a'); g.addColorStop(1, '#3d3025');
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = '#a08060'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
    }
    split() {
        const arr = [];
        if (this.size === 'large') { arr.push(new Asteroid(this.x, this.y, 'medium', level)); arr.push(new Asteroid(this.x, this.y, 'medium', level)); }
        else if (this.size === 'medium') { arr.push(new Asteroid(this.x, this.y, 'small', level)); arr.push(new Asteroid(this.x, this.y, 'small', level)); }
        return arr;
    }
}

// ========================================
// CAT ALIEN CLASS - BALANCED
// ========================================
class CatAlien {
    constructor(lvl) {
        this.radius = 30;
        this.health = 2 + Math.floor(lvl / 3); // Slower health scaling
        this.maxHealth = this.health;
        const side = randomInt(0, 3);
        if (side === 0) { this.x = -50; this.y = randomRange(100, canvas.height - 100); }
        else if (side === 1) { this.x = canvas.width + 50; this.y = randomRange(100, canvas.height - 100); }
        else if (side === 2) { this.x = randomRange(100, canvas.width - 100); this.y = -50; }
        else { this.x = randomRange(100, canvas.width - 100); this.y = canvas.height + 50; }
        this.speed = 30 + lvl * 3; // Much slower: was 40 + lvl * 8
        this.angle = 0;
        this.shootCooldown = Math.max(1500, 3500 - lvl * 100); // Slower shooting: was 2000 - lvl * 150, min 800
        this.lastShot = Date.now() + randomRange(0, 2000); // Stagger initial shots
        this.wobble = 0;
    }
    update(dt) {
        if (!ship) return;
        const dx = ship.x - this.x, dy = ship.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        this.angle = Math.atan2(dy, dx);
        this.x += (dx / dist) * this.speed * dt;
        this.y += (dy / dist) * this.speed * dt;
        this.wobble += dt * 5;
        if (Date.now() - this.lastShot > this.shootCooldown) {
            this.shoot();
            this.lastShot = Date.now();
        }
    }
    shoot() {
        soundManager.playAlienShoot();
        alienBullets.push(new Bullet(this.x, this.y, this.angle, false));
    }
    draw() {
        const bob = Math.sin(this.wobble) * 3;
        ctx.save();
        ctx.translate(this.x, this.y + bob);
        // UFO body
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius * 1.5, this.radius * 0.6, 0, 0, Math.PI * 2);
        const ug = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius * 1.5);
        ug.addColorStop(0, '#8866aa'); ug.addColorStop(1, '#442266');
        ctx.fillStyle = ug; ctx.fill();
        ctx.strokeStyle = '#aa88cc'; ctx.lineWidth = 2; ctx.stroke();
        // Dome
        ctx.beginPath();
        ctx.arc(0, -5, this.radius * 0.7, Math.PI, 0);
        ctx.fillStyle = 'rgba(150, 200, 255, 0.5)'; ctx.fill();
        ctx.strokeStyle = '#aaccff'; ctx.stroke();
        // Cat face
        ctx.fillStyle = '#ffcc88';
        ctx.beginPath(); ctx.arc(0, -8, 12, 0, Math.PI * 2); ctx.fill();
        // Ears
        ctx.beginPath();
        ctx.moveTo(-10, -18); ctx.lineTo(-6, -8); ctx.lineTo(-14, -10); ctx.closePath();
        ctx.moveTo(10, -18); ctx.lineTo(6, -8); ctx.lineTo(14, -10); ctx.closePath();
        ctx.fillStyle = '#ffcc88'; ctx.fill();
        // Eyes
        ctx.fillStyle = '#44ff44';
        ctx.beginPath(); ctx.ellipse(-5, -10, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(5, -10, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(-5, -10, 1.5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(5, -10, 1.5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        // Health bar
        ctx.fillStyle = '#333';
        ctx.fillRect(-20, 20, 40, 5);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(-20, 20, 40 * (this.health / this.maxHealth), 5);
        ctx.restore();
    }
    takeDamage() { this.health--; return this.health <= 0; }
}

// ========================================
// COIN CLASS
// ========================================
class Coin {
    constructor(x, y, value = 1) {
        this.x = x; this.y = y; this.value = value;
        this.radius = 12; this.rotation = 0; this.bobPhase = Math.random() * Math.PI * 2;
    }
    update(dt) {
        this.rotation += 3 * dt; this.bobPhase += 2 * dt;
        // Magnet effect
        if (ship && ship.magnetActive) {
            const dx = ship.x - this.x, dy = ship.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 200) {
                const force = (200 - dist) / 200 * 300;
                this.x += (dx / dist) * force * dt;
                this.y += (dy / dist) * force * dt;
            }
        }
    }
    draw() {
        const bob = Math.sin(this.bobPhase) * 3;
        ctx.save();
        ctx.translate(this.x, this.y + bob);
        ctx.rotate(this.rotation);
        ctx.beginPath(); ctx.arc(0, 0, this.radius + 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 215, 0, 0.2)'; ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
        cg.addColorStop(0, '#ffee55'); cg.addColorStop(0.7, '#ddaa00'); cg.addColorStop(1, '#aa7700');
        ctx.fillStyle = cg; ctx.fill();
        ctx.strokeStyle = '#ffdd00'; ctx.lineWidth = 2; ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = 10; ctx.stroke();
        ctx.fillStyle = '#aa7700'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, 0);
        ctx.restore();
    }
    isCollidingWith(obj) { return distance(this.x, this.y, obj.x, obj.y) < this.radius + SHIP_SIZE; }
}

// ========================================
// PARTICLE & POWERUP
// ========================================
class Particle {
    constructor(x, y, color, vx, vy, lifetime, size) {
        this.x = x; this.y = y; this.color = color;
        this.vx = vx; this.vy = vy; this.lifetime = lifetime;
        this.maxLifetime = lifetime; this.size = size;
    }
    update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.vx *= 0.98; this.vy *= 0.98; this.lifetime -= dt * 1000; }
    draw() {
        const a = this.lifetime / this.maxLifetime;
        ctx.save(); ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size * a, 0, Math.PI * 2);
        ctx.fillStyle = this.color; ctx.fill(); ctx.restore();
    }
    isExpired() { return this.lifetime <= 0; }
}

function createExplosion(x, y, color, count = 20) {
    soundManager.playExplosion();
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2, s = randomRange(50, 200);
        particles.push(new Particle(x, y, color, Math.cos(a) * s, Math.sin(a) * s, randomRange(500, 1500), randomRange(2, 6)));
    }
}

function createThrustParticle(ship) {
    const trail = getEquippedTrail();
    let c;
    if (trail.colors[0] === 'rainbow') c = `hsl(${(Date.now() / 5) % 360}, 100%, 50%)`;
    else c = trail.colors[Math.random() > 0.5 ? 0 : 1];
    const a = ship.angle + Math.PI + randomRange(-0.3, 0.3), s = randomRange(100, 200);
    const px = ship.x - Math.cos(ship.angle) * SHIP_SIZE * 0.5;
    const py = ship.y - Math.sin(ship.angle) * SHIP_SIZE * 0.5;
    particles.push(new Particle(px, py, c, Math.cos(a) * s, Math.sin(a) * s, randomRange(200, 400), randomRange(2, 4)));
}

// Powerup types: shield, rapidfire, magnet, timeslow, piercing
const POWERUP_TYPES = [
    { id: 'shield', icon: '🛡️', color: '#00f0ff' },
    { id: 'rapidfire', icon: '⚡', color: '#ffd700' },
    { id: 'magnet', icon: '🧲', color: '#ff44aa' },
    { id: 'timeslow', icon: '⏱️', color: '#4488ff' },
    { id: 'piercing', icon: '🎯', color: '#ff8800' }
];

class Powerup {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        const typeData = POWERUP_TYPES.find(t => t.id === type) || POWERUP_TYPES[0];
        this.icon = typeData.icon;
        this.color = typeData.color;
        this.radius = 15; this.rotation = 0; this.pulsePhase = 0; this.lifetime = 12000;
    }
    update(dt) { this.rotation += 2 * dt; this.pulsePhase += 5 * dt; this.lifetime -= dt * 1000; }
    draw() {
        const pulse = Math.sin(this.pulsePhase) * 0.2 + 1;
        const r = this.radius * pulse;
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rotation);
        ctx.beginPath(); ctx.arc(0, 0, r + 10, 0, Math.PI * 2);
        ctx.fillStyle = this.color.replace(')', ', 0.2)').replace('rgb', 'rgba').replace('#', 'rgba('); 
        ctx.fillStyle = `${this.color}33`; ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = this.color; ctx.shadowColor = this.color; ctx.shadowBlur = 15; ctx.fill();
        ctx.fillStyle = '#000'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0; ctx.fillText(this.icon, 0, 0);
        ctx.restore();
    }
    isExpired() { return this.lifetime <= 0; }
    isCollidingWith(obj) { return distance(this.x, this.y, obj.x, obj.y) < this.radius + SHIP_SIZE; }
}

function spawnPowerup(x, y) {
    // Each powerup type has 10% chance to spawn = 50% total chance for any powerup
    POWERUP_TYPES.forEach(type => {
        if (Math.random() < POWERUP_SPAWN_CHANCE_PER_TYPE) {
            // Offset spawn position slightly if multiple powerups spawn
            const offsetX = randomRange(-20, 20);
            const offsetY = randomRange(-20, 20);
            powerups.push(new Powerup(x + offsetX, y + offsetY, type.id));
        }
    });
}

function spawnCoin(x, y) { coinItems.push(new Coin(x, y, randomInt(1, 3))); }

// ========================================
// GAME FUNCTIONS
// ========================================
function spawnAsteroids(count) {
    for (let i = 0; i < count; i++) {
        let x, y;
        do { x = Math.random() * canvas.width; y = Math.random() * canvas.height; } while (ship && distance(x, y, ship.x, ship.y) < 200);
        asteroids.push(new Asteroid(x, y, 'large', level));
    }
}

function spawnBossWave() {
    bossPhase = true; bossWaveComplete = false;
    const alienCount = Math.min(1 + Math.floor(level / 2), 5); // Reduced: was 2 + level/2, max 8
    for (let i = 0; i < alienCount; i++) setTimeout(() => catAliens.push(new CatAlien(level)), i * 800);
    queueNotification('boss-notification', 2000);
}

function startGame() {
    soundManager.init();
    currentState = GameState.PLAYING;
    score = 0; level = 1; lives = 3; coinsThisGame = 0;
    asteroidsDestroyed = 0; aliensDestroyed = 0;
    bullets = []; asteroids = []; particles = []; powerups = [];
    catAliens = []; alienBullets = []; coinItems = [];
    bossPhase = false; bossWaveComplete = false;
    notificationQueue = []; currentNotification = null;
    ship = new Ship();
    spawnAsteroids(4);
    gameData.stats.totalGames++;
    saveGameData();
    updateHUD(); hideOverlay('start-screen'); hideOverlay('gameover-screen'); hideOverlay('pause-screen');
}

function endGame() {
    currentState = GameState.GAMEOVER;
    gameData.totalCoins += coinsThisGame;
    gameData.stats.totalAsteroids += asteroidsDestroyed;
    gameData.stats.totalAliens += aliensDestroyed;
    gameData.stats.totalCoinsEarned += coinsThisGame;
    if (score > gameData.highScore) {
        gameData.highScore = score;
        document.getElementById('highscore-display').classList.remove('hidden');
    } else {
        document.getElementById('highscore-display').classList.add('hidden');
    }
    saveGameData();
    document.getElementById('final-score').textContent = score;
    document.getElementById('final-level').textContent = level;
    document.getElementById('asteroids-destroyed').textContent = asteroidsDestroyed;
    document.getElementById('aliens-destroyed').textContent = aliensDestroyed;
    document.getElementById('coins-earned').textContent = '🪙 ' + coinsThisGame;
    showOverlay('gameover-screen');
    updateWalletDisplays();
}

function goHome() {
    currentState = GameState.MENU;
    hideOverlay('pause-screen');
    hideOverlay('gameover-screen');
    showOverlay('start-screen');
    updateWalletDisplays();
}

function pauseGame() { if (currentState === GameState.PLAYING) { currentState = GameState.PAUSED; showOverlay('pause-screen'); } }
function resumeGame() { if (currentState === GameState.PAUSED) { currentState = GameState.PLAYING; hideOverlay('pause-screen'); lastTime = performance.now(); } }

function nextLevel() {
    level++;
    coinItems = [];
    document.getElementById('new-level').textContent = level;
    queueNotification('levelup-notification', 1500);
    setTimeout(() => { spawnAsteroids(3 + Math.floor(level * 0.8)); bossPhase = false; bossWaveComplete = false; }, 2000);
    updateHUD();
}

function loseLife() {
    lives--; updateHUD();
    if (lives <= 0) endGame();
    else { ship.reset(); createExplosion(ship.x, ship.y, '#00ffff', 30); }
}

// ========================================
// UPDATE & RENDER
// ========================================
function update(dt) {
    processNotifications(dt);
    if (currentState !== GameState.PLAYING) return;
    
    const gameDt = ship.update(dt); // Ship updates at normal speed, returns slowed dt for others
    
    // Player bullets move at normal speed, not affected by Time Slow
    bullets.forEach(b => {
        if (b.isPlayer) {
            b.update(dt); // Player bullets always normal speed
        } else {
            b.update(gameDt); // Enemy bullets are slowed
        }
    });
    bullets = bullets.filter(b => !b.isExpired());
    asteroids.forEach(a => a.update(gameDt));
    particles.forEach(p => p.update(dt)); // Particles always normal speed
    particles = particles.filter(p => !p.isExpired());
    powerups.forEach(p => p.update(dt));
    powerups = powerups.filter(p => !p.isExpired());
    catAliens.forEach(a => a.update(gameDt));
    alienBullets.forEach(b => b.update(gameDt));
    alienBullets = alienBullets.filter(b => !b.isExpired());
    coinItems.forEach(c => c.update(dt));

    // Bullet-asteroid collisions
    for (let i = bullets.length - 1; i >= 0; i--) {
        if (!bullets[i] || !bullets[i].isPlayer) continue;
        for (let j = asteroids.length - 1; j >= 0; j--) {
            if (bullets[i] && bullets[i].isCollidingWith(asteroids[j])) {
                createExplosion(asteroids[j].x, asteroids[j].y, '#ff6633', 15);
                asteroids.push(...asteroids[j].split());
                spawnPowerup(asteroids[j].x, asteroids[j].y);
                spawnCoin(asteroids[j].x, asteroids[j].y);
                score += asteroids[j].points * level;
                asteroidsDestroyed++;
                updateHUD();
                if (bullets[i].piercing) {
                    bullets[i].hitCount++;
                } else {
                    bullets.splice(i, 1);
                }
                asteroids.splice(j, 1);
                if (!bullets[i] || !bullets[i].piercing) break;
            }
        }
    }

    // Bullet-alien collisions
    for (let i = bullets.length - 1; i >= 0; i--) {
        if (!bullets[i] || !bullets[i].isPlayer) continue;
        for (let j = catAliens.length - 1; j >= 0; j--) {
            if (distance(bullets[i].x, bullets[i].y, catAliens[j].x, catAliens[j].y) < bullets[i].radius + catAliens[j].radius) {
                if (catAliens[j].takeDamage()) {
                    createExplosion(catAliens[j].x, catAliens[j].y, '#aa44ff', 25);
                    for (let k = 0; k < 5; k++) spawnCoin(catAliens[j].x + randomRange(-30, 30), catAliens[j].y + randomRange(-30, 30));
                    score += 500 * level;
                    aliensDestroyed++;
                    catAliens.splice(j, 1);
                } else {
                    createExplosion(catAliens[j].x, catAliens[j].y, '#ffffff', 5);
                }
                if (bullets[i].piercing) {
                    bullets[i].hitCount++;
                } else {
                    bullets.splice(i, 1);
                }
                updateHUD();
                break;
            }
        }
    }

    // Ship-asteroid collisions
    for (let a of asteroids) { if (ship.isCollidingWith(a)) { createExplosion(ship.x, ship.y, '#ff3366', 40); loseLife(); break; } }

    // Ship-alien collisions
    for (let a of catAliens) { if (ship.isCollidingWith({ x: a.x, y: a.y, radius: a.radius })) { createExplosion(ship.x, ship.y, '#ff3366', 40); loseLife(); break; } }

    // Alien bullet-ship collisions
    for (let i = alienBullets.length - 1; i >= 0; i--) {
        if (distance(alienBullets[i].x, alienBullets[i].y, ship.x, ship.y) < alienBullets[i].radius + SHIP_SIZE && !ship.invulnerable && !ship.shieldActive) {
            createExplosion(ship.x, ship.y, '#ff3366', 40);
            alienBullets.splice(i, 1);
            loseLife();
            break;
        }
    }

    // Ship-powerup collisions
    for (let i = powerups.length - 1; i >= 0; i--) {
        if (powerups[i].isCollidingWith(ship)) {
            soundManager.playPowerup();
            switch (powerups[i].type) {
                case 'shield': ship.activateShield(); break;
                case 'rapidfire': ship.activateRapidFire(); break;
                case 'magnet': ship.activateMagnet(); break;
                case 'timeslow': ship.activateTimeSlow(); break;
                case 'piercing': ship.activatePiercing(); break;
            }
            createExplosion(powerups[i].x, powerups[i].y, powerups[i].color, 10);
            powerups.splice(i, 1);
        }
    }

    // Ship-coin collisions
    for (let i = coinItems.length - 1; i >= 0; i--) {
        if (coinItems[i].isCollidingWith(ship)) {
            soundManager.playCoin();
            coinsThisGame += coinItems[i].value;
            createExplosion(coinItems[i].x, coinItems[i].y, '#ffdd00', 8);
            coinItems.splice(i, 1);
            updateHUD();
        }
    }

    // Level progression
    if (!bossPhase && asteroids.length === 0) spawnBossWave();
    if (bossPhase && catAliens.length === 0 && !bossWaveComplete) {
        bossWaveComplete = true;
        queueNotification('wave-clear-notification', 1500);
        setTimeout(nextLevel, 2500);
    }
}

function render() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Time slow visual effect
    if (ship && ship.timeSlowActive) {
        ctx.fillStyle = 'rgba(68, 136, 255, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    const time = Date.now() / 1000;
    stars.forEach(s => {
        const tw = Math.sin(time * s.twinkleSpeed) * 0.3 + 0.7;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.brightness * tw})`; ctx.fill();
    });
    particles.forEach(p => p.draw());
    coinItems.forEach(c => c.draw());
    powerups.forEach(p => p.draw());
    asteroids.forEach(a => a.draw());
    catAliens.forEach(a => a.draw());
    bullets.forEach(b => b.draw());
    alienBullets.forEach(b => b.draw());
    if (ship && currentState === GameState.PLAYING) ship.draw();
}

function gameLoop(t) {
    deltaTime = Math.min((t - lastTime) / 1000, 0.1);
    lastTime = t;
    update(deltaTime);
    render();
    requestAnimationFrame(gameLoop);
}

// ========================================
// UI FUNCTIONS
// ========================================
function updateHUD() {
    document.getElementById('score').textContent = score.toLocaleString();
    document.getElementById('level').textContent = level;
    document.getElementById('coins').textContent = coinsThisGame;
    const lc = document.getElementById('lives');
    lc.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const div = document.createElement('div');
        div.innerHTML = `<svg class="life-icon ${i >= lives ? 'lost' : ''}" viewBox="0 0 24 24"><path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8Z" fill="${i >= lives ? '#333' : '#00ffff'}"/></svg>`;
        lc.appendChild(div);
    }
}

function updateWalletDisplays() {
    ['wallet-coins', 'shop-wallet-coins'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = gameData.totalCoins;
    });
}

function showOverlay(id) { document.getElementById(id).classList.remove('hidden'); }
function hideOverlay(id) { document.getElementById(id).classList.add('hidden'); }
function showPowerupIndicator(type) { document.getElementById(`${type}-indicator`).classList.remove('hidden'); }
function hidePowerupIndicator(type) { document.getElementById(`${type}-indicator`).classList.add('hidden'); }
function updatePowerupIndicator(type, timeLeft, maxTime) {
    const bar = document.getElementById(`${type}-bar`);
    if (bar) bar.style.width = `${(timeLeft / maxTime) * 100}%`;
    if (timeLeft <= 0) hidePowerupIndicator(type);
}

// ========================================
// SHOP UI
// ========================================
function initShop() {
    document.querySelectorAll('.shop-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.shop-section').forEach(s => s.classList.add('hidden'));
            document.getElementById(`${tab.dataset.tab}-section`).classList.remove('hidden');
        });
    });
    renderShopItems();
}

function renderShopItems() {
    ['skins', 'trails', 'bullets'].forEach(category => {
        const grid = document.getElementById(`${category}-grid`);
        grid.innerHTML = '';
        SHOP_ITEMS[category].forEach(item => {
            const owned = gameData.ownedItems[category].includes(item.id);
            const equipped = (category === 'skins' && gameData.equippedItems.skin === item.id) ||
                           (category === 'trails' && gameData.equippedItems.trail === item.id) ||
                           (category === 'bullets' && gameData.equippedItems.bullet === item.id);
            const div = document.createElement('div');
            div.className = `shop-item ${owned ? 'owned' : ''} ${equipped ? 'equipped' : ''}`;
            div.innerHTML = `
                <div class="shop-item-preview"><canvas width="50" height="50"></canvas></div>
                <div class="shop-item-name">${item.name}</div>
                ${owned ? `<div class="shop-item-status ${equipped ? 'equipped' : 'owned'}">${equipped ? '✓ EQUIPPED' : 'OWNED'}</div>` : `<div class="shop-item-price">🪙 ${item.price}</div>`}
            `;
            drawShopPreview(div.querySelector('canvas'), category, item);
            div.addEventListener('click', () => handleShopClick(category, item, owned, equipped));
            grid.appendChild(div);
        });
    });
}

function drawShopPreview(canvas, category, item) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 50, 50);
    
    if (category === 'skins') {
        ctx.save(); ctx.translate(25, 25);
        
        // Special Christmas ship previews
        if (item.special === 'christmas_tree') {
            // Draw Christmas tree shaped ship
            ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, 9); ctx.lineTo(-6, 0); ctx.lineTo(-10, -9); ctx.closePath();
            const g = ctx.createLinearGradient(-10, 0, 15, 0);
            g.addColorStop(0, '#004400'); g.addColorStop(0.5, '#006600'); g.addColorStop(1, '#00aa00');
            ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 1; ctx.stroke();
            // Add ornaments/lights
            ctx.fillStyle = '#ff0000'; ctx.beginPath(); ctx.arc(5, -3, 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffdd00'; ctx.beginPath(); ctx.arc(0, 2, 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#0088ff'; ctx.beginPath(); ctx.arc(-4, -1, 2, 0, Math.PI * 2); ctx.fill();
            // Star on top
            ctx.fillStyle = '#ffff00'; ctx.beginPath(); ctx.arc(12, 0, 3, 0, Math.PI * 2); ctx.fill();
        } else if (item.special === 'christmas_present') {
            // Draw gift box shaped ship
            ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, 9); ctx.lineTo(-6, 0); ctx.lineTo(-10, -9); ctx.closePath();
            const g = ctx.createLinearGradient(-10, 0, 15, 0);
            g.addColorStop(0, '#aa0000'); g.addColorStop(0.5, '#ff0000'); g.addColorStop(1, '#ff4444');
            ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#ffdd00'; ctx.lineWidth = 2; ctx.stroke();
            // Ribbon cross
            ctx.strokeStyle = '#ffdd00'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(12, 0); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(2, -6); ctx.lineTo(2, 6); ctx.stroke();
            // Bow
            ctx.fillStyle = '#ffdd00';
            ctx.beginPath(); ctx.arc(12, 0, 4, 0, Math.PI * 2); ctx.fill();
        } else {
            // Standard ship preview
            ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, 9); ctx.lineTo(-6, 0); ctx.lineTo(-10, -9); ctx.closePath();
            const g = ctx.createLinearGradient(-10, 0, 15, 0);
            g.addColorStop(0, item.colors[0]); g.addColorStop(0.5, item.colors[1]); g.addColorStop(1, item.colors[2]);
            ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = item.colors[2]; ctx.lineWidth = 1; ctx.stroke();
        }
        ctx.restore();
        
    } else if (category === 'trails') {
        ctx.save(); ctx.translate(25, 25);
        
        // Special Christmas trail previews
        if (item.special === 'tinsel') {
            // Glittery tinsel trail - red, green, gold sparkles
            const colors = ['#ff0000', '#00ff00', '#ffdd00', '#ff0000', '#00ff00', '#ffdd00', '#ffffff', '#ff0000'];
            for (let i = 0; i < 8; i++) {
                ctx.beginPath(); ctx.arc(-15 + i * 3.5, Math.sin(i * 1.5) * 4, 3 - i * 0.25, 0, Math.PI * 2);
                ctx.fillStyle = colors[i]; ctx.globalAlpha = 1 - i * 0.08; ctx.fill();
                // Add sparkle effect
                if (i % 2 === 0) {
                    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.8 - i * 0.1;
                    ctx.fillRect(-15 + i * 3.5 - 0.5, Math.sin(i * 1.5) * 4 - 0.5, 1, 1);
                }
            }
        } else if (item.special === 'snow') {
            // Snowfall trail - white/ice blue with snowflake feel
            for (let i = 0; i < 10; i++) {
                const x = -18 + i * 4;
                const y = Math.sin(i * 0.8) * 5 + (i % 2) * 2;
                const size = 3 - i * 0.2;
                ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#aaddff'; 
                ctx.globalAlpha = 1 - i * 0.08; ctx.fill();
                // Tiny sparkles
                ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.9 - i * 0.08;
                ctx.beginPath(); ctx.arc(x + 1, y - 1, 0.5, 0, Math.PI * 2); ctx.fill();
            }
        } else {
            // Standard trail preview
            for (let i = 0; i < 8; i++) {
                const c = item.colors[0] === 'rainbow' ? `hsl(${i * 45}, 100%, 50%)` : item.colors[i % 2];
                ctx.beginPath(); ctx.arc(-15 + i * 3, Math.sin(i) * 3, 4 - i * 0.4, 0, Math.PI * 2);
                ctx.fillStyle = c; ctx.globalAlpha = 1 - i * 0.1; ctx.fill();
            }
        }
        ctx.restore();
        
    } else {
        // Bullet previews
        if (item.special === 'bulb') {
            // Christmas bulb - ornament shape with shine
            ctx.save();
            ctx.beginPath(); ctx.arc(25, 27, 9, 0, Math.PI * 2);
            const g = ctx.createRadialGradient(22, 24, 0, 25, 27, 9);
            g.addColorStop(0, '#ff6666'); g.addColorStop(0.5, '#ff0000'); g.addColorStop(1, '#aa0000');
            ctx.fillStyle = g; ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 12; ctx.fill();
            // Cap/hook
            ctx.fillStyle = '#888888'; ctx.fillRect(22, 17, 6, 4);
            ctx.fillStyle = '#aaaaaa'; ctx.fillRect(24, 15, 2, 3);
            // Shine
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.beginPath(); ctx.arc(22, 24, 3, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else if (item.special === 'snowball') {
            // Snowball - white with icy texture
            ctx.save();
            ctx.beginPath(); ctx.arc(25, 25, 10, 0, Math.PI * 2);
            const g = ctx.createRadialGradient(22, 22, 0, 25, 25, 10);
            g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#ddeeff'); g.addColorStop(1, '#aaccee');
            ctx.fillStyle = g; ctx.shadowColor = '#88ccff'; ctx.shadowBlur = 12; ctx.fill();
            // Ice crystals / texture
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.beginPath(); ctx.arc(22, 22, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(27, 24, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(24, 28, 1, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else {
            // Standard bullet preview
            ctx.beginPath(); ctx.arc(25, 25, 8, 0, Math.PI * 2);
            ctx.fillStyle = item.color; ctx.shadowColor = item.color; ctx.shadowBlur = 10; ctx.fill();
        }
    }
}

function handleShopClick(category, item, owned, equipped) {
    if (equipped) return;
    if (owned) {
        if (category === 'skins') gameData.equippedItems.skin = item.id;
        else if (category === 'trails') gameData.equippedItems.trail = item.id;
        else gameData.equippedItems.bullet = item.id;
        saveGameData();
        renderShopItems();
    } else if (gameData.totalCoins >= item.price) {
        gameData.totalCoins -= item.price;
        gameData.ownedItems[category].push(item.id);
        saveGameData();
        updateWalletDisplays();
        renderShopItems();
    }
}

// ========================================
// EVENT LISTENERS
// ========================================
window.addEventListener('resize', resizeCanvas);
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Escape') { if (currentState === GameState.PLAYING) pauseGame(); else if (currentState === GameState.PAUSED) resumeGame(); }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

document.getElementById('start-button').addEventListener('click', startGame);
document.getElementById('resume-button').addEventListener('click', resumeGame);
document.getElementById('restart-button').addEventListener('click', startGame);
document.getElementById('playagain-button').addEventListener('click', startGame);
document.getElementById('pause-home-button').addEventListener('click', goHome);
document.getElementById('gameover-home-button').addEventListener('click', goHome);
document.getElementById('shop-button').addEventListener('click', () => { hideOverlay('start-screen'); showOverlay('shop-screen'); updateWalletDisplays(); renderShopItems(); });
document.getElementById('shop-close-button').addEventListener('click', () => { hideOverlay('shop-screen'); showOverlay('start-screen'); });

// ========================================
// INIT
// ========================================
function init() {
    loadGameData();
    resizeCanvas();
    updateHUD();
    updateWalletDisplays();
    initShop();
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}
init();
