// Music Player App - Main Script
// Complete PWA music player for iOS/Safari

class MusicPlayer {
    constructor() {
        // Audio elements
        this.audio = document.getElementById('audioPlayer');

        // UI Elements - with safety checks
        this.playBtn = document.getElementById('playBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.shuffleBtn = document.getElementById('shuffleBtn');
        this.loopBtn = document.getElementById('loopBtn');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.fileInput = document.getElementById('fileInput');
        this.addUrlBtn = document.getElementById('addUrlBtn');
        this.urlInput = document.getElementById('urlInput');
        this.songNameInput = document.getElementById('songNameInput');
        this.searchInput = document.getElementById('searchInput');
        this.playlist = document.getElementById('playlist');
        this.progressBar = document.getElementById('progressBar');
        this.progressFill = document.getElementById('progressFill');
        this.currentTimeEl = document.getElementById('currentTime');
        this.durationEl = document.getElementById('duration');
        this.songTitle = document.getElementById('songTitle');
        this.songArtist = document.getElementById('songArtist');
        this.status = document.getElementById('status');
        this.shuffleBadge = document.getElementById('shuffleBadge');
        this.loopBadge = document.getElementById('loopBadge');
        this.albumArt = document.getElementById('albumArt');

        // Validate all elements exist
        this.validateElements();

        // Player state
        this.songs = [];
        this.filteredSongs = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.isShuffle = false;
        this.loopMode = 0; // 0: no loop, 1: loop all, 2: loop one
        this.currentFileIndex = null;

        // Initialize
        this.init();
    }

    validateElements() {
        const requiredElements = {
            'playBtn': this.playBtn,
            'audio': this.audio,
            'playlist': this.playlist,
            'status': this.status
        };

        for (const [name, element] of Object.entries(requiredElements)) {
            if (!element) {
                console.error(`Missing element: ${name}`);
            }
        }
    }

    init() {
        try {
            this.setupEventListeners();
            this.loadSongsFromStorage();
            this.registerServiceWorker();
            this.setupMediaSession();
            console.log('✓ Music Player initialized successfully');
        } catch (error) {
            console.error('Error initializing player:', error);
        }
    }

    // === Event Listeners ===
    setupEventListeners() {
        if (!this.playBtn) return;

        this.playBtn.addEventListener('click', () => this.togglePlay());
        this.prevBtn?.addEventListener('click', () => this.prevSong());
        this.nextBtn?.addEventListener('click', () => this.nextSong());
        this.shuffleBtn?.addEventListener('click', () => this.toggleShuffle());
        this.loopBtn?.addEventListener('click', () => this.toggleLoop());
        this.uploadBtn?.addEventListener('click', () => this.fileInput?.click());
        this.fileInput?.addEventListener('change', (e) => this.handleFileUpload(e));
        this.addUrlBtn?.addEventListener('click', () => this.addSongFromUrl());
        this.urlInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addSongFromUrl();
        });
        this.searchInput?.addEventListener('input', (e) => this.filterSongs(e.target.value));
        this.progressBar?.addEventListener('click', (e) => this.seek(e));

        // Audio events
        this.audio?.addEventListener('timeupdate', () => this.updateProgress());
        this.audio?.addEventListener('ended', () => this.handleSongEnd());
        this.audio?.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audio?.addEventListener('play', () => {
            this.isPlaying = true;
            this.updatePlayButton();
            this.updateActivePlaylistItem();
        });
        this.audio?.addEventListener('pause', () => {
            this.isPlaying = false;
            this.updatePlayButton();
        });

        // Prevent default iOS behavior
        document.addEventListener('touchmove', (e) => {
            if (e.target.closest?.('.playlist-section')) {
                return;
            }
        }, { passive: true });
    }

    // === File Upload ===
    async handleFileUpload(e) {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        try {
            for (const file of files) {
                if (!file.type.includes('audio')) {
                    console.warn(`Skipped non-audio file: ${file.name}`);
                    continue;
                }

                const blob = new Blob([file], { type: file.type });
                const url = URL.createObjectURL(blob);
                const duration = await this.getAudioDuration(url);

                const song = {
                    id: Date.now() + Math.random(),
                    name: file.name.replace('.mp3', '').replace('.mp4', ''),
                    url: url,
                    duration: duration,
                    artist: 'Local'
                };

                this.songs.push(song);
            }

            this.saveSongsToStorage();
            this.filteredSongs = [...this.songs];
            this.renderPlaylist();
            if (this.status) this.status.textContent = `✓ Added ${files.length} song(s)`;
            if (this.fileInput) this.fileInput.value = '';

            if (this.songs.length === 1) {
                this.playIndex(0);
            }
        } catch (error) {
            console.error('Error uploading files:', error);
            if (this.status) this.status.textContent = '✗ Error uploading files';
        }
    }

    // Get audio duration
    getAudioDuration(url) {
        return new Promise((resolve) => {
            const audio = new Audio();
            audio.onloadedmetadata = () => {
                resolve(audio.duration);
                audio.src = '';
            };
            audio.onerror = () => resolve(0);
            audio.src = url;
        });
    }

    // Add song from URL
    async addSongFromUrl() {
        const url = this.urlInput?.value.trim() || '';
        const songName = this.songNameInput?.value.trim() || '';

        if (!url) {
            if (this.status) this.status.textContent = '⚠ Please enter a URL';
            return;
        }

        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            if (this.status) this.status.textContent = '⚠ URL must start with http:// or https://';
            return;
        }

        try {
            if (this.status) this.status.textContent = '🔄 Loading...';

            const duration = await this.getAudioDuration(url);

            if (duration === 0) {
                if (this.status) this.status.textContent = '✗ Invalid URL or CORS blocked';
                return;
            }

            const song = {
                id: Date.now() + Math.random(),
                name: songName || url.split('/').pop() || 'Unknown Song',
                url: url,
                duration: duration,
                artist: 'Online'
            };

            this.songs.push(song);
            this.saveSongsToStorage();
            this.filteredSongs = [...this.songs];
            this.renderPlaylist();

            if (this.status) this.status.textContent = `✓ Added: ${song.name}`;

            if (this.urlInput) this.urlInput.value = '';
            if (this.songNameInput) this.songNameInput.value = '';

            if (this.songs.length === 1) {
                this.playIndex(0);
            }
        } catch (error) {
            console.error('Error adding song from URL:', error);
            if (this.status) this.status.textContent = '✗ Error: Check URL';
        }
    }

    // === Playback Control ===
    togglePlay() {
        if (!this.audio) return;

        if (this.songs.length === 0) {
            if (this.status) this.status.textContent = '⚠ No songs added yet';
            return;
        }

        if (!this.audio.src) {
            this.playIndex(0);
        } else if (this.audio.paused) {
            this.audio.play().catch((error) => {
                console.error('Play error:', error);
                if (this.status) this.status.textContent = '✗ Failed to play';
            });
        } else {
            this.audio.pause();
        }
    }

    playIndex(index) {
        if (!this.audio || index < 0 || index >= this.filteredSongs.length) return;

        const song = this.filteredSongs[index];
        this.currentIndex = index;
        this.currentFileIndex = this.songs.indexOf(song);
        this.audio.src = song.url;
        this.audio.load();

        if (this.songTitle) this.songTitle.textContent = song.name;
        if (this.songArtist) this.songArtist.textContent = song.artist;
        if (this.albumArt) this.albumArt.textContent = '🎵';

        this.audio.play().catch((error) => {
            console.error('Play error:', error);
            if (this.status) this.status.textContent = '✗ Failed to play';
        });

        this.updateActivePlaylistItem();
        this.updateMediaSession(song);
    }

    nextSong() {
        if (this.filteredSongs.length === 0) return;

        let nextIndex;
        if (this.isShuffle) {
            nextIndex = Math.floor(Math.random() * this.filteredSongs.length);
        } else {
            nextIndex = (this.currentIndex + 1) % this.filteredSongs.length;
        }

        this.playIndex(nextIndex);
    }

    prevSong() {
        if (this.filteredSongs.length === 0) return;

        let prevIndex = (this.currentIndex - 1 + this.filteredSongs.length) % this.filteredSongs.length;
        this.playIndex(prevIndex);
    }

    toggleShuffle() {
        this.isShuffle = !this.isShuffle;
        if (this.shuffleBtn) this.shuffleBtn.style.opacity = this.isShuffle ? '1' : '0.6';
        if (this.shuffleBadge) {
            this.shuffleBadge.textContent = `Shuffle: ${this.isShuffle ? 'ON' : 'OFF'}`;
            this.shuffleBadge.classList.toggle('active', this.isShuffle);
        }
    }

    toggleLoop() {
        this.loopMode = (this.loopMode + 1) % 3;
        const modeLabels = ['Loop: OFF', 'Loop: ALL', 'Loop: ONE'];
        if (this.loopBadge) {
            this.loopBadge.textContent = modeLabels[this.loopMode];
            this.loopBadge.classList.toggle('active', this.loopMode > 0);
        }
        if (this.loopBtn) this.loopBtn.style.opacity = this.loopMode > 0 ? '1' : '0.6';
    }

    handleSongEnd() {
        if (!this.audio) return;

        if (this.loopMode === 2) {
            this.audio.currentTime = 0;
            this.audio.play();
        } else if (this.currentIndex < this.filteredSongs.length - 1 || this.loopMode === 1) {
            this.nextSong();
        } else if (this.loopMode === 1) {
            this.playIndex(0);
        }
    }

    // === Progress and Time ===
    updateProgress() {
        if (!this.audio || !this.audio.duration) return;

        const percent = (this.audio.currentTime / this.audio.duration) * 100;
        if (this.progressFill) this.progressFill.style.width = percent + '%';
        if (this.currentTimeEl) this.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
    }

    updateDuration() {
        if (!this.audio) return;
        if (this.durationEl) this.durationEl.textContent = this.formatTime(this.audio.duration);
    }

    seek(e) {
        if (!this.audio || !this.audio.duration || !this.progressBar) return;

        const rect = this.progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        this.audio.currentTime = percent * this.audio.duration;
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    updatePlayButton() {
        if (!this.playBtn) return;
        this.playBtn.textContent = this.isPlaying ? '⏸' : '▶';
        this.playBtn.style.opacity = this.isPlaying ? '1' : '0.8';
    }

    // === Playlist Management ===
    filterSongs(query) {
        if (!query.trim()) {
            this.filteredSongs = [...this.songs];
        } else {
            const lower = query.toLowerCase();
            this.filteredSongs = this.songs.filter(song =>
                song.name.toLowerCase().includes(lower) ||
                song.artist.toLowerCase().includes(lower)
            );
        }

        this.renderPlaylist();

        if (this.currentIndex >= this.filteredSongs.length) {
            this.currentIndex = 0;
        }
    }

    renderPlaylist() {
        if (!this.playlist) return;

        if (this.filteredSongs.length === 0) {
            this.playlist.innerHTML = '<li class="empty-state">No songs found</li>';
            return;
        }

        this.playlist.innerHTML = this.filteredSongs.map((song, index) => `
            <li class="playlist-item ${index === this.currentIndex ? 'active' : ''}" data-index="${index}">
                <div class="playlist-item-title">🎵 ${song.name}</div>
                <div class="playlist-item-duration">${this.formatTime(song.duration)}</div>
            </li>
        `).join('');

        this.playlist.querySelectorAll('.playlist-item').forEach((item) => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.playIndex(index);
            });
        });
    }

    updateActivePlaylistItem() {
        if (!this.playlist) return;
        this.playlist.querySelectorAll('.playlist-item').forEach((item, index) => {
            item.classList.toggle('active', index === this.currentIndex);
        });
    }

    // === Storage ===
    saveSongsToStorage() {
        try {
            const metadata = this.songs.map(song => ({
                id: song.id,
                name: song.name,
                duration: song.duration,
                artist: song.artist
            }));
            localStorage.setItem('musicPlayer_songs', JSON.stringify(metadata));
        } catch (error) {
            console.error('Error saving to storage:', error);
        }
    }

    loadSongsFromStorage() {
        try {
            const stored = localStorage.getItem('musicPlayer_songs');
            if (stored) {
                console.log('Found songs in storage (metadata only)');
            }
        } catch (error) {
            console.error('Error loading from storage:', error);
        }
    }

    // === Media Session API ===
    setupMediaSession() {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => {
                if (this.audio?.paused) this.audio.play();
            });

            navigator.mediaSession.setActionHandler('pause', () => {
                this.audio?.pause();
            });

            navigator.mediaSession.setActionHandler('nexttrack', () => {
                this.nextSong();
            });

            navigator.mediaSession.setActionHandler('previoustrack', () => {
                this.prevSong();
            });

            navigator.mediaSession.setActionHandler('seekto', (event) => {
                if (this.audio) this.audio.currentTime = event.seekTime;
            });
        }
    }

    updateMediaSession(song) {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: song.name,
                artist: song.artist,
                artwork: [
                    {
                        src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect fill="%23000" width="256" height="256"/><circle cx="128" cy="128" r="60" fill="%23fff"/><circle cx="128" cy="128" r="45" fill="%23000"/></svg>',
                        sizes: '256x256',
                        type: 'image/svg+xml'
                    }
                ]
            });
        }
    }

    // === Service Worker ===
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('service-worker.js').catch((error) => {
                console.log('Service Worker registration failed:', error);
            });
        }
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.player = new MusicPlayer();
        console.log('✓ Application started');
    } catch (error) {
        console.error('Failed to initialize app:', error);
        const status = document.getElementById('status');
        if (status) status.textContent = '✗ Error loading app';
    }
});

// Prevent iOS bounce scroll
document.addEventListener('touchmove', (e) => {
    if (e.target.closest?.('.playlist-section')) {
        return;
    }
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: true });
