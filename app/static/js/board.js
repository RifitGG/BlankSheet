let boardCode = null;
let socket = null;
let canvas = null;
let ctx = null;
let isDrawing = false;
let currentTool = 'pen';
let currentColor = '#FFD700';
let brushSize = 3;
let lastX = 0;
let lastY = 0;
let userToken = null;
let textPosition = null;
let backgroundCanvas = null;
let backgroundCtx = null;
let history = [];
let historyStep = -1;
const MAX_HISTORY = 50;
let objects = [];
let selectedObject = null;
let isDragging = false;
let isResizing = false;
let dragStartX = 0;
let dragStartY = 0;
let resizeHandle = null;
let autoSaveInterval = null;
let lastSaveTime = Date.now();
let hasUnsavedChanges = false;
let resizeTimeout = null;
let canvasSnapshot = null;
function initBoard(code) {
    boardCode = code;
    init();
}
async function init() {
    userToken = getCookie('token');
    console.log('=== Board Init Debug ===');
    console.log('All cookies:', document.cookie);
    console.log('Token from cookie:', userToken);
    if (!userToken) {
        console.error('No token found in cookies');
        const authCheck = await apiRequest('/api/auth/verify');
        if (authCheck.success) {
            showNotification('⚠️ Пожалуйста, войдите снова для доступа к доске', 'warning');
            setTimeout(() => {
                fetch('/api/auth/logout', { method: 'POST' })
                    .then(() => window.location.href = '/')
                    .catch(() => window.location.href = '/');
            }, 2000);
            return;
        }
        showNotification('Необходима авторизация', 'error');
        setTimeout(() => {
            window.location.href = '/';
        }, 1500);
        return;
    }
    const authResult = await apiRequest('/api/auth/verify');
    console.log('Auth verification result:', authResult);
    if (!authResult.success) {
        console.error('Auth verification failed:', authResult);
        showNotification('Необходима авторизация', 'error');
        setTimeout(() => {
            window.location.href = '/';
        }, 1500);
        return;
    }
    canvas = document.getElementById('whiteboard');
    ctx = canvas.getContext('2d');
    backgroundCanvas = document.createElement('canvas');
    backgroundCtx = backgroundCanvas.getContext('2d');
    resizeCanvas();
    setupSocket();
    setupEventListeners();
    await loadBoardInfo();
    await loadBoardState();
    saveState();
    startAutoSave();
}
function startAutoSave() {
    console.log('⏰ [AUTO-SAVE] Auto-save started: every 30 seconds');
    console.log('⏰ [AUTO-SAVE] Next save in 30 seconds...');
    
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }
    
    autoSaveInterval = setInterval(() => {
        console.log('⏰ [AUTO-SAVE] Timer triggered');
        console.log('⏰ [AUTO-SAVE] hasUnsavedChanges:', hasUnsavedChanges);
        console.log('⏰ [AUTO-SAVE] boardCode:', boardCode);
        console.log('⏰ [AUTO-SAVE] userToken:', userToken ? 'Present' : 'Missing');
        
        if (hasUnsavedChanges) {
            console.log('⏰ [AUTO-SAVE] Changes detected, triggering auto-save...');
            saveCanvasSnapshot();
        } else {
            console.log('⏰ [AUTO-SAVE] No changes to save, skipping...');
        }
    }, 30000);
    
    console.log('✅ [AUTO-SAVE] Interval set successfully');
}
async function loadBoardState() {
    try {
        console.log('Loading board state from database...');
        const response = await fetch(`/api/board/${boardCode}/state`, {
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        });
        const result = await response.json();
        if (result.success && result.state) {
            console.log('Board state found, loading...');
            const state = result.state;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            backgroundCtx.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
            console.log('🧹 Canvases cleared before loading');
            if (state.backgroundSnapshot) {
                const bgImg = new Image();
                bgImg.onload = () => {
                    backgroundCtx.drawImage(bgImg, 0, 0);
                    console.log('✅ Background layer loaded (pen drawings only)');
                    if (state.objects && Array.isArray(state.objects)) {
                        objects = state.objects;
                        redrawCanvas();
                        console.log(`✅ Loaded ${objects.length} objects`);
                    }
                };
                bgImg.src = state.backgroundSnapshot;
            } else if (state.snapshot) {
                console.log('⚠️ Legacy snapshot detected (no separate background)');
                console.log('⚠️ Not loading to background to avoid duplicates');
                if (state.objects && Array.isArray(state.objects)) {
                    objects = state.objects;
                    redrawCanvas();
                    console.log(`✅ Loaded ${objects.length} objects (legacy mode)`);
                }
            } else {
                if (state.objects && Array.isArray(state.objects)) {
                    objects = state.objects;
                    redrawCanvas();
                    console.log(`✅ Loaded ${objects.length} objects`);
                }
            }
            showNotification('✅ Доска загружена', 'success');
        } else {
            console.log('No previous state found, starting with clean board');
        }
    } catch (error) {
        console.error('Error loading board state:', error);
    }
}
function saveCanvasSnapshot() {
    updateSaveIndicator('saving');
    
    const dataUrl = canvas.toDataURL('image/png');
    const backgroundDataUrl = backgroundCanvas.toDataURL('image/png');
    const snapshotData = {
        snapshot: dataUrl,
        backgroundSnapshot: backgroundDataUrl, 
        timestamp: Date.now(),
        objects: objects
    };
    console.log('🔄 [AUTO-SAVE] Saving canvas snapshot...');
    console.log('🔄 [AUTO-SAVE] Board code:', boardCode);
    console.log('🔄 [AUTO-SAVE] Token:', userToken ? 'Present' : 'Missing');
    console.log('🔄 [AUTO-SAVE] Objects count:', objects.length);
    console.log('🔄 [AUTO-SAVE] Snapshot size:', Math.round(dataUrl.length / 1024), 'KB');
    console.log('🔄 [AUTO-SAVE] Background size:', Math.round(backgroundDataUrl.length / 1024), 'KB');
    socket.emit('save_snapshot', {
        board_code: boardCode,
        token: userToken,
        data: snapshotData
    }, (response) => {
        if (response && response.success) {
            console.log('✅ [AUTO-SAVE] Snapshot saved successfully!');
            updateSaveIndicator('saved');
        } else {
            console.error('❌ [AUTO-SAVE] Failed to save:', response);
            updateSaveIndicator('error');
        }
    });
    hasUnsavedChanges = false;
    lastSaveTime = Date.now();
}
function manualSave() {
    console.log('💾 [MANUAL-SAVE] Manual save triggered by owner');
    const dataUrl = canvas.toDataURL('image/png');
    const backgroundDataUrl = backgroundCanvas.toDataURL('image/png');
    const snapshotData = {
        snapshot: dataUrl,
        backgroundSnapshot: backgroundDataUrl,
        timestamp: Date.now(),
        objects: objects
    };
    console.log('💾 [MANUAL-SAVE] Board code:', boardCode);
    console.log('💾 [MANUAL-SAVE] Token:', userToken ? 'Present' : 'Missing');
    console.log('💾 [MANUAL-SAVE] Objects count:', objects.length);
    console.log('💾 [MANUAL-SAVE] Snapshot size:', Math.round(dataUrl.length / 1024), 'KB');
    console.log('💾 [MANUAL-SAVE] Background size:', Math.round(backgroundDataUrl.length / 1024), 'KB');
    socket.emit('save_snapshot', {
        board_code: boardCode,
        token: userToken,
        data: snapshotData
    }, (response) => {
        if (response && response.success) {
            console.log('✅ [MANUAL-SAVE] Snapshot saved successfully!');
            showNotification('💾 Доска успешно сохранена!', 'success');
        } else {
            console.error('❌ [MANUAL-SAVE] Failed to save:', response);
            showNotification('❌ Ошибка сохранения', 'error');
        }
    });
    hasUnsavedChanges = false;
    lastSaveTime = Date.now();
}
function markAsChanged() {
    hasUnsavedChanges = true;
}
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}
function resizeCanvas() {
    console.log('🔄 Resizing canvas, preserving content...');
    const container = canvas.parentElement;
    const newWidth = container.clientWidth;
    const newHeight = container.clientHeight;
    if (newWidth === 0 || newHeight === 0) {
        console.log('💤 Window minimized, saving snapshot...');
        if (canvas.width > 0 && canvas.height > 0) {
            canvasSnapshot = canvas.toDataURL('image/png');
            console.log('💾 Canvas snapshot saved for restore');
        }
        return;
    }
    if (canvas.width === newWidth && canvas.height === newHeight) {
        console.log('⏭️ Canvas size unchanged, skipping...');
        return;
    }
    const oldWidth = canvas.width;
    const oldHeight = canvas.height;
    console.log(`📐 Canvas resized: ${oldWidth}x${oldHeight} → ${newWidth}x${newHeight}`);
    if (canvasSnapshot && canvas.width === 0) {
        console.log('🔄 Restoring from saved snapshot after minimize...');
        canvas.width = newWidth;
        canvas.height = newHeight;
        backgroundCanvas.width = newWidth;
        backgroundCanvas.height = newHeight;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const img = new Image();
        img.onload = function() {
            ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, newWidth, newHeight);
            console.log('✅ Canvas restored and scaled from snapshot after minimize');
            canvasSnapshot = null; 
        };
        img.src = canvasSnapshot;
        return;
    }
    const tempBg = document.createElement('canvas');
    tempBg.width = oldWidth;
    tempBg.height = oldHeight;
    const tempBgCtx = tempBg.getContext('2d');
    tempBgCtx.drawImage(backgroundCanvas, 0, 0);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = oldWidth;
    tempCanvas.height = oldHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);
    console.log('💾 Canvas content saved to temporary canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;
    backgroundCanvas.width = newWidth;
    backgroundCanvas.height = newHeight;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    backgroundCtx.lineCap = 'round';
    backgroundCtx.lineJoin = 'round';
    const scaleX = newWidth / oldWidth;
    const scaleY = newHeight / oldHeight;
    console.log(`🔢 Scale factors: X=${scaleX.toFixed(2)}, Y=${scaleY.toFixed(2)}`);
    backgroundCtx.drawImage(tempBg, 0, 0, oldWidth, oldHeight, 0, 0, newWidth, newHeight);
    ctx.drawImage(tempCanvas, 0, 0, oldWidth, oldHeight, 0, 0, newWidth, newHeight);
    canvasSnapshot = canvas.toDataURL('image/png');
    console.log('✅ Canvas content fully restored and scaled after resize');
}
function setupSocket() {
    socket = io();
    console.log('🔌 [SOCKET] Initializing Socket.IO connection...');
    
    socket.on('connect', () => {
        console.log('✅ [SOCKET] Connected to server, socket.id:', socket.id);
        socket.emit('join_board', {
            board_code: boardCode,
            token: userToken
        });
        console.log('📤 [SOCKET] Sent join_board event for:', boardCode);
    });
    socket.on('board_joined', (data) => {
        console.log('✅ [SOCKET] Board joined successfully:', data);
        showNotification('✅ Подключено к доске', 'success');
        if (data.actions && data.actions.length > 0) {
            loadBoardActions(data.actions);
        }
    });
    socket.on('user_joined', (data) => {
        console.log('👋 [SOCKET] User joined:', data);
        showNotification(`👋 ${data.username} присоединился`, 'info');
        updateUsersList();
    });
    socket.on('user_left', (data) => {
        console.log('👋 [SOCKET] User left:', data);
        showNotification(`👋 Пользователь вышел`, 'info');
        updateUsersList();
    });
    socket.on('draw', (data) => {
        console.log('✏️ [SOCKET] Received draw event:', data);
        drawFromData(data.data);
    });
    socket.on('clear', (data) => {
        console.log('🗑️ [SOCKET] Received clear event');
        clearCanvasLocal();
    });
    socket.on('add_text', (data) => {
        console.log('📝 [SOCKET] Received add_text event:', data);
        addTextFromData(data.data);
    });
    socket.on('add_image', (data) => {
        console.log('🖼️ [SOCKET] Received add_image event');
        addImageFromData(data.data);
    });
    socket.on('draw_shape', (data) => {
        console.log('🔷 [SOCKET] Received draw_shape event:', data);
        drawShapeFromData(data.data);
    });
    socket.on('move_object', (data) => {
        console.log('↔️ [SOCKET] Received move_object event:', data);
        const obj = objects.find(o => o.id === data.data.objectId);
        if (obj) {
            obj.x = data.data.x;
            obj.y = data.data.y;
            redrawCanvas();
        }
    });
    socket.on('resize_object', (data) => {
        console.log('↕️ [SOCKET] Received resize_object event:', data);
        const obj = objects.find(o => o.id === data.data.objectId);
        if (obj) {
            obj.width = data.data.width;
            obj.height = data.data.height;
            redrawCanvas();
        }
    });
    socket.on('error', (data) => {
        console.error('❌ [SOCKET] Error:', data);
        showNotification(data.message, 'error');
    });
    socket.on('disconnect', () => {
        console.warn('⚠️ [SOCKET] Disconnected from server');
        showNotification('❌ Отключено от доски', 'error');
    });
}
function setupEventListeners() {
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', stopDrawing);
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(resizeCanvas, 250);
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            console.log('👁️ Window became visible, checking canvas...');
            setTimeout(() => {
                const container = canvas.parentElement;
                if (container.clientWidth > 0 && container.clientHeight > 0) {
                    console.log('🔄 Redrawing canvas after visibility change...');
                    resizeCanvas();
                }
            }, 100);
        }
    });
    window.addEventListener('focus', () => {
        console.log('🎯 Window focused, checking canvas...');
        setTimeout(() => {
            const container = canvas.parentElement;
            if (container.clientWidth > 0 && container.clientHeight > 0) {
                if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
                    console.log('🔄 Redrawing canvas after focus...');
                    resizeCanvas();
                }
            }
        }, 100);
    });
    document.addEventListener('keydown', handleKeyboard);
}
function handleKeyboard(e) {
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
            e.preventDefault();
            redo();
        }
    }
}
function saveState() {
    if (historyStep < history.length - 1) {
        history = history.slice(0, historyStep + 1);
    }
    if (history.length >= MAX_HISTORY) {
        history.shift();
        historyStep--;
    }
    history.push(canvas.toDataURL());
    historyStep++;
    updateHistoryButtons();
}
function updateHistoryButtons() {
    document.getElementById('undoBtn').disabled = historyStep <= 0;
    document.getElementById('redoBtn').disabled = historyStep >= history.length - 1;
}
function undo() {
    if (historyStep > 0) {
        historyStep--;
        restoreState(history[historyStep]);
        updateHistoryButtons();
    }
}
function redo() {
    if (historyStep < history.length - 1) {
        historyStep++;
        restoreState(history[historyStep]);
        updateHistoryButtons();
    }
}
function restoreState(dataUrl) {
    const img = new Image();
    img.onload = function() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
}
function startDrawing(e) {
    if (currentTool === 'select') {
        const pos = getMousePos(e);
        if (selectedObject) {
            const handle = getResizeHandle(pos.x, pos.y);
            if (handle) {
                isResizing = true;
                resizeHandle = handle;
                dragStartX = pos.x;
                dragStartY = pos.y;
                return;
            }
        }
        if (selectedObject && isPointInObject(pos.x, pos.y, selectedObject)) {
            isDragging = true;
            dragStartX = pos.x - selectedObject.x;
            dragStartY = pos.y - selectedObject.y;
            return;
        }
        selectedObject = null;
        for (let i = objects.length - 1; i >= 0; i--) {
            if (isPointInObject(pos.x, pos.y, objects[i])) {
                selectedObject = objects[i];
                isDragging = true;
                dragStartX = pos.x - selectedObject.x;
                dragStartY = pos.y - selectedObject.y;
                redrawCanvas();
                return;
            }
        }
        selectedObject = null;
        redrawCanvas();
        return;
    }
    if (currentTool === 'text') {
        textPosition = getMousePos(e);
        showTextModal();
        return;
    }
    if (currentTool === 'image') {
        document.getElementById('imageInput').click();
        return;
    }
    isDrawing = true;
    const pos = getMousePos(e);
    lastX = pos.x;
    lastY = pos.y;
    if (currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle') {
        saveState();
    }
}
function draw(e) {
    const pos = getMousePos(e);
    if (currentTool === 'select') {
        if (isDragging && selectedObject) {
            selectedObject.x = pos.x - dragStartX;
            selectedObject.y = pos.y - dragStartY;
            redrawCanvas();
            markAsChanged(); 
            return;
        }
        if (isResizing && selectedObject) {
            resizeObject(selectedObject, pos.x, pos.y, resizeHandle);
            redrawCanvas();
            markAsChanged();
            return;
        }
        return;
    }
    if (!isDrawing) return;
    if (currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle') {
        if (historyStep > 0) {
            const img = new Image();
            img.onload = function() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                drawShapePreview(currentTool, lastX, lastY, pos.x, pos.y, currentColor, brushSize);
            };
            img.src = history[historyStep - 1];
        } else {
            drawShapePreview(currentTool, lastX, lastY, pos.x, pos.y, currentColor, brushSize);
        }
        return;
    }
    const drawData = {
        tool: currentTool,
        x1: lastX,
        y1: lastY,
        x2: pos.x,
        y2: pos.y,
        color: currentColor,
        size: brushSize
    };
    drawLine(drawData);
    markAsChanged();
    
    console.log('📤 [DRAW] Emitting draw event:', {
        board_code: boardCode,
        hasSocket: !!socket,
        socketConnected: socket?.connected
    });
    
    socket.emit('draw', {
        board_code: boardCode,
        token: userToken,
        data: drawData
    });
    lastX = pos.x;
    lastY = pos.y;
}
function stopDrawing(e) {
    if (currentTool === 'select') {
        if (isDragging && selectedObject) {
            socket.emit('move_object', {
                board_code: boardCode,
                token: userToken,
                data: {
                    objectId: selectedObject.id,
                    x: selectedObject.x,
                    y: selectedObject.y
                }
            });
            saveState();
            markAsChanged();
        }
        if (isResizing && selectedObject) {
            socket.emit('resize_object', {
                board_code: boardCode,
                token: userToken,
                data: {
                    objectId: selectedObject.id,
                    width: selectedObject.width,
                    height: selectedObject.height
                }
            });
            saveState();
            markAsChanged();
        }
        isDragging = false;
        isResizing = false;
        resizeHandle = null;
        return;
    }
    if (isDrawing) {
        if (currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle') {
            const pos = e ? getMousePos(e) : { x: lastX, y: lastY };
            const shapeData = {
                id: Date.now() + Math.random(),
                type: 'shape',
                tool: currentTool,
                x1: lastX,
                y1: lastY,
                x2: pos.x,
                y2: pos.y,
                color: currentColor,
                size: brushSize
            };
            objects.push(shapeData);
            drawShape(shapeData);
            socket.emit('draw_shape', {
                board_code: boardCode,
                token: userToken,
                data: shapeData
            });
            markAsChanged();
        }
        isDrawing = false;
        saveState();
    }
}
function drawShapePreview(tool, x1, y1, x2, y2, color, size) {
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.beginPath();
    switch(tool) {
        case 'line':
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            break;
        case 'rectangle':
            ctx.rect(x1, y1, x2 - x1, y2 - y1);
            break;
        case 'circle':
            const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            ctx.arc(x1, y1, radius, 0, 2 * Math.PI);
            break;
    }
    ctx.stroke();
}
function drawShape(data) {
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.size;
    ctx.beginPath();
    switch(data.tool) {
        case 'line':
            ctx.moveTo(data.x1, data.y1);
            ctx.lineTo(data.x2, data.y2);
            break;
        case 'rectangle':
            ctx.rect(data.x1, data.y1, data.x2 - data.x1, data.y2 - data.y1);
            break;
        case 'circle':
            const radius = Math.sqrt(Math.pow(data.x2 - data.x1, 2) + Math.pow(data.y2 - data.y1, 2));
            ctx.arc(data.x1, data.y1, radius, 0, 2 * Math.PI);
            break;
    }
    ctx.stroke();
}
function drawShapeFromData(data) {
    if (!data.id) {
        data.id = Date.now() + Math.random();
        data.type = 'shape';
    }
    if (!objects.find(obj => obj.id === data.id)) {
        objects.push(data);
    }
    drawShape(data);
}
function drawLine(data) {
    ctx.beginPath();
    ctx.moveTo(data.x1, data.y1);
    ctx.lineTo(data.x2, data.y2);
    if (data.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = data.size * 2;
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = data.color;
        ctx.lineWidth = data.size;
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    backgroundCtx.beginPath();
    backgroundCtx.moveTo(data.x1, data.y1);
    backgroundCtx.lineTo(data.x2, data.y2);
    if (data.tool === 'eraser') {
        backgroundCtx.globalCompositeOperation = 'destination-out';
        backgroundCtx.lineWidth = data.size * 2;
    } else {
        backgroundCtx.globalCompositeOperation = 'source-over';
        backgroundCtx.strokeStyle = data.color;
        backgroundCtx.lineWidth = data.size;
    }
    backgroundCtx.stroke();
    backgroundCtx.globalCompositeOperation = 'source-over';
}
function drawFromData(data) {
    drawLine(data);
}
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}
function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}
function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}
function selectTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn-modern').forEach(btn => {
        btn.classList.remove('active');
    });
    const selectedBtn = document.querySelector(`[data-tool="${tool}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }
}
function changeColor(color) {
    currentColor = color;
    document.getElementById('colorPicker').value = color;
}
function changeBrushSize(size) {
    brushSize = parseInt(size);
    document.getElementById('brushSizeValue').textContent = size;
}
function clearCanvas() {
    if (!confirm('Очистить всю доску? Это действие нельзя отменить.')) return;
    clearCanvasLocal();
    objects = [];
    selectedObject = null;
    saveState();
    markAsChanged();
    socket.emit('clear', {
        board_code: boardCode,
        token: userToken
    });
}
function clearCanvasLocal() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    backgroundCtx.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
    objects = [];
    selectedObject = null;
}
function downloadBoard() {
    console.log('💾 [DOWNLOAD] Downloading board...');
    const link = document.createElement('a');
    link.download = `whiteboard_${boardCode}_${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showNotification('💾 Доска сохранена!', 'success');
    console.log('✅ [DOWNLOAD] Download triggered');
}
function showTextModal() {
    document.getElementById('textModal').style.display = 'block';
}
function closeTextModal() {
    document.getElementById('textModal').style.display = 'none';
    document.getElementById('textContent').value = '';
    textPosition = null;
}
function handleAddText(event) {
    event.preventDefault();
    const text = document.getElementById('textContent').value;
    const fontSize = parseInt(document.getElementById('fontSize').value);
    if (!textPosition) {
        textPosition = { x: canvas.width / 2, y: canvas.height / 2 };
    }
    const textData = {
        id: Date.now() + Math.random(),
        type: 'text',
        text: text,
        x: textPosition.x,
        y: textPosition.y,
        color: currentColor,
        fontSize: fontSize
    };
    objects.push(textData);
    addTextToCanvas(textData);
    socket.emit('add_text', {
        board_code: boardCode,
        token: userToken,
        data: textData
    });
    closeTextModal();
    saveState();
    markAsChanged();
}
function addTextToCanvas(data) {
    ctx.font = `${data.fontSize}px Arial`;
    ctx.fillStyle = data.color;
    ctx.fillText(data.text, data.x, data.y);
}
function addTextFromData(data) {
    if (!data.id) {
        data.id = Date.now() + Math.random();
        data.type = 'text';
    }
    if (!objects.find(obj => obj.id === data.id)) {
        objects.push(data);
    }
    addTextToCanvas(data);
}
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const maxWidth = canvas.width * 0.3;
            const maxHeight = canvas.height * 0.3;
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
            }
            const x = (canvas.width - width) / 2;
            const y = (canvas.height - height) / 2;
            const imageData = {
                id: Date.now() + Math.random(),
                type: 'image',
                dataUrl: e.target.result,
                x: x,
                y: y,
                width: width,
                height: height
            };
            objects.push(imageData);
            addImageToCanvas(imageData);
            socket.emit('add_image', {
                board_code: boardCode,
                token: userToken,
                data: imageData
            });
            saveState();
            markAsChanged();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}
function addImageToCanvas(data) {
    const img = new Image();
    img.onload = function() {
        ctx.drawImage(img, data.x, data.y, data.width, data.height);
    };
    img.src = data.dataUrl;
}
function addImageFromData(data) {
    if (!data.id) {
        data.id = Date.now() + Math.random();
        data.type = 'image';
    }
    if (!objects.find(obj => obj.id === data.id)) {
        objects.push(data);
    }
    addImageToCanvas(data);
}
async function loadBoardInfo() {
    const result = await apiRequest(`/api/board/${boardCode}`);
    if (result.success) {
        const badge = document.getElementById('boardCodeBadge');
        if (badge) {
            badge.textContent = result.board.code;
        }
        
        updateUsersList(result.board.participants);
        
        
        const authResult = await apiRequest('/api/auth/verify');
        if (authResult.success && result.board.owner_id === authResult.user.id) {
            console.log('✅ User is board owner, manual save available');
        
        }
    } else {
        showNotification('❌ Не удалось загрузить информацию о доске', 'error');
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 2000);
    }
}
async function updateUsersList(participants = null) {
    if (!participants) {
        const result = await apiRequest(`/api/board/${boardCode}`);
        if (result.success) {
            participants = result.board.participants;
        } else {
            return;
        }
    }
    const onlineCount = participants.filter(p => p.is_online).length;
    document.getElementById('onlineCount').textContent = onlineCount;
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = participants.map(p => `
        <div class="user-item ${p.is_online ? 'online' : 'offline'}">
            <span class="user-status"></span>
            <span class="user-name">${p.username}</span>
        </div>
    `).join('');
}
function loadBoardActions(actions) {
    actions.reverse().forEach(action => {
        const data = JSON.parse(action.action_data);
        switch (action.action_type) {
            case 'draw':
                drawFromData(data);
                break;
            case 'text':
                addTextFromData(data);
                break;
            case 'image':
                addImageFromData(data);
                break;
            case 'shape':
                drawShapeFromData(data);
                break;
            case 'clear':
                clearCanvasLocal();
                break;
        }
    });
}
function isPointInObject(x, y, obj) {
    if (obj.type === 'text') {
        ctx.font = `${obj.fontSize}px Arial`;
        const metrics = ctx.measureText(obj.text);
        return x >= obj.x && x <= obj.x + metrics.width &&
               y >= obj.y - obj.fontSize && y <= obj.y;
    }
    if (obj.type === 'image') {
        return x >= obj.x && x <= obj.x + obj.width &&
               y >= obj.y && y <= obj.y + obj.height;
    }
    if (obj.type === 'rectangle') {
        const x1 = Math.min(obj.x1, obj.x2);
        const y1 = Math.min(obj.y1, obj.y2);
        const x2 = Math.max(obj.x1, obj.x2);
        const y2 = Math.max(obj.y1, obj.y2);
        return x >= x1 && x <= x2 && y >= y1 && y <= y2;
    }
    if (obj.type === 'circle') {
        const centerX = (obj.x1 + obj.x2) / 2;
        const centerY = (obj.y1 + obj.y2) / 2;
        const radius = Math.sqrt(Math.pow(obj.x2 - obj.x1, 2) + Math.pow(obj.y2 - obj.y1, 2)) / 2;
        const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        return distance <= radius;
    }
    return false;
}
function getResizeHandle(x, y) {
    if (!selectedObject) return null;
    const handleSize = 8;
    let handles = [];
    if (selectedObject.type === 'image' || selectedObject.type === 'rectangle') {
        const x1 = selectedObject.x || Math.min(selectedObject.x1, selectedObject.x2);
        const y1 = selectedObject.y || Math.min(selectedObject.y1, selectedObject.y2);
        const x2 = (selectedObject.x + selectedObject.width) || Math.max(selectedObject.x1, selectedObject.x2);
        const y2 = (selectedObject.y + selectedObject.height) || Math.max(selectedObject.y1, selectedObject.y2);
        handles = [
            { x: x1, y: y1, name: 'nw' },
            { x: x2, y: y1, name: 'ne' },
            { x: x1, y: y2, name: 'sw' },
            { x: x2, y: y2, name: 'se' }
        ];
    }
    for (let handle of handles) {
        if (Math.abs(x - handle.x) <= handleSize && Math.abs(y - handle.y) <= handleSize) {
            return handle.name;
        }
    }
    return null;
}
function resizeObject(obj, x, y, handle) {
    if (obj.type === 'image' || obj.type === 'rectangle') {
        const aspectRatio = obj.width / obj.height;
        switch (handle) {
            case 'se':
                obj.width = Math.max(20, x - obj.x);
                obj.height = Math.max(20, y - obj.y);
                break;
            case 'sw':
                const newWidth = Math.max(20, obj.x + obj.width - x);
                obj.x = x;
                obj.width = newWidth;
                obj.height = Math.max(20, y - obj.y);
                break;
            case 'ne':
                obj.width = Math.max(20, x - obj.x);
                const newHeight = Math.max(20, obj.y + obj.height - y);
                obj.y = y;
                obj.height = newHeight;
                break;
            case 'nw':
                const nwWidth = Math.max(20, obj.x + obj.width - x);
                const nwHeight = Math.max(20, obj.y + obj.height - y);
                obj.x = x;
                obj.y = y;
                obj.width = nwWidth;
                obj.height = nwHeight;
                break;
        }
    }
}
function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(backgroundCanvas, 0, 0);
    drawObjectsAndSelection();
}
function drawObjectsAndSelection() {
    objects.forEach(obj => {
        if (obj.type === 'text') {
            addTextToCanvas(obj);
        } else if (obj.type === 'image') {
            addImageToCanvas(obj);
        } else if (obj.type === 'shape') {
            drawShape(obj);
        }
    });
    if (selectedObject) {
        ctx.save();
        ctx.strokeStyle = '#6C63FF';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        if (selectedObject.type === 'image' || selectedObject.type === 'rectangle') {
            const x = selectedObject.x || Math.min(selectedObject.x1, selectedObject.x2);
            const y = selectedObject.y || Math.min(selectedObject.y1, selectedObject.y2);
            const w = selectedObject.width || Math.abs(selectedObject.x2 - selectedObject.x1);
            const h = selectedObject.height || Math.abs(selectedObject.y2 - selectedObject.y1);
            ctx.strokeRect(x, y, w, h);
            const handleSize = 8;
            ctx.fillStyle = '#6C63FF';
            ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
            ctx.fillRect(x + w - handleSize/2, y - handleSize/2, handleSize, handleSize);
            ctx.fillRect(x - handleSize/2, y + h - handleSize/2, handleSize, handleSize);
            ctx.fillRect(x + w - handleSize/2, y + h - handleSize/2, handleSize, handleSize);
        }
        ctx.restore();
    }
}
function copyBoardCode() {
    navigator.clipboard.writeText(boardCode);
    showNotification('📋 Код доски скопирован!', 'success');
}
function goToDashboard() {
    if (socket) {
        socket.emit('leave_board', {
            board_code: boardCode,
            token: userToken
        });
        socket.disconnect();
    }
    window.location.href = '/dashboard';
}
window.addEventListener('beforeunload', () => {
    if (socket) {
        socket.emit('leave_board', {
            board_code: boardCode,
            token: userToken
        });
    }
});



let toolbarVisible = true;

function toggleToolbar() {
    const toolbar = document.getElementById('modernToolbar');
    const toggle = document.getElementById('toolbarToggle');
    const floatingToggle = document.getElementById('floatingToggle');
    
    toolbarVisible = !toolbarVisible;
    
    if (toolbarVisible) {
        toolbar.classList.remove('hidden');
        toggle.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
        `;
        toggle.title = 'Скрыть панель';
        floatingToggle.style.display = 'none';
    } else {
        toolbar.classList.add('hidden');
        toggle.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
        `;
        toggle.title = 'Показать панель';
       
        floatingToggle.style.display = 'flex';
    }
    
    localStorage.setItem('toolbarVisible', toolbarVisible);
}
if (window.innerWidth <= 768) {
    document.addEventListener('click', (e) => {
        const toolbar = document.getElementById('modernToolbar');
        const toggle = document.getElementById('toolbarToggle');
        
        if (toolbarVisible && 
            !toolbar.contains(e.target) && 
            !toggle.contains(e.target)) {
            toggleToolbar();
        }
    });
}

const savedToolbarState = localStorage.getItem('toolbarVisible');
if (savedToolbarState !== null) {
    toolbarVisible = savedToolbarState === 'true';
    const toolbar = document.getElementById('modernToolbar');
    const toggle = document.getElementById('toolbarToggle');
    const floatingToggle = document.getElementById('floatingToggle');
    
    if (!toolbarVisible) {
        toolbar.classList.add('hidden');
        toggle.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
        `;
        toggle.title = 'Показать панель';
        floatingToggle.style.display = 'flex';
    }
}

window.addEventListener('beforeunload', () => {
    localStorage.setItem('toolbarVisible', toolbarVisible);
});

function updateSaveIndicator(status) {
    const indicator = document.getElementById('saveIndicator');
    const statusText = document.getElementById('saveStatus');
    
    if (!indicator || !statusText) return;
    
    indicator.classList.remove('saving', 'saved', 'error');
    
    switch(status) {
        case 'saving':
            indicator.classList.add('saving');
            statusText.textContent = 'Сохранение...';
            break;
        case 'saved':
            indicator.classList.add('saved');
            statusText.textContent = 'Сохранено';
            setTimeout(() => {
                if (indicator.classList.contains('saved')) {
                    indicator.classList.remove('saved');
                }
            }, 3000);
            break;
        case 'error':
            indicator.classList.add('error');
            statusText.textContent = 'Ошибка';
            setTimeout(() => {
                if (indicator.classList.contains('error')) {
                    indicator.classList.remove('error');
                    statusText.textContent = 'Сохранено';
                }
            }, 5000);
            break;
    }
}
