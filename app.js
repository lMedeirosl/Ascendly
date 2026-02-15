// ========================================
// LIFEOS v5.0 - SISTEMA COMPLETO
// ========================================

const defaultData = {
  // Estudos
  study: {
    xpTotal: 0,
    streak: 0,
    lastStudyDate: null,
    lastWeekReset: null,
    subjects: {
      matematica: { minutes: 0, xp: 0, weeklyGoalMinutes: 600 },
      fisica: { minutes: 0, xp: 0, weeklyGoalMinutes: 480 },
      quimica: { minutes: 0, xp: 0, weeklyGoalMinutes: 360 }
    },
    dailyHistory: {},
    activities: [],
    timerMode: 'normal',
    pomodoroSession: 1
  },
  
  // Alimentação
  food: {
    streak: 0,
    lastMealDate: null,
    weeklyGoal: 21, // refeições limpas
    weeklyProgress: 0,
    meals: [],
    weeklyGoalText: '',
    lastWeekReset: null
  },
  
  // Treino
  workout: {
    streak: 0,
    lastWorkoutDate: null,
    weeklyGoal: 5,
    weeklyProgress: 0,
    workouts: [],
    totalMinutes: 0,
    lastWeekReset: null
  },
  
  // Tarefas
  tasks: {
    list: [],
    completedToday: 0,
    completedWeek: 0,
    lastResetDate: null
  },
  
  // Configurações
  settings: {
    theme: 'dark',
    notifications: false,
    sound: true
  }
};

let data = JSON.parse(localStorage.getItem("lifeOS")) || defaultData;

// Timer variables
let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;
let currentTimerSubject = null;
let isBreakTime = false;
let currentEditingSubject = null;

// Chart instances
let studyRadarChart = null;
let studyLineChart = null;

// Current tab
let currentTab = 'estudos';

// Current task filter
let currentTaskFilter = 'todas';

// ========================================
// PERSISTÊNCIA
// ========================================

function saveData() {
  localStorage.setItem("lifeOS", JSON.stringify(data));
}

// ========================================
// NAVIGATION
// ========================================

function switchTab(tabName) {
  // Remove active class from all tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  // Activate selected tab
  event.target.classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');
  
  currentTab = tabName;
  
  // Update specific tab data
  if (tabName === 'estudos') {
    updateStudyUI();
  } else if (tabName === 'alimentacao') {
    updateFoodUI();
  } else if (tabName === 'treino') {
    updateWorkoutUI();
  } else if (tabName === 'tarefas') {
    updateTasksUI();
  }
}

// ========================================
// GLOBAL STATS
// ========================================

function updateGlobalStats() {
  document.getElementById("globalStudyStreak").textContent = data.study.streak;
  document.getElementById("globalFoodStreak").textContent = data.food.streak;
  document.getElementById("globalWorkoutStreak").textContent = data.workout.streak;
  
  const completedTasks = data.tasks.list.filter(t => t.completed).length;
  document.getElementById("globalTasksCompleted").textContent = completedTasks;
}

// ========================================
// SETTINGS
// ========================================

function toggleTheme() {
  if (document.body.classList.contains('light-mode')) {
    document.body.classList.remove('light-mode');
    data.settings.theme = 'dark';
  } else {
    document.body.classList.add('light-mode');
    data.settings.theme = 'light';
  }
  saveData();
}

function openSettingsModal() {
  document.getElementById("settingsModal").style.display = "block";
  document.getElementById("weeklyFoodGoalInput").value = data.food.weeklyGoal;
  document.getElementById("weeklyWorkoutGoalInput").value = data.workout.weeklyGoal;
  document.getElementById("notificationsEnabled").checked = data.settings.notifications;
  document.getElementById("soundEnabled").checked = data.settings.sound;
}

function closeSettingsModal() {
  document.getElementById("settingsModal").style.display = "none";
}

function saveSettings() {
  data.food.weeklyGoal = parseInt(document.getElementById("weeklyFoodGoalInput").value) || 21;
  data.workout.weeklyGoal = parseInt(document.getElementById("weeklyWorkoutGoalInput").value) || 5;
  data.settings.notifications = document.getElementById("notificationsEnabled").checked;
  data.settings.sound = document.getElementById("soundEnabled").checked;
  
  saveData();
  updateUI();
  closeSettingsModal();
  showFeedback('studyFeedback', '⚙️ Configurações salvas!');
}

function showNotification(title, body) {
  if (data.settings.notifications && "Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: '🌱' });
  }
}

function playSound(type) {
  if (!data.settings.sound) return;
  
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  switch(type) {
    case 'success':
      oscillator.frequency.value = 800;
      gainNode.gain.value = 0.1;
      break;
    case 'start':
      oscillator.frequency.value = 600;
      gainNode.gain.value = 0.1;
      break;
    case 'stop':
      oscillator.frequency.value = 400;
      gainNode.gain.value = 0.1;
      break;
  }
  
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.1);
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function getLastMonday() {
  const today = new Date();
  const day = today.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toDateString();
}

function showFeedback(elementId, message) {
  const feedback = document.getElementById(elementId);
  if (!feedback) return;
  
  feedback.textContent = message;
  feedback.style.animation = 'none';
  
  setTimeout(() => {
    feedback.style.animation = 'fadeInOut 2s ease';
  }, 10);
}

// ========================================
// ESTUDOS - LEVEL & XP
// ========================================

function calculateLevel(xp) {
  return Math.floor(Math.sqrt(xp / 10));
}

function getXPForLevel(level) {
  return Math.pow(level, 2) * 10;
}

function getNextLevelXP(level) {
  return getXPForLevel(level + 1);
}

// ========================================
// ESTUDOS - STREAK
// ========================================

function updateStudyStreak() {
  const today = new Date().toDateString();
  
  if (data.study.lastStudyDate === today) {
    return;
  }
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();
  
  if (data.study.lastStudyDate === yesterdayStr) {
    data.study.streak += 1;
    data.study.xpTotal += 5;
  } else if (!data.study.lastStudyDate || data.study.lastStudyDate !== yesterdayStr) {
    data.study.streak = 1;
  }
  
  data.study.lastStudyDate = today;
}

function checkStudyWeekReset() {
  const lastMonday = getLastMonday();
  
  if (!data.study.lastWeekReset || data.study.lastWeekReset !== lastMonday) {
    for (let key in data.study.subjects) {
      data.study.subjects[key].minutes = 0;
    }
    data.study.lastWeekReset = lastMonday;
  }
}

// ========================================
// ESTUDOS - SUBJECTS
// ========================================

function openAddSubjectModal() {
  document.getElementById("addSubjectModal").style.display = "block";
  document.getElementById("newSubjectName").value = "";
  document.getElementById("newSubjectGoal").value = "";
}

function closeAddSubjectModal() {
  document.getElementById("addSubjectModal").style.display = "none";
}

function addNewSubject() {
  const name = document.getElementById("newSubjectName").value.trim().toLowerCase();
  const goalHours = parseInt(document.getElementById("newSubjectGoal").value);
  
  if (!name) {
    alert("⚠️ Digite o nome da matéria!");
    return;
  }
  
  if (!goalHours || goalHours < 1) {
    alert("⚠️ Digite uma meta válida!");
    return;
  }
  
  if (data.study.subjects[name]) {
    alert("⚠️ Essa matéria já existe!");
    return;
  }
  
  data.study.subjects[name] = {
    minutes: 0,
    xp: 0,
    weeklyGoalMinutes: goalHours * 60
  };
  
  saveData();
  updateStudyUI();
  closeAddSubjectModal();
  showFeedback('studyFeedback', `✅ Matéria "${name}" adicionada!`);
}

function openEditSubjectModal(subjectKey) {
  currentEditingSubject = subjectKey;
  const subject = data.study.subjects[subjectKey];
  
  document.getElementById("editSubjectName").value = subjectKey.charAt(0).toUpperCase() + subjectKey.slice(1);
  document.getElementById("editSubjectGoal").value = Math.floor(subject.weeklyGoalMinutes / 60);
  document.getElementById("editSubjectModal").style.display = "block";
}

function closeEditSubjectModal() {
  document.getElementById("editSubjectModal").style.display = "none";
  currentEditingSubject = null;
}

function saveEditSubject() {
  const goalHours = parseInt(document.getElementById("editSubjectGoal").value);
  
  if (!goalHours || goalHours < 1) {
    alert("⚠️ Digite uma meta válida!");
    return;
  }
  
  data.study.subjects[currentEditingSubject].weeklyGoalMinutes = goalHours * 60;
  
  saveData();
  updateStudyUI();
  closeEditSubjectModal();
  showFeedback('studyFeedback', `✅ Meta atualizada!`);
}

function deleteSubject(subjectKey) {
  if (!confirm(`❌ Excluir "${subjectKey}"? Todos os dados serão perdidos!`)) {
    return;
  }
  
  delete data.study.subjects[subjectKey];
  saveData();
  updateStudyUI();
  showFeedback('studyFeedback', `🗑️ Matéria removida!`);
}

// ========================================
// ESTUDOS - TIMER
// ========================================

function setTimerMode(mode) {
  data.study.timerMode = mode;
  
  document.getElementById("normalModeBtn").classList.toggle('active', mode === 'normal');
  document.getElementById("pomodoroModeBtn").classList.toggle('active', mode === 'pomodoro');
  document.getElementById("pomodoroInfo").style.display = mode === 'pomodoro' ? 'block' : 'none';
  
  saveData();
}

function startTimer() {
  const subjectSelect = document.getElementById("timerSubjectSelect");
  const subject = subjectSelect.value;
  
  if (!subject) {
    alert("⚠️ Selecione uma matéria!");
    return;
  }
  
  currentTimerSubject = subject;
  timerRunning = true;
  timerSeconds = 0;
  isBreakTime = false;
  
  document.getElementById("startBtn").disabled = true;
  document.getElementById("pauseBtn").disabled = false;
  document.getElementById("stopBtn").disabled = false;
  document.getElementById("timerSubjectSelect").disabled = true;
  
  document.getElementById("sessionInfo").style.display = "block";
  document.getElementById("currentSubject").textContent = subject.charAt(0).toUpperCase() + subject.slice(1);
  document.getElementById("timerDisplay").classList.add("running");
  
  timerInterval = setInterval(() => {
    timerSeconds++;
    updateTimerDisplay();
    
    if (data.study.timerMode === 'pomodoro') {
      if (!isBreakTime && timerSeconds >= 1500) {
        handlePomodoroTransition();
      } else if (isBreakTime && timerSeconds >= 300) {
        handlePomodoroTransition();
      }
    }
  }, 1000);
  
  playSound('start');
}

function pauseTimer() {
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById("pauseBtn").textContent = "▶️ Continuar";
    document.getElementById("timerDisplay").classList.remove("running");
  } else {
    timerRunning = true;
    document.getElementById("pauseBtn").textContent = "⏸️ Pausar";
    document.getElementById("timerDisplay").classList.add(isBreakTime ? "break" : "running");
    timerInterval = setInterval(() => {
      timerSeconds++;
      updateTimerDisplay();
      
      if (data.study.timerMode === 'pomodoro') {
        if (!isBreakTime && timerSeconds >= 1500) {
          handlePomodoroTransition();
        } else if (isBreakTime && timerSeconds >= 300) {
          handlePomodoroTransition();
        }
      }
    }, 1000);
  }
}

function stopTimer() {
  if (timerSeconds < 60 && !confirm("Menos de 1 minuto. Parar mesmo?")) {
    return;
  }
  
  clearInterval(timerInterval);
  
  if (!isBreakTime) {
    const minutesStudied = Math.floor(timerSeconds / 60);
    if (minutesStudied > 0) {
      addTimerStudy(currentTimerSubject, minutesStudied);
    }
  }
  
  resetTimer();
  playSound('stop');
}

function resetTimer() {
  clearInterval(timerInterval);
  timerSeconds = 0;
  timerRunning = false;
  currentTimerSubject = null;
  isBreakTime = false;
  
  document.getElementById("timerDisplay").textContent = "00:00:00";
  document.getElementById("timerDisplay").classList.remove("running", "break");
  document.getElementById("startBtn").disabled = false;
  document.getElementById("pauseBtn").disabled = true;
  document.getElementById("pauseBtn").textContent = "⏸️ Pausar";
  document.getElementById("stopBtn").disabled = true;
  document.getElementById("timerSubjectSelect").disabled = false;
  document.getElementById("sessionInfo").style.display = "none";
}

function updateTimerDisplay() {
  const hours = Math.floor(timerSeconds / 3600);
  const minutes = Math.floor((timerSeconds % 3600) / 60);
  const seconds = timerSeconds % 60;
  
  const display = 
    String(hours).padStart(2, '0') + ':' +
    String(minutes).padStart(2, '0') + ':' +
    String(seconds).padStart(2, '0');
  
  document.getElementById("timerDisplay").textContent = display;
  document.getElementById("elapsedTime").textContent = Math.floor(timerSeconds / 60) + " min";
}

function handlePomodoroTransition() {
  pauseTimer();
  
  if (!isBreakTime) {
    const minutesStudied = Math.floor(timerSeconds / 60);
    addTimerStudy(currentTimerSubject, minutesStudied);
    
    isBreakTime = true;
    timerSeconds = 0;
    document.getElementById("timerDisplay").classList.remove("running");
    document.getElementById("timerDisplay").classList.add("break");
    
    showNotification("⏸️ Pausa!", "Descanse 5 minutos!");
    playSound('success');
    
    if (confirm("🍅 Sessão completa! Fazer pausa de 5 min?")) {
      pauseTimer();
    }
  } else {
    isBreakTime = false;
    data.study.pomodoroSession++;
    
    if (data.study.pomodoroSession > 4) {
      data.study.pomodoroSession = 1;
    }
    
    document.getElementById("pomodoroSession").textContent = data.study.pomodoroSession;
    document.getElementById("timerDisplay").classList.remove("break");
    
    showNotification("▶️ Pausa acabou!", "Bora continuar!");
    playSound('start');
    
    if (confirm("⏱️ Pausa acabou! Continuar?")) {
      timerSeconds = 0;
      pauseTimer();
    } else {
      stopTimer();
    }
  }
}

function addTimerStudy(subject, minutes) {
  updateStudyStreak();
  
  const xp = minutes;
  data.study.xpTotal += xp;
  data.study.subjects[subject].xp += xp;
  data.study.subjects[subject].minutes += minutes;
  
  const today = getTodayKey();
  data.study.dailyHistory[today] = (data.study.dailyHistory[today] || 0) + xp;
  
  const activity = {
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    subject: subject,
    xp: xp,
    action: `⏱️ Timer (${minutes} min)`,
    date: today
  };
  
  data.study.activities.unshift(activity);
  
  showFeedback('studyFeedback', `+${xp} XP • ${minutes} min!`);
  showNotification("✅ Sessão completa!", `+${xp} XP em ${subject}`);
  
  saveData();
  updateStudyUI();
  updateGlobalStats();
}

// ========================================
// ESTUDOS - QUICK ACTIONS
// ========================================

function addQuickStudy(minutes) {
  const subjectSelect = document.getElementById("quickSubjectSelect");
  const subject = subjectSelect.value;
  
  if (!subject) {
    alert("⚠️ Selecione uma matéria!");
    return;
  }
  
  updateStudyStreak();
  
  const xp = minutes;
  data.study.xpTotal += xp;
  data.study.subjects[subject].xp += xp;
  data.study.subjects[subject].minutes += minutes;
  
  const today = getTodayKey();
  data.study.dailyHistory[today] = (data.study.dailyHistory[today] || 0) + xp;
  
  const activity = {
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    subject: subject,
    xp: xp,
    action: `📚 ${minutes} min`,
    date: today
  };
  
  data.study.activities.unshift(activity);
  
  showFeedback('studyFeedback', `+${xp} XP em ${subject}!`);
  playSound('success');
  
  saveData();
  updateStudyUI();
  updateGlobalStats();
}

// ========================================
// ESTUDOS - UI UPDATE
// ========================================

function updateStudyUI() {
  checkStudyWeekReset();
  
  const level = calculateLevel(data.study.xpTotal);
  document.getElementById("studyLevel").textContent = level;
  
  const currentLevelXP = getXPForLevel(level);
  const nextLevelXP = getNextLevelXP(level);
  const xpInLevel = data.study.xpTotal - currentLevelXP;
  const xpNeeded = nextLevelXP - currentLevelXP;
  const progress = (xpInLevel / xpNeeded) * 100;
  
  document.getElementById("studyXpProgress").style.width = Math.min(progress, 100) + "%";
  document.getElementById("studyCurrentXP").textContent = xpInLevel;
  document.getElementById("studyNextLevelXP").textContent = xpNeeded;
  
  document.getElementById("studyStreak").textContent = data.study.streak;
  
  // Today's minutes
  const today = getTodayKey();
  const todayMinutes = data.study.dailyHistory[today] || 0;
  document.getElementById("studyToday").textContent = todayMinutes;
  
  // Week's minutes
  let weekMinutes = 0;
  for (let key in data.study.subjects) {
    weekMinutes += data.study.subjects[key].minutes;
  }
  document.getElementById("studyWeek").textContent = weekMinutes;
  
  renderSubjects();
  populateStudySelects();
  renderStudyCharts();
}

function renderSubjects() {
  const container = document.getElementById("subjectsContainer");
  container.innerHTML = "";
  
  for (let key in data.study.subjects) {
    const subject = data.study.subjects[key];
    const totalMinutes = subject.minutes;
    const goalMinutes = subject.weeklyGoalMinutes;
    const percent = Math.min((totalMinutes / goalMinutes) * 100, 100);
    
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const goalHours = Math.floor(goalMinutes / 60);
    
    const card = document.createElement('div');
    card.className = 'subject-card';
    card.innerHTML = `
      <h3>${key.charAt(0).toUpperCase() + key.slice(1)}</h3>
      <div class="subject-stats">
        <span>${hours}h ${mins}min / ${goalHours}h</span>
        <span>${subject.xp} XP</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${percent}%"></div>
      </div>
      <div class="subject-actions">
        <button class="btn btn-secondary" onclick="openEditSubjectModal('${key}')">✏️</button>
        <button class="btn btn-danger" onclick="deleteSubject('${key}')">🗑️</button>
      </div>
    `;
    
    container.appendChild(card);
  }
}

function populateStudySelects() {
  const timerSelect = document.getElementById("timerSubjectSelect");
  const quickSelect = document.getElementById("quickSubjectSelect");
  
  timerSelect.innerHTML = '<option value="">Selecione uma matéria</option>';
  quickSelect.innerHTML = '<option value="">Selecione uma matéria</option>';
  
  for (let key in data.study.subjects) {
    const option1 = document.createElement('option');
    option1.value = key;
    option1.textContent = key.charAt(0).toUpperCase() + key.slice(1);
    timerSelect.appendChild(option1);
    
    const option2 = document.createElement('option');
    option2.value = key;
    option2.textContent = key.charAt(0).toUpperCase() + key.slice(1);
    quickSelect.appendChild(option2);
  }
}

function renderStudyCharts() {
  // Radar Chart
  const radarCtx = document.getElementById("studyRadarChart");
  if (studyRadarChart) studyRadarChart.destroy();
  
  const labels = [];
  const dataPoints = [];
  
  for (let key in data.study.subjects) {
    labels.push(key.charAt(0).toUpperCase() + key.slice(1));
    const skill = Math.min((data.study.subjects[key].minutes / data.study.subjects[key].weeklyGoalMinutes) * 100, 100);
    dataPoints.push(skill);
  }
  
  studyRadarChart = new Chart(radarCtx, {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Progresso Semanal (%)',
        data: dataPoints,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        pointBackgroundColor: '#10b981',
        pointRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: '#f8fafc' } }
      },
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: { color: '#cbd5e1', backdropColor: 'transparent' },
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          pointLabels: { color: '#f8fafc' }
        }
      }
    }
  });
  
  // Line Chart
  const lineCtx = document.getElementById("studyLineChart");
  if (studyLineChart) studyLineChart.destroy();
  
  const last30Days = getLast30Days();
  const lineLabels = last30Days.map(date => {
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });
  
  const lineData = last30Days.map(date => data.study.dailyHistory[date] || 0);
  
  studyLineChart = new Chart(lineCtx, {
    type: 'line',
    data: {
      labels: lineLabels,
      datasets: [{
        label: 'XP Diário',
        data: lineData,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: '#f8fafc' } }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: '#cbd5e1' },
          grid: { color: 'rgba(255, 255, 255, 0.1)' }
        },
        x: {
          ticks: { color: '#cbd5e1' },
          grid: { color: 'rgba(255, 255, 255, 0.1)' }
        }
      }
    }
  });
}

function getLast30Days() {
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    days.push(date.toISOString().split('T')[0]);
  }
  return days;
}

// ========================================
// ALIMENTAÇÃO
// ========================================

function checkFoodWeekReset() {
  const lastMonday = getLastMonday();
  
  if (!data.food.lastWeekReset || data.food.lastWeekReset !== lastMonday) {
    data.food.weeklyProgress = 0;
    data.food.lastWeekReset = lastMonday;
  }
}

function updateFoodStreak() {
  const today = new Date().toDateString();
  
  if (data.food.lastMealDate === today) {
    return;
  }
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();
  
  if (data.food.lastMealDate === yesterdayStr) {
    data.food.streak += 1;
  } else if (!data.food.lastMealDate || data.food.lastMealDate !== yesterdayStr) {
    data.food.streak = 1;
  }
  
  data.food.lastMealDate = today;
}

function addMeal() {
  const type = document.getElementById("mealType").value;
  const description = document.getElementById("mealDescription").value.trim();
  const isClean = document.getElementById("mealClean").checked;
  
  if (!description) {
    alert("⚠️ Descreva o que você comeu!");
    return;
  }
  
  updateFoodStreak();
  
  if (isClean) {
    data.food.weeklyProgress++;
  }
  
  const meal = {
    type: type,
    description: description,
    isClean: isClean,
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    date: getTodayKey()
  };
  
  data.food.meals.unshift(meal);
  
  document.getElementById("mealDescription").value = "";
  document.getElementById("mealClean").checked = false;
  
  showFeedback('foodFeedback', isClean ? '✅ Refeição limpa registrada!' : '📝 Refeição registrada!');
  playSound('success');
  
  saveData();
  updateFoodUI();
  updateGlobalStats();
}

function saveWeeklyFoodGoal() {
  const goal = document.getElementById("weeklyFoodGoal").value.trim();
  
  if (!goal) {
    alert("⚠️ Digite seu objetivo!");
    return;
  }
  
  data.food.weeklyGoalText = goal;
  
  saveData();
  updateFoodUI();
  showFeedback('foodFeedback', '💾 Objetivo salvo!');
}

function updateFoodUI() {
  checkFoodWeekReset();
  
  document.getElementById("foodStreak").textContent = data.food.streak;
  document.getElementById("foodGoalProgress").textContent = data.food.weeklyProgress;
  document.getElementById("foodGoalTotal").textContent = data.food.weeklyGoal;
  
  const foodPercent = (data.food.weeklyProgress / data.food.weeklyGoal) * 100;
  document.getElementById("foodGoalBar").style.width = Math.min(foodPercent, 100) + "%";
  
  // Today's meals
  const today = getTodayKey();
  const todayMeals = data.food.meals.filter(m => m.date === today);
  document.getElementById("foodToday").textContent = todayMeals.length;
  
  // Week's meals
  const weekMeals = data.food.meals.filter(m => {
    const mealDate = new Date(m.date);
    const lastMonday = new Date(getLastMonday());
    return mealDate >= lastMonday;
  });
  document.getElementById("foodWeek").textContent = weekMeals.length;
  
  renderTodayMeals();
  renderWeeklyFoodGoal();
}

function renderTodayMeals() {
  const container = document.getElementById("todayMealsContainer");
  const today = getTodayKey();
  const todayMeals = data.food.meals.filter(m => m.date === today);
  
  if (todayMeals.length === 0) {
    container.innerHTML = '<p class="text-muted text-center">Nenhuma refeição registrada hoje.</p>';
    return;
  }
  
  container.innerHTML = '';
  
  todayMeals.forEach(meal => {
    const item = document.createElement('div');
    item.className = `meal-item ${meal.isClean ? '' : 'junk'}`;
    item.innerHTML = `
      <div class="meal-header">
        <span class="meal-type">${getMealTypeIcon(meal.type)} ${getMealTypeName(meal.type)}</span>
        <span class="meal-time">${meal.time}</span>
      </div>
      <div class="meal-description">${meal.description}</div>
      <span class="meal-badge ${meal.isClean ? 'clean' : 'junk'}">${meal.isClean ? '✅ Limpa' : '⚠️ Não limpa'}</span>
    `;
    container.appendChild(item);
  });
}

function renderWeeklyFoodGoal() {
  const container = document.getElementById("currentWeeklyGoal");
  
  if (!data.food.weeklyGoalText) {
    container.innerHTML = '<p class="text-muted">Nenhum objetivo definido ainda.</p>';
    return;
  }
  
  container.innerHTML = `
    <h4>📌 Objetivo Atual:</h4>
    <p>${data.food.weeklyGoalText}</p>
  `;
}

function getMealTypeIcon(type) {
  const icons = {
    cafe: '☕',
    almoco: '🍱',
    lanche: '🥤',
    janta: '🍽️',
    ceia: '🌙'
  };
  return icons[type] || '🍽️';
}

function getMealTypeName(type) {
  const names = {
    cafe: 'Café da Manhã',
    almoco: 'Almoço',
    lanche: 'Lanche',
    janta: 'Janta',
    ceia: 'Ceia'
  };
  return names[type] || 'Refeição';
}

// ========================================
// TREINO
// ========================================

function checkWorkoutWeekReset() {
  const lastMonday = getLastMonday();
  
  if (!data.workout.lastWeekReset || data.workout.lastWeekReset !== lastMonday) {
    data.workout.weeklyProgress = 0;
    data.workout.lastWeekReset = lastMonday;
  }
}

function updateWorkoutStreak() {
  const today = new Date().toDateString();
  
  if (data.workout.lastWorkoutDate === today) {
    return;
  }
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();
  
  if (data.workout.lastWorkoutDate === yesterdayStr) {
    data.workout.streak += 1;
  } else if (!data.workout.lastWorkoutDate || data.workout.lastWorkoutDate !== yesterdayStr) {
    data.workout.streak = 1;
  }
  
  data.workout.lastWorkoutDate = today;
}

function addWorkout() {
  const type = document.getElementById("workoutType").value;
  const duration = parseInt(document.getElementById("workoutDuration").value);
  const exercises = document.getElementById("workoutExercises").value.trim();
  const notes = document.getElementById("workoutNotes").value.trim();
  
  if (!duration || duration < 1) {
    alert("⚠️ Digite a duração do treino!");
    return;
  }
  
  if (!exercises) {
    alert("⚠️ Descreva os exercícios!");
    return;
  }
  
  updateWorkoutStreak();
  
  data.workout.weeklyProgress++;
  data.workout.totalMinutes += duration;
  
  const workout = {
    type: type,
    duration: duration,
    exercises: exercises,
    notes: notes,
    date: getTodayKey(),
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  };
  
  data.workout.workouts.unshift(workout);
  
  document.getElementById("workoutDuration").value = "";
  document.getElementById("workoutExercises").value = "";
  document.getElementById("workoutNotes").value = "";
  
  showFeedback('workoutFeedback', '💪 Treino registrado!');
  showNotification("💪 Treino completo!", `${duration} minutos de ${type}`);
  playSound('success');
  
  saveData();
  updateWorkoutUI();
  updateGlobalStats();
}

function updateWorkoutUI() {
  checkWorkoutWeekReset();
  
  document.getElementById("workoutStreak").textContent = data.workout.streak;
  document.getElementById("workoutGoalProgress").textContent = data.workout.weeklyProgress;
  document.getElementById("workoutGoalTotal").textContent = data.workout.weeklyGoal;
  
  const workoutPercent = (data.workout.weeklyProgress / data.workout.weeklyGoal) * 100;
  document.getElementById("workoutGoalBar").style.width = Math.min(workoutPercent, 100) + "%";
  
  document.getElementById("workoutWeek").textContent = data.workout.weeklyProgress;
  document.getElementById("workoutTotalTime").textContent = data.workout.totalMinutes;
  
  renderWorkoutHistory();
}

function renderWorkoutHistory() {
  const container = document.getElementById("workoutHistoryContainer");
  
  if (data.workout.workouts.length === 0) {
    container.innerHTML = '<p class="text-muted text-center">Nenhum treino registrado ainda.</p>';
    return;
  }
  
  container.innerHTML = '';
  
  const recentWorkouts = data.workout.workouts.slice(0, 10);
  
  recentWorkouts.forEach(workout => {
    const item = document.createElement('div');
    item.className = 'workout-item';
    item.innerHTML = `
      <div class="workout-header">
        <span class="workout-type">${getWorkoutIcon(workout.type)} ${getWorkoutTypeName(workout.type)}</span>
        <span class="workout-duration">⏱️ ${workout.duration} min</span>
      </div>
      <div class="workout-exercises">${workout.exercises}</div>
      ${workout.notes ? `<div class="workout-notes">"${workout.notes}"</div>` : ''}
      <div class="workout-date">${formatDate(workout.date)} às ${workout.time}</div>
    `;
    container.appendChild(item);
  });
}

function getWorkoutIcon(type) {
  const icons = {
    peito: '💪',
    costas: '🦾',
    pernas: '🦵',
    ombros: '💪',
    bracos: '💪',
    cardio: '🏃',
    fullbody: '🔥',
    funcional: '⚡'
  };
  return icons[type] || '💪';
}

function getWorkoutTypeName(type) {
  const names = {
    peito: 'Peito',
    costas: 'Costas',
    pernas: 'Pernas',
    ombros: 'Ombros',
    bracos: 'Braços',
    cardio: 'Cardio',
    fullbody: 'Full Body',
    funcional: 'Funcional'
  };
  return names[type] || type;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR');
}

// ========================================
// TAREFAS
// ========================================

function addTask() {
  const title = document.getElementById("newTaskTitle").value.trim();
  const priority = document.getElementById("newTaskPriority").value;
  const category = document.getElementById("newTaskCategory").value;
  
  if (!title) {
    alert("⚠️ Digite o título da tarefa!");
    return;
  }
  
  const task = {
    id: Date.now(),
    title: title,
    priority: priority,
    category: category,
    completed: false,
    createdAt: new Date().toISOString()
  };
  
  data.tasks.list.unshift(task);
  
  document.getElementById("newTaskTitle").value = "";
  
  showFeedback('taskFeedback', '✅ Tarefa adicionada!');
  playSound('success');
  
  saveData();
  updateTasksUI();
  updateGlobalStats();
}

function toggleTask(taskId) {
  const task = data.tasks.list.find(t => t.id === taskId);
  if (!task) return;
  
  task.completed = !task.completed;
  
  if (task.completed) {
    data.tasks.completedToday++;
    data.tasks.completedWeek++;
  } else {
    data.tasks.completedToday--;
    data.tasks.completedWeek--;
  }
  
  saveData();
  updateTasksUI();
  updateGlobalStats();
}

function deleteTask(taskId) {
  if (!confirm("❌ Excluir esta tarefa?")) return;
  
  data.tasks.list = data.tasks.list.filter(t => t.id !== taskId);
  
  saveData();
  updateTasksUI();
  updateGlobalStats();
}

function filterTasks(filter) {
  currentTaskFilter = filter;
  
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  renderTasks();
}

function updateTasksUI() {
  // Reset daily count
  const today = getTodayKey();
  if (data.tasks.lastResetDate !== today) {
    data.tasks.completedToday = 0;
    data.tasks.lastResetDate = today;
  }
  
  const completed = data.tasks.list.filter(t => t.completed).length;
  const pending = data.tasks.list.filter(t => !t.completed).length;
  const total = data.tasks.list.length;
  const rate = total > 0 ? Math.floor((completed / total) * 100) : 0;
  
  document.getElementById("tasksCompletedToday").textContent = data.tasks.completedToday;
  document.getElementById("tasksPending").textContent = pending;
  document.getElementById("tasksCompletedWeek").textContent = data.tasks.completedWeek;
  document.getElementById("tasksCompletionRate").textContent = rate + "%";
  
  renderTasks();
}

function renderTasks() {
  const container = document.getElementById("tasksContainer");
  
  let filteredTasks = data.tasks.list;
  
  if (currentTaskFilter === 'pendentes') {
    filteredTasks = data.tasks.list.filter(t => !t.completed);
  } else if (currentTaskFilter === 'concluidas') {
    filteredTasks = data.tasks.list.filter(t => t.completed);
  }
  
  if (filteredTasks.length === 0) {
    container.innerHTML = '<p class="text-muted text-center">Nenhuma tarefa encontrada.</p>';
    return;
  }
  
  container.innerHTML = '';
  
  filteredTasks.forEach(task => {
    const item = document.createElement('div');
    item.className = `task-item ${task.completed ? 'completed' : ''}`;
    item.innerHTML = `
      <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask(${task.id})">
      <div class="task-content">
        <div class="task-title">${task.title}</div>
        <div class="task-meta">
          <span class="task-priority">${getPriorityIcon(task.priority)} ${task.priority}</span>
          <span class="task-category">${getCategoryIcon(task.category)} ${task.category}</span>
        </div>
      </div>
      <div class="task-actions">
        <button class="task-btn" onclick="deleteTask(${task.id})">🗑️</button>
      </div>
    `;
    container.appendChild(item);
  });
}

function getPriorityIcon(priority) {
  const icons = {
    baixa: '🟢',
    media: '🟡',
    alta: '🔴'
  };
  return icons[priority] || '⚪';
}

function getCategoryIcon(category) {
  const icons = {
    pessoal: '👤',
    trabalho: '💼',
    estudos: '📚',
    saude: '🏥',
    outros: '📌'
  };
  return icons[category] || '📌';
}

// ========================================
// EXPORT/IMPORT
// ========================================

function exportData() {
  const dataStr = JSON.stringify(data, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `lifeos-backup-${getTodayKey()}.json`;
  link.click();
  
  URL.revokeObjectURL(url);
  showFeedback('studyFeedback', '💾 Dados exportados!');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  
  input.onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        
        if (confirm('⚠️ Substituir todos os dados?')) {
          data = importedData;
          saveData();
          updateUI();
          showFeedback('studyFeedback', '📥 Dados importados!');
        }
      } catch (error) {
        alert('❌ Arquivo inválido.');
      }
    };
    
    reader.readAsText(file);
  };
  
  input.click();
}

// ========================================
// UPDATE ALL UI
// ========================================

function updateUI() {
  updateGlobalStats();
  
  if (currentTab === 'estudos') {
    updateStudyUI();
  } else if (currentTab === 'alimentacao') {
    updateFoodUI();
  } else if (currentTab === 'treino') {
    updateWorkoutUI();
  } else if (currentTab === 'tarefas') {
    updateTasksUI();
  }
}

// ========================================
// INICIALIZAÇÃO
// ========================================

function init() {
  // Aplica tema
  if (data.settings.theme === 'light') {
    document.body.classList.add('light-mode');
  }
  
  // Configura timer mode
  setTimerMode(data.study.timerMode || 'normal');
  document.getElementById("pomodoroSession").textContent = data.study.pomodoroSession || 1;
  
  // Pede permissão de notificação
  if (data.settings.notifications && "Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
  
  // Atualiza tudo
  updateUI();
  
  // Modal close handlers
  window.onclick = function(event) {
    const modals = ['addSubjectModal', 'editSubjectModal', 'settingsModal'];
    modals.forEach(modalId => {
      const modal = document.getElementById(modalId);
      if (event.target == modal) {
        modal.style.display = "none";
      }
    });
  }
  
  console.log('🌱 LifeOS v5.0 iniciado!');
}

// Inicia quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
