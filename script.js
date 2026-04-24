const input = document.getElementById('inputBox');
const taskList = document.getElementById('taskList');
const linkList = document.getElementById('linkList');
const dashboardPanel = document.getElementById('dashboardPanel');
const summaryTaskCount = document.getElementById('summaryTaskCount');
const recentRecords = document.getElementById('recentRecords');
const dashboardLinks = document.getElementById('dashboardLinks');
const quickAddButton = document.getElementById('quickAdd');
const tasksColumn = document.getElementById('tasksColumn');
const linksColumn = document.getElementById('linksColumn');
const themeToggle = document.getElementById('themeToggle');

let data = [];
let dragIndex = null;
let currentView = 'all';

const appTitle = document.getElementById('appTitle');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const clearDataBtn = document.getElementById('clearDataBtn');
const exportDataBtn = document.getElementById('exportDataBtn');
const taskKeywordsInput = document.getElementById('taskKeywords');
const linkPatternInput = document.getElementById('linkPattern');
const showTimeToggle = document.getElementById('showTimeToggle');
const autoSortToggle = document.getElementById('autoSortToggle');
const appVersionSpan = document.getElementById('appVersion');

const APP_VERSION = '0.1.0';

let settings = {
    theme: 'day',
    taskKeywords: ['明天', '待办', 'todo'],
    linkPattern: '^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$',
    showTime: true,
    autoSort: false,
};

function loadSettings() {
    try {
        const stored = localStorage.getItem('workbenchSettings');
        const parsed = stored ? JSON.parse(stored) : null;
        if (parsed && typeof parsed === 'object') {
            settings = {
                ...settings,
                ...parsed,
                taskKeywords: Array.isArray(parsed.taskKeywords) ? parsed.taskKeywords : settings.taskKeywords,
                theme: parsed.theme || settings.theme,
            };
        }
    } catch (error) {
        settings = { ...settings };
    }
}

function saveSettings() {
    localStorage.setItem('workbenchSettings', JSON.stringify(settings));
}

function applyTheme() {
    document.body.classList.remove('theme-day', 'theme-night');
    document.body.classList.add(`theme-${settings.theme}`);
    themeToggle.textContent = settings.theme === 'day' ? '🌙' : '☀️';
}

function formatDateTime(date) {
    const Y = date.getFullYear();
    const M = String(date.getMonth() + 1).padStart(2, '0');
    const D = String(date.getDate()).padStart(2, '0');
    const H = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${Y}年${M}月${D}日 ${H}:${m}`;
}

function getWeekdayInitial(date) {
    const letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return letters[date.getDay()];
}

function getWeatherText() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return '☀️ 晴 18°C';
    if (hour >= 12 && hour < 17) return '☁️ 多云 20°C';
    if (hour >= 17 && hour < 21) return '🌧 小雨 16°C';
    return '🌫 阴 14°C';
}

function updateTopbarClock() {
    const now = new Date();
    document.getElementById('clockTime').textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    document.getElementById('clockDate').textContent = `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日`;
    document.getElementById('weekdayLabel').textContent = getWeekdayInitial(now);
    document.getElementById('weatherText').textContent = getWeatherText();
}

function loadData() {
    try {
        const stored = localStorage.getItem('workbench');
        data = stored ? JSON.parse(stored) : [];
        if (!Array.isArray(data)) data = [];
    } catch (error) {
        data = [];
    }
}

function saveData() {
    localStorage.setItem('workbench', JSON.stringify(data));
}

function isLink(text) {
    try {
        const regex = new RegExp(settings.linkPattern, 'i');
        return regex.test(text);
    } catch (error) {
        return false;
    }
}

function isTask(text) {
    return settings.taskKeywords.some((keyword) => {
        if (!keyword) return false;
        return text.toLowerCase().includes(keyword.toLowerCase());
    });
}

function getType(text) {
    if (isLink(text)) return 'link';
    if (isTask(text)) return 'task';
    return 'note';
}

const contentPanel = document.getElementById('contentPanel');

function updateView() {
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach((item) => {
        item.classList.toggle('active', item.dataset.view === currentView);
    });

    dashboardPanel.classList.toggle('hidden', currentView !== 'all');
    tasksColumn.classList.toggle('hidden', currentView === 'links');
    linksColumn.classList.toggle('hidden', currentView === 'tasks');
    contentPanel.classList.toggle('single-column', currentView !== 'all');
}

function renderDashboard() {
    const tasks = data.filter((item) => item.type !== 'link');
    const taskCount = tasks.length;
    const doneCount = tasks.filter((item) => item.done).length;
    summaryTaskCount.textContent = `${taskCount} 条任务 / ${doneCount} 条完成`;

    const recent = tasks.slice(-3).reverse();
    if (recent.length) {
        recentRecords.innerHTML = recent.map((item) => `<div>${item.text}</div>`).join('');
    } else {
        recentRecords.textContent = '暂无最近记录';
    }

    const links = data.filter((item) => item.type === 'link').slice(0, 3);
    if (links.length) {
        dashboardLinks.innerHTML = links.map((item) => `<div>${item.text}</div>`).join('');
    } else {
        dashboardLinks.textContent = '暂无快捷入口';
    }
}

function createCard(item, index) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.draggable = true;
    card.dataset.index = index;

    const content = document.createElement('div');
    content.className = 'item-content';

    let href = '';
    if (item.type === 'link') {
        href = item.text.match(/^https?:\/\//i) ? item.text : `https://${item.text}`;
        const linkEl = document.createElement('a');
        linkEl.className = 'item-text link-entry';
        linkEl.href = href;
        linkEl.target = '_blank';
        linkEl.rel = 'noopener noreferrer';
        linkEl.textContent = item.text;
        content.appendChild(linkEl);
    } else {
        const text = document.createElement('div');
        text.className = 'item-text';
        text.textContent = item.text;
        if (item.done) {
            text.style.textDecoration = 'line-through';
            text.style.opacity = '0.7';
        }
        content.appendChild(text);
    }

    if (item.type !== 'link' && settings.showTime) {
        const meta = document.createElement('div');
        meta.className = 'item-meta';
        meta.textContent = item.time;
        content.appendChild(meta);
    }

    card.appendChild(content);

    const actions = document.createElement('div');
    actions.className = 'item-actions';

    if (item.type === 'link') {
        const visitButton = document.createElement('button');
        visitButton.className = 'action-btn';
        visitButton.innerText = '访问';
        visitButton.addEventListener('click', (event) => {
            event.stopPropagation();
            window.open(href, '_blank', 'noopener');
        });
        actions.appendChild(visitButton);
    }

    if (item.type !== 'link') {
        const toggleButton = document.createElement('button');
        toggleButton.className = 'action-btn toggle-btn';
        toggleButton.innerText = item.done ? '✔' : '○';
        toggleButton.addEventListener('click', (event) => {
            event.stopPropagation();
            item.done = !item.done;
            saveData();
            render();
        });
        actions.appendChild(toggleButton);
    }

    const deleteButton = document.createElement('button');
    deleteButton.className = 'action-btn';
    deleteButton.innerText = '删除';
    deleteButton.addEventListener('click', (event) => {
        event.stopPropagation();
        data.splice(index, 1);
        saveData();
        render();
    });
    actions.appendChild(deleteButton);

    card.appendChild(actions);

    card.addEventListener('dragstart', () => {
        dragIndex = index;
    });

    card.addEventListener('dragover', (event) => {
        event.preventDefault();
    });

    card.addEventListener('drop', () => {
        if (dragIndex === null) return;
        const draggedItem = data[dragIndex];
        data.splice(dragIndex, 1);
        data.splice(index, 0, draggedItem);
        saveData();
        render();
    });

    return card;
}

function render() {
    taskList.innerHTML = '';
    linkList.innerHTML = '';
    renderDashboard();
    updateView();

    let items = data.map((item, index) => ({ item, index }));
    if (settings.autoSort) {
        items.sort((a, b) => {
            if (a.item.type !== b.item.type) {
                return a.item.type === 'link' ? 1 : -1;
            }
            return a.item.time.localeCompare(b.item.time);
        });
    }

    items.forEach(({ item, index }) => {
        const card = createCard(item, index);
        if (item.type === 'link') {
            if (currentView !== 'tasks') {
                linkList.appendChild(card);
            }
        } else {
            if (currentView !== 'links') {
                taskList.appendChild(card);
            }
        }
    });
}

function openSettings() {
    updateSettingsUI();
    settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
    settingsModal.classList.add('hidden');
}

function downloadJSON() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'workbench-data.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function updateSettingsUI() {
    taskKeywordsInput.value = settings.taskKeywords.join(', ');
    linkPatternInput.value = settings.linkPattern;
    showTimeToggle.checked = settings.showTime;
    autoSortToggle.checked = settings.autoSort;
    appVersionSpan.textContent = APP_VERSION;
}

appTitle.addEventListener('click', openSettings);
closeSettings.addEventListener('click', closeSettingsModal);
settingsModal.addEventListener('click', (event) => {
    if (event.target === settingsModal) closeSettingsModal();
});

const menuItems = document.querySelectorAll('.menu-item');
menuItems.forEach((item) => {
    item.addEventListener('click', function () {
        currentView = this.dataset.view || 'all';
        render();
    });
});

themeToggle.addEventListener('click', () => {
    settings.theme = settings.theme === 'day' ? 'night' : 'day';
    saveSettings();
    applyTheme();
});

quickAddButton.addEventListener('click', () => {
    input.focus();
});

clearDataBtn.addEventListener('click', () => {
    if (confirm('确认清空本地数据？')) {
        data = [];
        saveData();
        render();
    }
});

exportDataBtn.addEventListener('click', downloadJSON);

taskKeywordsInput.addEventListener('blur', () => {
    settings.taskKeywords = taskKeywordsInput.value
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    saveSettings();
});

linkPatternInput.addEventListener('blur', () => {
    if (linkPatternInput.value.trim()) {
        settings.linkPattern = linkPatternInput.value.trim();
        saveSettings();
    }
});

showTimeToggle.addEventListener('change', () => {
    settings.showTime = showTimeToggle.checked;
    saveSettings();
    render();
});

autoSortToggle.addEventListener('change', () => {
    settings.autoSort = autoSortToggle.checked;
    saveSettings();
    render();
});

loadSettings();
applyTheme();
loadData();
updateSettingsUI();
updateTopbarClock();
setInterval(updateTopbarClock, 1000);
render();

input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const value = input.value.trim();
    if (!value) return;

    data.push({
        text: value,
        time: formatDateTime(new Date()),
        type: getType(value),
        done: false,
    });

    saveData();
    input.value = '';
    render();
});
