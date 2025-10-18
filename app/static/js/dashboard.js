let currentUser = null;
async function checkAuth() {
    const result = await apiRequest('/api/auth/verify');
    if (!result.success) {
        window.location.href = '/';
        return false;
    }
    currentUser = result.user;
    document.getElementById('username').textContent = currentUser.username;
    return true;
}
async function loadStatistics() {
    const result = await apiRequest('/api/board/statistics');
    if (result.success) {
        const stats = result.statistics;
        console.log('Statistics loaded:', stats);
        document.getElementById('boardsCreated').textContent = stats.boards_created || 0;
        document.getElementById('boardsJoined').textContent = stats.boards_joined || 0;
        document.getElementById('participatedBoards').textContent = stats.participated_boards || 0;
    }
}
async function loadBoards() {
    const result = await apiRequest('/api/board/my-boards');
    if (result.success) {
        const boards = result.boards;
        const boardsList = document.getElementById('boardsList');
        const noBoardsMessage = document.getElementById('noBoardsMessage');
        if (boards.length === 0) {
            boardsList.innerHTML = '';
            noBoardsMessage.style.display = 'block';
        } else {
            noBoardsMessage.style.display = 'none';
            boardsList.innerHTML = boards.map(board => {
                const isOwner = board.owner_id === currentUser.id;
                return `
                <div class="board-card hover-lift" data-board-code="${board.board_code}">
                    <div class="board-card-header">
                        <div class="board-title-section">
                            <h3>${board.name}</h3>
                            ${isOwner ? '<span class="owner-badge">👑 Моя доска</span>' : '<span class="member-badge">👥 Участник</span>'}
                        </div>
                        <div class="board-actions">
                            <button class="btn-icon" onclick="event.stopPropagation(); copyBoardCodeDash('${board.board_code}')" title="Копировать код">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </button>
                            ${isOwner ? `
                            <button class="btn-icon btn-danger" onclick="event.stopPropagation(); deleteBoard('${board.board_code}', '${board.name}')" title="Удалить доску">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                            ` : `
                            <button class="btn-icon btn-warning" onclick="event.stopPropagation(); leaveBoard('${board.board_code}', '${board.name}')" title="Покинуть доску">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                    <polyline points="16 17 21 12 16 7"></polyline>
                                    <line x1="21" y1="12" x2="9" y2="12"></line>
                                </svg>
                            </button>
                            `}
                        </div>
                    </div>
                    <div class="board-code-badge">${board.board_code}</div>
                    <div class="board-info">
                        <div class="board-meta">
                            <span class="meta-item">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                                ${board.owner_name}
                            </span>
                            <span class="meta-item">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                                ${board.participant_count}/${board.max_users}
                            </span>
                        </div>
                        <div class="board-date">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            ${new Date(board.updated_at).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                            })}
                        </div>
                    </div>
                    <button class="board-open-btn" onclick="openBoard('${board.board_code}')">
                        Открыть доску
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                            <polyline points="12 5 19 12 12 19"></polyline>
                        </svg>
                    </button>
                </div>
            `}).join('');
        }
    }
}
function showCreateBoardModal() {
    document.getElementById('createBoardModal').style.display = 'block';
}
function closeCreateBoardModal() {
    document.getElementById('createBoardModal').style.display = 'none';
    document.getElementById('boardName').value = '';
}
function showJoinBoardModal() {
    document.getElementById('joinBoardModal').style.display = 'block';
}
function closeJoinBoardModal() {
    document.getElementById('joinBoardModal').style.display = 'none';
    document.getElementById('boardCode').value = '';
}
async function handleCreateBoard(event) {
    event.preventDefault();
    const name = document.getElementById('boardName').value;
    const result = await apiRequest('/api/board/create', 'POST', { name });
    if (result.success) {
        showNotification('Доска успешно создана', 'success');
        closeCreateBoardModal();
        loadBoards();
        loadStatistics();
        setTimeout(() => {
            openBoard(result.board.code);
        }, 1000);
    } else {
        showNotification(result.message || 'Не удалось создать доску', 'error');
    }
}
async function handleJoinBoard(event) {
    event.preventDefault();
    const code = document.getElementById('boardCode').value.toUpperCase();
    const result = await apiRequest('/api/board/join', 'POST', { code });
    if (result.success) {
        showNotification('Вы успешно присоединились к доске', 'success');
        closeJoinBoardModal();
        loadBoards();
        loadStatistics();
        setTimeout(() => {
            openBoard(code);
        }, 1000);
    } else {
        showNotification(result.message || 'Не удалось присоединиться к доске', 'error');
    }
}
function openBoard(boardCode) {
    window.location.href = `/board/${boardCode}`;
}
async function handleLogout() {
    const result = await apiRequest('/api/auth/logout', 'POST');
    if (result.success) {
        showNotification('Выход выполнен', 'success');
        setTimeout(() => {
            window.location.href = '/';
        }, 500);
    }
}
window.onclick = function(event) {
    const createModal = document.getElementById('createBoardModal');
    const joinModal = document.getElementById('joinBoardModal');
    if (event.target === createModal) {
        closeCreateBoardModal();
    }
    if (event.target === joinModal) {
        closeJoinBoardModal();
    }
}
function copyBoardCodeDash(code) {
    navigator.clipboard.writeText(code);
    showNotification('Код доски скопирован: ' + code, 'success');
}
async function deleteBoard(boardCode, boardName) {
    if (!confirm(`Вы уверены, что хотите удалить доску "${boardName}"?\n\nКод: ${boardCode}\n\nЭто действие нельзя отменить!`)) {
        return;
    }
    const result = await apiRequest(`/api/board/${boardCode}/delete`, 'DELETE');
    if (result.success) {
        showNotification('Доска успешно удалена', 'success');
        loadBoards();
        loadStatistics();
    } else {
        showNotification(result.message || 'Не удалось удалить доску', 'error');
    }
}
async function leaveBoard(boardCode, boardName) {
    if (!confirm(`Вы уверены, что хотите покинуть доску "${boardName}"?\n\nКод: ${boardCode}\n\nВы больше не будете иметь доступ к этой доске.`)) {
        return;
    }
    const result = await apiRequest(`/api/board/${boardCode}/leave`, 'DELETE');
    if (result.success) {
        showNotification('Вы покинули доску', 'success');
        loadBoards();
        loadStatistics();
    } else {
        showNotification(result.message || 'Не удалось покинуть доску', 'error');
    }
}
(async function() {
    if (await checkAuth()) {
        await loadStatistics();
        await loadBoards();
    }
})();
