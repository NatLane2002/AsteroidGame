// ========================================
// FIREBASE AUTHENTICATION & CLOUD SYNC
// Cosmic Cats - User Account System
// ========================================

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDxtRWdHjEqNJA7BNtlh0i8lZuqGMmaplg",
    authDomain: "cosmic-cats-62d36.firebaseapp.com",
    projectId: "cosmic-cats-62d36",
    storageBucket: "cosmic-cats-62d36.firebasestorage.app",
    messagingSenderId: "289789363110",
    appId: "1:289789363110:web:6253d6f7e672a203cf4567",
    measurementId: "G-HQQBKVQES1"
};

// Initialize Firebase (after SDK loads)
let firebaseApp = null;
let auth = null;
let db = null;
let currentUser = null;
let isLocalFileProtocol = false;

// Check if running from file:// protocol
function checkProtocol() {
    isLocalFileProtocol = window.location.protocol === 'file:';
    if (isLocalFileProtocol) {
        console.warn('⚠️ Running from file:// protocol. Firebase auth requires HTTP/HTTPS.');
        console.warn('📝 To enable cloud sync, run the game with a local server:');
        console.warn('   Option 1: npx serve (if you have Node.js)');
        console.warn('   Option 2: python -m http.server 8080');
        console.warn('   Option 3: Use VS Code Live Server extension');
    }
    return isLocalFileProtocol;
}

// Initialize Firebase when SDK is ready
function initFirebase() {
    checkProtocol();
    
    if (typeof firebase !== 'undefined') {
        try {
            firebaseApp = firebase.initializeApp(firebaseConfig);
            auth = firebase.auth();
            db = firebase.firestore();
            
            // Set persistence to LOCAL (works better with various environments)
            auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(err => {
                console.warn('Auth persistence not available:', err.message);
            });
            
            // Listen for auth state changes
            auth.onAuthStateChanged(handleAuthStateChanged);
            
            console.log('🔥 Firebase initialized successfully');
            return true;
        } catch (error) {
            console.error('Firebase initialization error:', error);
            return false;
        }
    }
    console.error('Firebase SDK not loaded');
    return false;
}

// ========================================
// AUTHENTICATION STATE HANDLER
// ========================================
function handleAuthStateChanged(user) {
    currentUser = user;
    
    if (user) {
        // User is signed in
        console.log('👤 User signed in:', user.email);
        updateAuthUI(true, user);
        
        // Load user data from cloud
        loadCloudData().then(cloudData => {
            if (cloudData) {
                mergeAndApplyData(cloudData);
            } else {
                // First time user - save local data to cloud
                saveToCloud();
            }
        });
    } else {
        // User is signed out
        console.log('👤 User signed out');
        updateAuthUI(false, null);
    }
}

// ========================================
// SIGN UP / SIGN IN / SIGN OUT
// ========================================
async function signUpWithEmail(email, password, displayName) {
    try {
        showAuthLoading(true);
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        
        // Update profile with display name
        await userCredential.user.updateProfile({
            displayName: displayName || email.split('@')[0]
        });
        
        // Save initial data to cloud
        await saveToCloud();
        
        hideAuthModal();
        showAuthNotification('Account created successfully! 🎉', 'success');
        return { success: true };
    } catch (error) {
        console.error('Sign up error:', error);
        showAuthError(getAuthErrorMessage(error.code));
        return { success: false, error: error.message };
    } finally {
        showAuthLoading(false);
    }
}

async function signInWithEmail(email, password) {
    try {
        showAuthLoading(true);
        await auth.signInWithEmailAndPassword(email, password);
        hideAuthModal();
        showAuthNotification('Welcome back, Captain! 🚀', 'success');
        return { success: true };
    } catch (error) {
        console.error('Sign in error:', error);
        showAuthError(getAuthErrorMessage(error.code));
        return { success: false, error: error.message };
    } finally {
        showAuthLoading(false);
    }
}

async function signInWithGoogle() {
    try {
        showAuthLoading(true);
        const provider = new firebase.auth.GoogleAuthProvider();
        
        // Try popup first, fall back to redirect if needed
        try {
            await auth.signInWithPopup(provider);
        } catch (popupError) {
            if (popupError.code === 'auth/popup-blocked' || 
                popupError.code === 'auth/operation-not-supported-in-this-environment') {
                // Fall back to redirect
                console.log('Popup blocked, using redirect...');
                await auth.signInWithRedirect(provider);
                return { success: true, redirected: true };
            }
            throw popupError;
        }
        
        hideAuthModal();
        showAuthNotification('Welcome, Space Traveler! 🌟', 'success');
        return { success: true };
    } catch (error) {
        console.error('Google sign in error:', error);
        showAuthError(getAuthErrorMessage(error.code));
        return { success: false, error: error.message };
    } finally {
        showAuthLoading(false);
    }
}

async function signOut() {
    try {
        await auth.signOut();
        showAuthNotification('Signed out successfully', 'info');
        return { success: true };
    } catch (error) {
        console.error('Sign out error:', error);
        return { success: false, error: error.message };
    }
}

async function resetPassword(email) {
    try {
        showAuthLoading(true);
        await auth.sendPasswordResetEmail(email);
        showAuthError('Password reset email sent! Check your inbox.', 'success');
        return { success: true };
    } catch (error) {
        console.error('Password reset error:', error);
        showAuthError(getAuthErrorMessage(error.code));
        return { success: false, error: error.message };
    } finally {
        showAuthLoading(false);
    }
}

// ========================================
// CLOUD DATA SYNC (FIRESTORE)
// ========================================
async function saveToCloud() {
    if (!currentUser || !db) {
        console.log('Cannot save: User not signed in');
        return false;
    }
    
    try {
        const dataToSave = {
            totalCoins: gameData.totalCoins,
            highScore: gameData.highScore,
            stats: gameData.stats,
            ownedItems: gameData.ownedItems,
            equippedItems: gameData.equippedItems,
            achievements: gameData.achievements,
            modifiers: activeModifiers, // Save unlocked modes
            settings: gameData.settings || {},
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
            lastDevice: navigator.userAgent.substring(0, 100)
        };
        
        await db.collection('users').doc(currentUser.uid).set(dataToSave, { merge: true });
        console.log('☁️ Data saved to cloud');
        showSyncIndicator('saved');
        return true;
    } catch (error) {
        console.error('Error saving to cloud:', error);
        showSyncIndicator('error');
        return false;
    }
}

async function loadCloudData() {
    if (!currentUser || !db) {
        console.log('Cannot load: User not signed in');
        return null;
    }
    
    try {
        const doc = await db.collection('users').doc(currentUser.uid).get();
        if (doc.exists) {
            console.log('☁️ Data loaded from cloud');
            return doc.data();
        }
        console.log('☁️ No cloud data found for user');
        return null;
    } catch (error) {
        console.error('Error loading from cloud:', error);
        return null;
    }
}

// Smart merge: Keep the BEST of local and cloud data
function mergeAndApplyData(cloudData) {
    // Use higher values for cumulative stats
    gameData.totalCoins = Math.max(gameData.totalCoins || 0, cloudData.totalCoins || 0);
    gameData.highScore = Math.max(gameData.highScore || 0, cloudData.highScore || 0);
    
    // Merge stats - use highest values
    if (cloudData.stats) {
        gameData.stats = gameData.stats || {};
        gameData.stats.totalGames = Math.max(gameData.stats.totalGames || 0, cloudData.stats.totalGames || 0);
        gameData.stats.totalAsteroids = Math.max(gameData.stats.totalAsteroids || 0, cloudData.stats.totalAsteroids || 0);
        gameData.stats.totalAliens = Math.max(gameData.stats.totalAliens || 0, cloudData.stats.totalAliens || 0);
        gameData.stats.totalSpacePirates = Math.max(gameData.stats.totalSpacePirates || 0, cloudData.stats.totalSpacePirates || 0);
        gameData.stats.totalCoinsEarned = Math.max(gameData.stats.totalCoinsEarned || 0, cloudData.stats.totalCoinsEarned || 0);
    }
    
    // Merge owned items - union of both sets
    if (cloudData.ownedItems) {
        gameData.ownedItems = gameData.ownedItems || {};
        for (const category in cloudData.ownedItems) {
            gameData.ownedItems[category] = [...new Set([
                ...(gameData.ownedItems[category] || []),
                ...(cloudData.ownedItems[category] || [])
            ])];
        }
    }
    
    // Use cloud equipped items if local ones are default
    if (cloudData.equippedItems) {
        gameData.equippedItems = cloudData.equippedItems;
    }
    
    // Merge achievements - union of both
    if (cloudData.achievements) {
        gameData.achievements = [...new Set([
            ...(gameData.achievements || []),
            ...(cloudData.achievements || [])
        ])];
    }
    
    // Merge settings
    if (cloudData.settings) {
        gameData.settings = { ...gameData.settings, ...cloudData.settings };
    }
    
    // Merge modifiers (unlocked game modes)
    if (cloudData.modifiers) {
        // We only want to enable unlocked modes, not disable them
        // So we take the true values from either source
        gameData.modifiers = gameData.modifiers || {};
        const savedMods = cloudData.modifiers;
        
        for (const mod in savedMods) {
            if (savedMods[mod] === true) {
                activeModifiers[mod] = true; // Update active modifiers immediately
                gameData.modifiers[mod] = true; // Update gameData
            }
        }
        
        // Also ensure any locally unlocked modes are preserved
        for (const mod in activeModifiers) {
            if (activeModifiers[mod] === true) {
                gameData.modifiers[mod] = true;
            }
        }
    }
    
    // Save merged data locally and to cloud
    saveGameData();
    saveToCloud();
    
    // Update UI
    updateWalletDisplays();
    console.log('✅ Data merged successfully');
    showAuthNotification('Data synced! 🔄', 'success');
}

// ========================================
// UI HELPERS
// ========================================
function updateAuthUI(isSignedIn, user) {
    const signInBtn = document.getElementById('auth-signin-btn');
    const userProfile = document.getElementById('user-profile');
    const userDisplayName = document.getElementById('user-display-name');
    const userAvatar = document.getElementById('user-avatar');
    
    if (isSignedIn && user) {
        if (signInBtn) signInBtn.style.display = 'none';
        if (userProfile) userProfile.style.display = 'flex';
        if (userDisplayName) userDisplayName.textContent = user.displayName || user.email.split('@')[0];
        if (userAvatar) {
            if (user.photoURL) {
                userAvatar.src = user.photoURL;
                userAvatar.style.display = 'block';
            } else {
                userAvatar.style.display = 'none';
            }
        }
    } else {
        if (signInBtn) signInBtn.style.display = 'flex';
        if (userProfile) userProfile.style.display = 'none';
    }
}

function showAuthModal(mode = 'signin') {
    const modal = document.getElementById('auth-modal');
    const signinForm = document.getElementById('signin-form');
    const signupForm = document.getElementById('signup-form');
    const resetForm = document.getElementById('reset-form');
    
    if (modal) {
        modal.classList.remove('hidden');
        clearAuthError();
    }
    
    // Show appropriate form
    if (signinForm) signinForm.style.display = mode === 'signin' ? 'block' : 'none';
    if (signupForm) signupForm.style.display = mode === 'signup' ? 'block' : 'none';
    if (resetForm) resetForm.style.display = mode === 'reset' ? 'block' : 'none';
}

function hideAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.add('hidden');
    clearAuthError();
}

function switchAuthForm(mode) {
    showAuthModal(mode);
}

function showAuthError(message, type = 'error') {
    const errorEl = document.getElementById('auth-error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.className = 'auth-message ' + type;
        errorEl.style.display = 'block';
    }
}

function clearAuthError() {
    const errorEl = document.getElementById('auth-error');
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.innerHTML = '';
        errorEl.style.display = 'none';
    }
}

function showAuthLoading(show) {
    const loader = document.getElementById('auth-loading');
    const forms = document.querySelectorAll('.auth-form button[type="submit"]');
    
    if (loader) loader.style.display = show ? 'flex' : 'none';
    forms.forEach(btn => btn.disabled = show);
}

function showAuthNotification(message, type = 'info') {
    // Use existing notification system or create a toast
    const toast = document.createElement('div');
    toast.className = `auth-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('visible'), 100);
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showSyncIndicator(status) {
    const indicator = document.getElementById('sync-indicator');
    if (!indicator) return;
    
    indicator.className = 'sync-indicator ' + status;
    indicator.style.display = 'flex';
    
    if (status === 'saved') {
        setTimeout(() => indicator.style.display = 'none', 2000);
    }
}

function getAuthErrorMessage(code) {
    const messages = {
        'auth/email-already-in-use': 'This email is already registered. Try signing in instead.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/operation-not-allowed': 'Sign-in method disabled. Enable Email/Password in Firebase Console.',
        'auth/weak-password': 'Password should be at least 6 characters.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
        'auth/popup-closed-by-user': 'Sign-in popup was closed.',
        'auth/network-request-failed': 'Network error. Check your connection.',
        'auth/operation-not-supported-in-this-environment': 'Please run the game from a local web server (see instructions above).'
    };
    return messages[code] || 'An error occurred. Please try again.';
}

// ========================================
// AUTO-SAVE ON GAME EVENTS
// ========================================
function setupCloudAutoSave() {
    // Save to cloud when game ends
    const originalEndGame = window.endGame;
    window.endGame = function() {
        if (originalEndGame) originalEndGame();
        if (currentUser) saveToCloud();
    };
    
    // Save to cloud when purchasing items
    const originalSaveGameData = window.saveGameData;
    window.saveGameData = function() {
        if (originalSaveGameData) originalSaveGameData();
        // Debounce cloud saves to avoid too many writes
        clearTimeout(window.cloudSaveTimeout);
        window.cloudSaveTimeout = setTimeout(() => {
            if (currentUser) saveToCloud();
        }, 2000);
    };
}

// ========================================
// FORM HANDLERS (called from HTML)
// ========================================
function handleSignIn(event) {
    event.preventDefault();
    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;
    signInWithEmail(email, password);
}

function handleSignUp(event) {
    event.preventDefault();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    
    if (password !== confirmPassword) {
        showAuthError('Passwords do not match');
        return;
    }
    
    signUpWithEmail(email, password, name);
}

function handlePasswordReset(event) {
    event.preventDefault();
    const email = document.getElementById('reset-email').value;
    resetPassword(email);
}

// Handle redirect result (for Google sign-in fallback)
function handleRedirectResult() {
    if (auth) {
        auth.getRedirectResult().then(result => {
            if (result.user) {
                showAuthNotification('Welcome, Space Traveler! 🌟', 'success');
            }
        }).catch(error => {
            if (error.code !== 'auth/no-auth-event') {
                console.error('Redirect result error:', error);
            }
        });
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Wait a moment for Firebase SDK to fully load
    setTimeout(() => {
        if (initFirebase()) {
            setupCloudAutoSave();
            handleRedirectResult();
        }
    }, 500);
});
