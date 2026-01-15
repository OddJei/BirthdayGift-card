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

const TOTAL_SHOW_MS = 120_000; // 2 minutes total
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

function setLayerImage(layer, url) {
	layer.style.backgroundImage = `url("${url}")`;
	// Force a new animation for the Ken Burns effect.
	layer.style.animationDuration = `${SLIDE_MS}ms`;
	layer.style.animationName = 'none';
	// Force reflow so animation restarts reliably.
	void layer.offsetHeight;
	layer.style.animationName = 'kenburns';
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

	setLayerImage(incoming, nextUrl);
	incoming.classList.remove('is-active');
	// Ensure opacity transition triggers.
	requestAnimationFrame(() => {
		incoming.classList.add('is-active');
		outgoing.classList.remove('is-active');
	});

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
		if (index < slides.length - 1) {
			scheduleNext(SLIDE_MS);
		} else {
			// We've just advanced to the last slide — let it play fully, then stop.
			if (timeoutId) window.clearTimeout(timeoutId);
			timeoutId = window.setTimeout(() => {
				stop();
			}, SLIDE_MS);
		}
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
	start();
}

if (openBtn) {
	openBtn.addEventListener('click', openCoverAndStart);
}

preload(slides);
showInitial();
// Do not auto-start until user opens the cover.
stop();
