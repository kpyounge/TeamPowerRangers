////////////////////////////////////////////////////////////////
//PROGRESS.JS
//THIS IS THE "CONTROLLER" FOR THE PROGRESS (LINE GRAPH) PAGE.
//
//The user picks a habit from the dropdown and a time range
//(1 week, 1 month, 3 months or 6 months). The server sends back
//one point per day: 100 if the habit was checked that day,
//0 if it wasn't. Nothing is remembered between visits - every
//time the page loads it starts blank on the 1 week range.
////////////////////////////////////////////////////////////////

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DEFAULT_DAYS = 7;

let chart = null;                 // the Chart.js graph
let selectedDays = DEFAULT_DAYS;  // current time range, in days
let fullDates = [];               // "Nov 9, 2026" style labels for the tooltip
let requestCounter = 0;           // lets us ignore out-of-date responses

document.addEventListener('DOMContentLoaded', () => {

    //////////////////////////////////////////
    //JWT CHECK - redirect to logon if missing
    //////////////////////////////////////////
    const token = localStorage.getItem('jwtToken');
    if (!token) {
        window.location.href = '/';
        return;
    }
    DataModel.setToken(token);

    //////////////////////////////////////////
    //ELEMENTS + EVENT LISTENERS
    //////////////////////////////////////////
    document.getElementById('logoutButton').addEventListener('click', () => {
        localStorage.removeItem('jwtToken');
        window.location.href = '/';
    });

    document.getElementById('habitSelect').addEventListener('change', () => loadProgress());

    document.querySelectorAll('.range-btn').forEach(button => {
        button.addEventListener('click', () => {
            setActiveRange(Number(button.dataset.days));
            loadProgress();
        });
    });

    // Redraw the graph in the right colors when the theme is switched
    new MutationObserver(() => applyThemeToChart())
        .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // If the browser's Back button brings us back to this page from its
    // cache, start over blank like a fresh visit
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            resetPage();
        }
    });

    //////////////////////////////////////////
    //INITIAL LOAD
    //////////////////////////////////////////
    createChart();
    loadHabitOptions();
});

// Today's date in the user's own time zone, as YYYY-MM-DD
function todayString() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
}

// "2026-11-09" -> "Nov 9" (or "Nov 9, 2026" when withYear is true)
function formatDate(dateStr, withYear) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const text = `${MONTH_NAMES[month - 1]} ${day}`;
    return withYear ? `${text}, ${year}` : text;
}

//////////////////////////////////////////
//DROPDOWN + TIME RANGE
//////////////////////////////////////////
async function loadHabitOptions() {
    const select = document.getElementById('habitSelect');
    const result = await DataModel.getHabits(todayString());

    if (!result.ok) {
        // An expired or invalid token means the user has to log in again
        if (result.status === 401 || result.status === 403) {
            localStorage.removeItem('jwtToken');
            window.location.href = '/';
            return;
        }
        showMessage(result.error);
        return;
    }

    result.data.habits.forEach(habit => {
        const option = document.createElement('option');
        option.value = habit.id;
        option.textContent = habit.name;
        select.appendChild(option);
    });

    if (result.data.habits.length === 0) {
        showMessage('You have no habits yet. Add one on the Dashboard first.');
    }
}

function setActiveRange(days) {
    selectedDays = days;
    document.querySelectorAll('.range-btn').forEach(button => {
        const isActive = Number(button.dataset.days) === days;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}

// Back to a blank graph on the 1 week range
function resetPage() {
    document.getElementById('habitSelect').value = '';
    setActiveRange(DEFAULT_DAYS);
    clearChart();
}

//////////////////////////////////////////
//LOAD THE SELECTED HABIT'S DATA
//////////////////////////////////////////
async function loadProgress() {
    const habitId = document.getElementById('habitSelect').value;

    if (!habitId) {
        clearChart();
        return;
    }

    const thisRequest = ++requestCounter;
    const result = await DataModel.getHabitProgress(habitId, todayString(), selectedDays);

    // The user picked something else while we were waiting
    if (thisRequest !== requestCounter) {
        return;
    }

    if (!result.ok) {
        if (result.status === 401 || result.status === 403) {
            localStorage.removeItem('jwtToken');
            window.location.href = '/';
            return;
        }
        clearChart();
        showMessage(result.error);
        return;
    }

    showPoints(result.data.points);
}

//////////////////////////////////////////
//THE GRAPH
//////////////////////////////////////////
function themeColors() {
    const styles = getComputedStyle(document.documentElement);
    return {
        text: styles.getPropertyValue('--color-text').trim() || '#FFFFFF',
        line: styles.getPropertyValue('--color-purple').trim() || '#5E57FF'
    };
}

function createChart() {
    if (typeof Chart === 'undefined') {
        showMessage('The graph could not be loaded. Check your internet connection and refresh.');
        return;
    }

    const colors = themeColors();

    chart = new Chart(document.getElementById('progressChart'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Completed',
                data: [],
                borderColor: colors.line,
                backgroundColor: colors.line,
                borderWidth: 3,
                tension: 0,
                pointRadius: 4,
                pointHoverRadius: 7,
                pointHitRadius: 14
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 250 },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    displayColors: false,
                    callbacks: {
                        // Hovering a point shows the date and whether it was done
                        title: (items) => fullDates[items[0].dataIndex] || '',
                        label: (item) => item.parsed.y === 100 ? 'Completed' : 'Not completed'
                    }
                }
            },
            scales: {
                y: {
                    min: -12,
                    max: 112,
                    // Only show the two values that matter: No (0) and Yes (100)
                    afterBuildTicks: (scale) => {
                        scale.ticks = [{ value: 0 }, { value: 100 }];
                    },
                    ticks: {
                        color: colors.text,
                        callback: (value) => value === 100 ? 'Yes' : 'No'
                    },
                    grid: { color: 'rgba(128, 128, 128, 0.3)' }
                },
                x: {
                    ticks: { color: colors.text, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
                    grid: { display: false }
                }
            }
        }
    });
}

// Fill the graph with the days the server sent back
function showPoints(points) {
    if (!chart) {
        return;
    }
    fullDates = points.map(p => formatDate(p.date, true));
    chart.data.labels = points.map(p => formatDate(p.date, false));
    chart.data.datasets[0].data = points.map(p => p.value);
    // Long ranges have too many dots, so only show them when hovering
    chart.data.datasets[0].pointRadius = points.length <= 30 ? 4 : 0;
    chart.update();
    showMessage('');
}

// Back to the blank graph
function clearChart() {
    requestCounter++;
    fullDates = [];
    if (chart) {
        chart.data.labels = [];
        chart.data.datasets[0].data = [];
        chart.update();
        showMessage('Select a habit to see its progress.');
    }
}

// The text shown over the graph while it is blank ('' hides it)
function showMessage(text) {
    const message = document.getElementById('chartMessage');
    message.textContent = text;
    message.hidden = text === '';
}

function applyThemeToChart() {
    if (!chart) {
        return;
    }
    const colors = themeColors();
    const dataset = chart.data.datasets[0];
    dataset.borderColor = colors.line;
    dataset.backgroundColor = colors.line;
    chart.options.scales.x.ticks.color = colors.text;
    chart.options.scales.y.ticks.color = colors.text;
    chart.update();
}