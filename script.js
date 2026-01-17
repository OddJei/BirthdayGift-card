const frame = document.querySelector('.projection-frame');
const layerA = document.querySelector('.slide-a');
const layerB = document.querySelector('.slide-b');
const toggle = document.getElementById('toggle');
const toggleText = document.getElementById('toggleText');
const counter = document.getElementById('counter');
const cover = document.getElementById('cover');
const openBtn = document.getElementById('openBtn');
const bgAudio = document.getElementById('bgAudio');

// Images from: asserts/images/ (shrunk set)
// NOTE: Browsers cannot list folders at runtime, so keep an explicit list generated from the workspace.
const slides = [
    'asserts/images/IMG-20260115-WA0000.jpg',
    'asserts/images/IMG-20260115-WA0002.jpg',
    'asserts/images/IMG-20260115-WA0003.jpg',
    'asserts/images/IMG-20260115-WA0004.jpg',
    'asserts/images/IMG-20260115-WA0006.jpg',
    'asserts/images/IMG-20260115-WA0010.jpg',
    'asserts/images/IMG-20260115-WA0012.jpg',
    'asserts/images/IMG-20260115-WA0017.jpg',
    'asserts/images/IMG-20260115-WA0022.jpg',
];

const TOTAL_SHOW_MS = 90_000; // 1 minute 30 seconds total
const FADE_MS = 1200;
const SLIDE_MS = Math.round(TOTAL_SHOW_MS / Math.max(1, slides.length));

// Shuffle the slides so each image appears once in a random order
function shuffleArray(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
}

function reshuffleForNewLoop() {
	shuffleArray(slides);
}

reshuffleForNewLoop();

let index = 0;
let isPlaying = true;
let isAActive = true;

let timeoutId = null;
let nextDueAt = 0;
let remainingMs = SLIDE_MS;

// Keep track of the last few transitions so we don't reuse
// any of the most recent ones. We store up to 3.
let lastTransitions = [];

// Different per-slide motion styles (Ken Burns variants)
// so each image can move a bit differently.
const DISPLAY_STYLES = [
	'kenburns',        // center zoom in/out
	'kenburns-left',   // slow pan left
	'kenburns-right',  // slow pan right
	'kenburns-up',     // slow pan up
	'kenburns-down',   // slow pan down
	'kenburns-tilt',   // gentle diagonal + tilt
];

let lastDisplayStyle = null;

// Transition weights (percent-like weights). 'flip' will be excluded on small screens.
const TRANSITION_WEIGHTS = {
	'fade': 30,
	'slide-left': 20,
	'slide-right': 20,
	'glow': 15,
	'spin': 10,
	'flip': 5,
};

function pickDisplayStyle() {
	// Simple random pick, avoiding repeating the exact last style
	if (!DISPLAY_STYLES.length) return 'kenburns';
	let choice = DISPLAY_STYLES[Math.floor(Math.random() * DISPLAY_STYLES.length)];
	if (DISPLAY_STYLES.length > 1 && choice === lastDisplayStyle) {
		// try once more to avoid immediate repeat
		choice = DISPLAY_STYLES[Math.floor(Math.random() * DISPLAY_STYLES.length)];
	}
	lastDisplayStyle = choice;
	return choice;
}

function pickTransition() {
	const isMobile = window.matchMedia('(max-width: 820px)').matches;
	const pool = [];
	for (const [t, w] of Object.entries(TRANSITION_WEIGHTS)) {
		if (isMobile && t === 'flip') continue; // exclude 3D flip on mobile
		// avoid repeating any of the last few transitions
		if (lastTransitions.includes(t)) continue;
		for (let i = 0; i < w; i++) pool.push(t);
	}

	// Fallbacks: if everything was filtered out, allow all non-mobile-disabled
	if (!pool.length) {
		for (const [t, w] of Object.entries(TRANSITION_WEIGHTS)) {
			if (isMobile && t === 'flip') continue;
			for (let i = 0; i < w; i++) pool.push(t);
		}
	}
	if (!pool.length) return 'fade';
	const choice = pool[Math.floor(Math.random() * pool.length)];
	// Update recent-transition history (max length 3)
	lastTransitions.push(choice);
	if (lastTransitions.length > 3) {
		lastTransitions.shift();
	}
	return choice;
}

function setLayerImage(layer, url) {
	layer.style.backgroundImage = `url("${url}")`;
	// Pick a motion style for this slide (Ken Burns variants)
	const animName = pickDisplayStyle();
	// Force a new animation for the Ken Burns-style effect.
	layer.style.animationDuration = `${SLIDE_MS}ms`;
	layer.style.animationName = 'none';
	// Force reflow so animation restarts reliably.
	void layer.offsetHeight;
	layer.style.animationName = animName;
}

function setPlayState(playState) {
	layerA.style.animationPlayState = playState;
	layerB.style.animationPlayState = playState;
}

function updateCounter() {
	counter.textContent = `${index + 1} / ${slides.length}`;
}

function preload(urls) {
	urls.forEach((url) => {
		const img = new Image();
		img.decoding = 'async';
		img.loading = 'eager';
		img.src = url;
	});
}

function showInitial() {
	if (!slides.length) return;
	setLayerImage(layerA, slides[0]);
	layerA.classList.add('is-active');
	layerB.classList.remove('is-active');
	frame.setAttribute('aria-label', `Slide 1`);
	updateCounter();
}

function advance() {
	if (!slides.length) return;

	const nextIndex = index + 1;
	if (nextIndex >= slides.length) {
		// Loop: reshuffle and start again from first.
		reshuffleForNewLoop();
		index = 0;
		showInitial();
		return;
	}

	index = nextIndex;
	const nextUrl = slides[index];
	const incoming = isAActive ? layerB : layerA;
	const outgoing = isAActive ? layerA : layerB;

	// choose a random weighted transition for this swap
	const choice = pickTransition();
	// clean previous transient classes on the frame (CSS expects t- classes on the frame)
	const frameEl = frame;
	['t-fade','t-slide-left','t-slide-right','t-glow','t-spin','t-flip'].forEach(c => frameEl.classList.remove(c));
	frameEl.classList.add(`t-${choice}`);
	// clean transient enter/exit classes from layers
	incoming.classList.remove('enter', 'exit');
	outgoing.classList.remove('enter', 'exit');

	incoming.classList.add('enter');
	outgoing.classList.add('exit');

	// set transition duration variable to align with FADE_MS
	incoming.style.setProperty('--trans-dur', `${FADE_MS}ms`);
	outgoing.style.setProperty('--trans-dur', `${FADE_MS}ms`);

	setLayerImage(incoming, nextUrl);
	// Ensure incoming starts hidden/positioned then becomes active for enter animation
	incoming.classList.remove('is-active');

	requestAnimationFrame(() => {
		incoming.classList.add('is-active');
		outgoing.classList.remove('is-active');
	});

	// clean up transient classes after transition completes
	window.setTimeout(() => {
		incoming.classList.remove('enter');
		outgoing.classList.remove('exit');
		incoming.classList.remove(`t-${choice}`);
		outgoing.classList.remove(`t-${choice}`);
	}, FADE_MS + 60);

	frame.setAttribute('aria-label', `Slide ${index + 1}`);
	updateCounter();
	isAActive = !isAActive;
}

function scheduleNext(ms) {
	if (timeoutId) window.clearTimeout(timeoutId);
	remainingMs = ms;
	nextDueAt = performance.now() + ms;
	// Switch slides slightly before the end so fade doesn't feel "late".
	const switchAt = Math.max(0, ms - FADE_MS);
	timeoutId = window.setTimeout(() => {
		advance();
		// Always schedule next slide for continuous looping
		scheduleNext(SLIDE_MS);
	}, switchAt);
}

function start() {
	if (!slides.length) return;
	if (isPlaying && timeoutId) return;
	isPlaying = true;
	toggle.setAttribute('aria-pressed', 'true');
	toggleText.textContent = 'Pause';
	toggle.removeAttribute('data-state');
	setPlayState('running');
	scheduleNext(remainingMs);

	// Play background audio when slideshow starts
	if (bgAudio) {
		bgAudio.play().catch(() => {
			// ignore autoplay failures
		});
	}
}

function stop() {
	isPlaying = false;
	toggle.setAttribute('aria-pressed', 'false');
	toggleText.textContent = 'Play';
	toggle.setAttribute('data-state', 'paused');
	setPlayState('paused');

	if (timeoutId) {
		window.clearTimeout(timeoutId);
		timeoutId = null;
	}
	remainingMs = Math.max(0, nextDueAt - performance.now());

	// Pause background audio when slideshow pauses/stops
	if (bgAudio) {
		try { bgAudio.pause(); } catch (e) { /* ignore */ }
	}
}

function togglePlay() {
	if (isPlaying) stop();
	else start();
}

toggle.addEventListener('click', togglePlay);

function openCoverAndStart() {
	if (cover) cover.classList.add('is-hidden');
	// Start audio on a user gesture (required by most browsers).
	if (bgAudio) {
		bgAudio.currentTime = 0;
		bgAudio.play().catch(() => {
			// Autoplay might still be blocked; user can press play/pause button afterward.
		});
	}
	// start the looping slideshow
	start();
}

if (openBtn) {
	openBtn.addEventListener('click', openCoverAndStart);
}

preload(slides);
showInitial();
// Do not auto-start until user opens the cover.
stop();
