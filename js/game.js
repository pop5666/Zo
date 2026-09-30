// js/game.js - เวอร์ชันแก้ไขการแสดงรูปพรีวิว และระบบกดลงสี/ลากระบายสี

const PALETTES = [
    ["#ffffff", "#000000", "#ff4d4d", "#4da6ff", "#ffcc00"],
    ["#ffffff", "#000000", "#2ed573", "#ffa502", "#ff4757"],
    ["#ffffff", "#000000", "#70a1ff", "#5352ed", "#ff6b81"]
];

const LEVEL_NAMES = [
    "สุนัขจิ้งจอก", "แมวเหมียว", "หมีแพนด้า", "เพนกวิน", "กระต่ายน้อย",
    "ช้างน้อย", "นกฮูกตาโต", "สุนัขชิบะ", "หมีบราวน์", "กบน้อย"
];

let levels = [];
for (let i = 1; i <= 50; i++) {
    const size = 16;
    const matrix = [];
    const palette = PALETTES[i % PALETTES.length];
    
    for (let r = 0; r < size; r++) {
        const row = [];
        for (let c = 0; c < size; c++) {
            const dist = Math.abs(r - 8) + Math.abs(c - 8);
            if (dist < (i % 5) + 4) {
                row.push(((r + c + i) % (palette.length - 1)) + 1);
            } else {
                row.push(0);
            }
        }
        matrix.push(row);
    }

    const nameIndex = (i - 1) % LEVEL_NAMES.length;
    levels.push({
        id: i,
        name: `${LEVEL_NAMES[nameIndex]} (${i})`,
        size: size,
        palette: palette,
        matrix: matrix,
        totalCells: matrix.flat().filter(x => x > 0).length
    });
}

let currentLevel = null;
let selectedColor = 1;
let userProgress = {};
let scale = 1;
let panX = 0, panY = 0;
let isDragging = false;
let isPainting = false;
let startX = 0, startY = 0;

const canvas = document.getElementById('game-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const container = document.getElementById('canvas-container');

function init() {
    renderLevels();
    setupCanvasEvents();
}

// แก้ไขการสร้าง Element การ์ดด่าน เพื่อให้รูปภาพพรีวิวขึ้นสมบูรณ์
function renderLevels() {
    const grid = document.getElementById('levels-grid');
    if (!grid) return;
    grid.innerHTML = '';

    levels.forEach(lvl => {
        const card = document.createElement('div');
        card.className = 'level-card';
        card.onclick = () => startLevel(lvl);

        const thumb = document.createElement('canvas');
        thumb.className = 'level-thumb';
        thumb.width = lvl.size * 4;
        thumb.height = lvl.size * 4;
        const tCtx = thumb.getContext('2d');
        tCtx.imageSmoothingEnabled = false;

        for (let r = 0; r < lvl.size; r++) {
            for (let c = 0; c < lvl.size; c++) {
                const val = lvl.matrix[r][c];
                if (val > 0) {
                    tCtx.fillStyle = lvl.palette[val];
                    tCtx.fillRect(c * 4, r * 4, 4, 4);
                }
            }
        }

        const nameEl = document.createElement('div');
        nameEl.className = 'level-name';
        nameEl.innerText = lvl.name;

        const metaEl = document.createElement('div');
        metaEl.className = 'level-meta';
        metaEl.innerText = `${lvl.totalCells} ช่อง`;

        card.appendChild(thumb);
        card.appendChild(nameEl);
        card.appendChild(metaEl);
        grid.appendChild(card);
    });
}

function sortLevels(type) {
    if (type === 'easy') {
        levels.sort((a, b) => a.totalCells - b.totalCells);
    } else {
        levels.sort((a, b) => b.totalCells - a.totalCells);
    }
    renderLevels();
}

function startLevel(lvl) {
    currentLevel = lvl;
    userProgress = {};
    selectedColor = 1;
    
    document.getElementById('screen-main').classList.remove('active');
    document.getElementById('screen-game').classList.add('active');
    document.getElementById('game-title').innerText = lvl.name;

    resetView();
    renderPalette();
    draw();
}

function resetView() {
    if (!container || !currentLevel) return;
    scale = Math.min(container.clientWidth, container.clientHeight) / (currentLevel.size * 24);
    panX = (container.clientWidth - currentLevel.size * 20 * scale) / 2;
    panY = (container.clientHeight - currentLevel.size * 20 * scale) / 2;
}

function renderPalette() {
    const bar = document.getElementById('palette-bar');
    if (!bar || !currentLevel) return;
    bar.innerHTML = '';

    currentLevel.palette.forEach((color, idx) => {
        if (idx === 0) return;

        const item = document.createElement('div');
        item.className = `color-item ${selectedColor === idx ? 'selected' : ''}`;
        item.style.backgroundColor = color;
        item.innerText = idx;
        item.onclick = () => {
            selectedColor = idx;
            renderPalette();
        };

        bar.appendChild(item);
    });
}

function draw() {
    if (!currentLevel || !ctx) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(scale, scale);

    const cellSize = 20;

    for (let r = 0; r < currentLevel.size; r++) {
        for (let c = 0; c < currentLevel.size; c++) {
            const targetVal = currentLevel.matrix[r][c];
            const key = `${r}_${c}`;
            const paintedVal = userProgress[key];

            if (targetVal === 0) continue;

            if (paintedVal) {
                ctx.fillStyle = currentLevel.palette[paintedVal];
                ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
            } else {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
                ctx.strokeStyle = '#cbd5e1';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);

                ctx.fillStyle = '#64748b';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(targetVal, c * cellSize + cellSize / 2, r * cellSize + cellSize / 2);
            }
        }
    }

    ctx.restore();
}

// เพิ่มระบบคำนวณพิกัดการลงสี (Touch & Click Support)
function handlePaint(clientX, clientY) {
    if (!currentLevel) return;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - panX) / scale;
    const y = (clientY - rect.top - panY) / scale;

    const cellSize = 20;
    const c = Math.floor(x / cellSize);
    const r = Math.floor(y / cellSize);

    if (r >= 0 && r < currentLevel.size && c >= 0 && c < currentLevel.size) {
        const targetVal = currentLevel.matrix[r][c];
        if (targetVal === selectedColor) {
            userProgress[`${r}_${c}`] = selectedColor;
            draw();
        }
    }
}

function setupCanvasEvents() {
    if (!container) return;

    // Mouse Events
    container.addEventListener('mousedown', e => {
        isDragging = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
        handlePaint(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', e => {
        if (isDragging) {
            panX = e.clientX - startX;
            panY = e.clientY - startY;
            draw();
        }
    });

    window.addEventListener('mouseup', () => isDragging = false);

    // Touch Events สำหรับมือถือ/แท็บเล็ต
    container.addEventListener('touchstart', e => {
        if (e.touches.length === 1) {
            isDragging = true;
            startX = e.touches[0].clientX - panX;
            startY = e.touches[0].clientY - panY;
            handlePaint(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: false });

    container.addEventListener('touchmove', e => {
        if (isDragging && e.touches.length === 1) {
            panX = e.touches[0].clientX - startX;
            panY = e.touches[0].clientY - startY;
            handlePaint(e.touches[0].clientX, e.touches[0].clientY);
            draw();
        }
    }, { passive: false });

    container.addEventListener('touchend', () => isDragging = false);

    container.addEventListener('wheel', e => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        scale *= zoomFactor;
        draw();
    }, { passive: false });
}

function exitGame() {
    document.getElementById('screen-game').classList.remove('active');
    document.getElementById('screen-main').classList.add('active');
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');

    document.getElementById('view-levels').style.display = tab === 'levels' ? 'flex' : 'none';
    document.getElementById('view-freedraw').style.display = tab === 'freedraw' ? 'flex' : 'none';
    document.getElementById('view-gallery').style.display = tab === 'gallery' ? 'grid' : 'none';
    document.getElementById('view-stats').style.display = tab === 'stats' ? 'block' : 'none';
}

function showModal(id) { document.getElementById(id).classList.add('active'); }
function hideModal(id) { document.getElementById(id).classList.remove('active'); }
function toggleAudio() { alert('เปิด/ปิด เสียงผ่อนคลาย'); }

window.onload = init;
