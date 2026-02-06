document.addEventListener("DOMContentLoaded", function () {
  // Текущая дата и выбранная дата
  let currentDate = new Date();
  let selectedDate = new Date();

  // Данные календаря
  let calendarData = {};

  // Текущий активный фильтр
  let activeFilter = "all";
  let searchQuery = "";

  // Загрузка данных из localStorage
  loadData();

  // Утилиты для работы со временем
  const TimeUtils = {
    toMinutes: function (hours, minutes) {
      return (hours || 0) * 60 + (minutes || 0);
    },

    formatTime: function (minutes, showSign = false) {
      const absMinutes = Math.abs(minutes);
      const hours = Math.floor(absMinutes / 60);
      const mins = absMinutes % 60;

      let sign = "";
      if (showSign && minutes !== 0) {
        sign = minutes > 0 ? "+" : "-";
      }

      if (hours > 0 && mins > 0) {
        return `${sign}${hours}ч ${mins}м`;
      } else if (hours > 0) {
        return `${sign}${hours}ч`;
      } else if (mins > 0) {
        return `${sign}${mins}м`;
      }
      return "0ч 0м";
    },

    formatStats: function (minutes) {
      const absMinutes = Math.abs(minutes);
      const hours = Math.floor(absMinutes / 60);
      const mins = absMinutes % 60;

      if (minutes === 0) return "0 часов 0 минут";

      if (minutes > 0) {
        if (hours > 0 && mins > 0) return `${hours} ч ${mins} м`;
        if (hours > 0) return `${hours} ч`;
        return `${mins} м`;
      } else {
        if (hours > 0 && mins > 0) return `Долг: ${hours} ч ${mins} м`;
        if (hours > 0) return `Долг: ${hours} ч`;
        return `Долг: ${mins} м`;
      }
    },

    validateTimeInput: function (inputId) {
      const input = document.getElementById(inputId);
      let value = parseInt(input.value) || 0;

      if (inputId.includes("Minutes")) {
        // Для минут: от 0 до 59
        if (value < 0) value = 0;
        if (value > 59) value = 59;
      } else if (inputId.includes("Hours")) {
        // Для часов: разные максимумы для переработки и ухода/прихода
        if (inputId.includes("overtime")) {
          // Переработка: максимум 999 часов
          if (value < 0) value = 0;
          if (value > 999) value = 999;
        } else {
          // Уход раньше/приход позже: максимум 12 часов
          if (value < 0) value = 0;
          if (value > 12) value = 12;
        }
      }

      input.value = value;
      return value;
    },

    normalizeMinutes: function (hours, minutes) {
      // Если минут больше 59, добавляем избыток к часам
      if (minutes >= 60) {
        hours += Math.floor(minutes / 60);
        minutes = minutes % 60;
      }

      // Корректируем часы в зависимости от типа
      let maxHours = 999; // По умолчанию для переработки

      if (hours > maxHours) {
        hours = maxHours;
      }

      return {
        hours: hours,
        minutes: minutes,
      };
    },

    validateAndNormalizeAll: function () {
      // Получаем все значения
      let overtimeHours =
        parseInt(document.getElementById("overtimeHours").value) || 0;
      let overtimeMinutes =
        parseInt(document.getElementById("overtimeMinutes").value) || 0;
      let earlyHours =
        parseInt(document.getElementById("earlyHours").value) || 0;
      let earlyMinutes =
        parseInt(document.getElementById("earlyMinutes").value) || 0;
      let lateHours = parseInt(document.getElementById("lateHours").value) || 0;
      let lateMinutes =
        parseInt(document.getElementById("lateMinutes").value) || 0;

      // Нормализуем минуты
      const normOvertime = this.normalizeMinutes(
        overtimeHours,
        overtimeMinutes,
      );
      const normEarly = this.normalizeMinutes(earlyHours, earlyMinutes);
      const normLate = this.normalizeMinutes(lateHours, lateMinutes);

      // Обновляем поля ввода
      document.getElementById("overtimeHours").value = normOvertime.hours;
      document.getElementById("overtimeMinutes").value = normOvertime.minutes;
      document.getElementById("earlyHours").value = normEarly.hours;
      document.getElementById("earlyMinutes").value = normEarly.minutes;
      document.getElementById("lateHours").value = normLate.hours;
      document.getElementById("lateMinutes").value = normLate.minutes;

      return {
        overtimeHours: normOvertime.hours,
        overtimeMinutes: normOvertime.minutes,
        earlyHours: normEarly.hours,
        earlyMinutes: normEarly.minutes,
        lateHours: normLate.hours,
        lateMinutes: normLate.minutes,
      };
    },
  };

  // Инициализация
  updateCalendar();
  updateStats();
  updateAdvancedStats();
  setupMonthDropdown();
  setupEventListeners();
  setupValidation();
  setupTouchEvents();
  updateProgressBar();

  // Настройка всех обработчиков событий
  function setupEventListeners() {
    // Навигация по месяцам
    document.getElementById("prevMonth").addEventListener("click", function () {
      currentDate.setMonth(currentDate.getMonth() - 1);
      updateCalendar();
      updateMonthDropdown();
    });

    document.getElementById("nextMonth").addEventListener("click", function () {
      currentDate.setMonth(currentDate.getMonth() + 1);
      updateCalendar();
      updateMonthDropdown();
    });

    // Навигация по годам в выпадающем списке
    document.getElementById("prevYear").addEventListener("click", function () {
      const year = parseInt(document.getElementById("currentYear").textContent);
      document.getElementById("currentYear").textContent = year - 1;
      updateMonthDropdown();
    });

    document.getElementById("nextYear").addEventListener("click", function () {
      const year = parseInt(document.getElementById("currentYear").textContent);
      document.getElementById("currentYear").textContent = year + 1;
      updateMonthDropdown();
    });

    // Переключение выпадающего списка месяцев
    document
      .getElementById("currentMonth")
      .addEventListener("click", function (e) {
        e.stopPropagation();
        const dropdown = document.getElementById("monthDropdown");
        dropdown.classList.toggle("show");

        // Устанавливаем текущий год в выпадающем списке
        document.getElementById("currentYear").textContent =
          currentDate.getFullYear();
        updateMonthDropdown();
      });

    // Закрытие выпадающего списка при клике вне его
    document.addEventListener("click", function (e) {
      const dropdown = document.getElementById("monthDropdown");
      const monthSelector = document.querySelector(".month-selector");

      if (
        !monthSelector.contains(e.target) &&
        dropdown.classList.contains("show")
      ) {
        dropdown.classList.remove("show");
      }
    });

    // Экспорт данных
    document.getElementById("exportBtn").addEventListener("click", exportData);

    // Импорт данных
    document
      .getElementById("importInput")
      .addEventListener("change", importData);

    // Сохранение данных дня
    document.getElementById("saveDay").addEventListener("click", saveDayData);

    // Очистка данных дня
    document.getElementById("clearDay").addEventListener("click", clearDayData);

    // Фильтры
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        document
          .querySelectorAll(".filter-btn")
          .forEach((b) => b.classList.remove("active"));
        this.classList.add("active");
        activeFilter = this.dataset.filter;
        updateCalendar();
      });
    });

    // Поиск
    document
      .getElementById("searchComments")
      .addEventListener("input", function () {
        searchQuery = this.value.toLowerCase().trim();
        updateCalendar();
      });

    // Резервное копирование
    document
      .getElementById("createBackupBtn")
      .addEventListener("click", createBackup);
    document
      .getElementById("restoreBackupBtn")
      .addEventListener("click", showBackupModal);

    // Модальное окно
    document
      .querySelector(".close-modal")
      .addEventListener("click", hideBackupModal);
    document
      .getElementById("cancelRestoreBtn")
      .addEventListener("click", hideBackupModal);
    document
      .getElementById("confirmRestoreBtn")
      .addEventListener("click", restoreBackup);

    // Закрытие модального окна при клике вне его
    document
      .getElementById("backupModal")
      .addEventListener("click", function (e) {
        if (e.target === this) hideBackupModal();
      });
  }

  // Настройка валидации ввода времени
  function setupValidation() {
    const timeInputs = [
      "overtimeHours",
      "overtimeMinutes",
      "earlyHours",
      "earlyMinutes",
      "lateHours",
      "lateMinutes",
    ];

    timeInputs.forEach((id) => {
      const input = document.getElementById(id);

      input.addEventListener("blur", function () {
        TimeUtils.validateTimeInput(id);
      });

      input.addEventListener("change", function () {
        TimeUtils.validateTimeInput(id);
      });

      input.addEventListener("input", function () {
        this.classList.remove("invalid");
      });
    });
  }

  // Настройка тач-событий для мобильных устройств
  function setupTouchEvents() {
    const calendar = document.querySelector(".calendar");
    let touchStartX = 0;
    let touchEndX = 0;

    calendar.addEventListener(
      "touchstart",
      function (e) {
        touchStartX = e.changedTouches[0].screenX;
      },
      { passive: true },
    );

    calendar.addEventListener(
      "touchend",
      function (e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
      },
      { passive: true },
    );

    function handleSwipe() {
      const swipeThreshold = 50;
      const diff = touchStartX - touchEndX;

      if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
          // Свайп влево - следующий месяц
          currentDate.setMonth(currentDate.getMonth() + 1);
        } else {
          // Свайп вправо - предыдущий месяц
          currentDate.setMonth(currentDate.getMonth() - 1);
        }
        updateCalendar();
        updateMonthDropdown();
      }
    }
  }

  // Обновление календаря с учетом фильтров и поиска
  function updateCalendar() {
    const monthYearElement = document.getElementById("currentMonth");
    const monthNames = [
      "Январь",
      "Февраль",
      "Март",
      "Апрель",
      "Май",
      "Июнь",
      "Июль",
      "Август",
      "Сентябрь",
      "Октябрь",
      "Ноябрь",
      "Декабрь",
    ];

    monthYearElement.textContent = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

    // Очищаем календарь
    const calendarDays = document.getElementById("calendarDays");
    calendarDays.innerHTML = "";

    // Первый день месяца
    const firstDay = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1,
    );
    // Последний день месяца
    const lastDay = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
    );

    // День недели первого дня (0 - воскресенье, 1 - понедельник и т.д.)
    let firstDayOfWeek = firstDay.getDay();
    // Корректируем для отображения понедельника первым
    if (firstDayOfWeek === 0) firstDayOfWeek = 7;

    // Добавляем пустые ячейки для дней предыдущего месяца
    for (let i = 1; i < firstDayOfWeek; i++) {
      const emptyDay = document.createElement("div");
      emptyDay.classList.add("day", "day-other-month");
      calendarDays.appendChild(emptyDay);
    }

    // Добавляем дни текущего месяца
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dayElement = document.createElement("div");
      dayElement.classList.add("day", "current-month");

      // Создаем уникальный ключ для даты
      const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${day}`;
      const dayDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        day,
      );

      // Проверяем, является ли день сегодняшним
      const today = new Date();
      if (dayDate.toDateString() === today.toDateString()) {
        dayElement.classList.add("today");
      }

      // Проверяем, является ли день выбранным
      if (dayDate.toDateString() === selectedDate.toDateString()) {
        dayElement.classList.add("selected");
      }

      // Получаем данные для дня
      const dayData = calendarData[dateKey];
      const hasData = dayData && Object.keys(dayData).length > 0;

      // Проверяем фильтры и поиск
      let shouldShow = true;
      if (hasData) {
        shouldShow = checkFilters(dayData, dateKey);

        // Проверяем поиск
        if (shouldShow && searchQuery) {
          const comments = (dayData.comments || "").toLowerCase();
          shouldShow = comments.includes(searchQuery);
        }
      } else {
        // Если нет данных и фильтр не "all", скрываем
        shouldShow = activeFilter === "all";
      }

      if (!shouldShow) {
        dayElement.classList.add("filtered-out");
      }

      // Номер дня
      const dayNumber = document.createElement("div");
      dayNumber.classList.add("day-number");
      dayNumber.textContent = day;
      dayElement.appendChild(dayNumber);

      // Индикаторы для дня
      if (hasData && shouldShow) {
        const indicators = document.createElement("div");
        indicators.classList.add("day-indicators");

        // Индикатор переработки
        if (dayData.overtimeHours > 0 || dayData.overtimeMinutes > 0) {
          const overtimeIndicator = document.createElement("div");
          overtimeIndicator.classList.add("indicator", "overtime-indicator");
          if (dayData.overtimeHours > 0 && dayData.overtimeMinutes > 0) {
            overtimeIndicator.textContent = `+${dayData.overtimeHours}ч ${dayData.overtimeMinutes}м`;
          } else if (dayData.overtimeHours > 0) {
            overtimeIndicator.textContent = `+${dayData.overtimeHours}ч`;
          } else {
            overtimeIndicator.textContent = `+${dayData.overtimeMinutes}м`;
          }
          indicators.appendChild(overtimeIndicator);
        }

        // Индикатор ухода раньше
        if (dayData.earlyHours > 0 || dayData.earlyMinutes > 0) {
          const earlyIndicator = document.createElement("div");
          earlyIndicator.classList.add("indicator", "early-indicator");
          if (dayData.earlyHours > 0 && dayData.earlyMinutes > 0) {
            earlyIndicator.textContent = `-${dayData.earlyHours}ч ${dayData.earlyMinutes}м`;
          } else if (dayData.earlyHours > 0) {
            earlyIndicator.textContent = `-${dayData.earlyHours}ч`;
          } else {
            earlyIndicator.textContent = `-${dayData.earlyMinutes}м`;
          }
          indicators.appendChild(earlyIndicator);
        }

        // Индикатор прихода позже
        if (dayData.lateHours > 0 || dayData.lateMinutes > 0) {
          const lateIndicator = document.createElement("div");
          lateIndicator.classList.add("indicator", "late-indicator");
          if (dayData.lateHours > 0 && dayData.lateMinutes > 0) {
            lateIndicator.textContent = `-${dayData.lateHours}ч ${dayData.lateMinutes}м опозд.`;
          } else if (dayData.lateHours > 0) {
            lateIndicator.textContent = `-${dayData.lateHours}ч опозд.`;
          } else {
            lateIndicator.textContent = `-${dayData.lateMinutes}м опозд.`;
          }
          indicators.appendChild(lateIndicator);
        }

        // Индикатор комментариев
        if (dayData.comments && dayData.comments.trim() !== "") {
          const commentsIndicator = document.createElement("div");
          commentsIndicator.classList.add("indicator", "comments-indicator");
          commentsIndicator.textContent = "💬";
          indicators.appendChild(commentsIndicator);
        }

        dayElement.appendChild(indicators);
      }

      // Обработчик клика на день
      dayElement.addEventListener("click", function () {
        if (!shouldShow) return;
        selectDay(dayDate, dateKey);
      });

      calendarDays.appendChild(dayElement);
    }

    // Обновляем прогресс-бар
    updateProgressBar();
  }

  // Проверка фильтров
  function checkFilters(dayData, dateKey) {
    switch (activeFilter) {
      case "all":
        return true;
      case "overtime":
        return dayData.overtimeHours > 0 || dayData.overtimeMinutes > 0;
      case "early":
        return dayData.earlyHours > 0 || dayData.earlyMinutes > 0;
      case "late":
        return dayData.lateHours > 0 || dayData.lateMinutes > 0;
      case "comments":
        return dayData.comments && dayData.comments.trim() !== "";
      default:
        return true;
    }
  }

  // Выбор дня
  function selectDay(date, dateKey) {
    selectedDate = date;
    updateCalendar();

    // Обновляем заголовок
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    document.getElementById("selectedDate").textContent =
      date.toLocaleDateString("ru-RU", options);

    // Загружаем данные дня
    const dayData = calendarData[dateKey] || {};

    document.getElementById("overtimeHours").value =
      dayData.overtimeHours || "";
    document.getElementById("overtimeMinutes").value =
      dayData.overtimeMinutes || "";
    document.getElementById("earlyHours").value = dayData.earlyHours || "";
    document.getElementById("earlyMinutes").value = dayData.earlyMinutes || "";
    document.getElementById("lateHours").value = dayData.lateHours || "";
    document.getElementById("lateMinutes").value = dayData.lateMinutes || "";
    document.getElementById("commentsInput").value = dayData.comments || "";

    // Показываем сохраненные данные
    displaySavedData(dayData);
  }

  // Сохранение данных дня с автоматической нормализацией
  function saveDayData() {
    const dateKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth() + 1}-${selectedDate.getDate()}`;

    // Валидируем и нормализуем все значения
    const normalizedValues = TimeUtils.validateAndNormalizeAll();

    // Получаем комментарии
    const comments = document.getElementById("commentsInput").value.trim();

    // Сохраняем нормализованные данные
    calendarData[dateKey] = {
      overtimeHours: normalizedValues.overtimeHours,
      overtimeMinutes: normalizedValues.overtimeMinutes,
      earlyHours: normalizedValues.earlyHours,
      earlyMinutes: normalizedValues.earlyMinutes,
      lateHours: normalizedValues.lateHours,
      lateMinutes: normalizedValues.lateMinutes,
      comments,
    };

    // Сохраняем в localStorage
    saveData();

    // Создаем резервную копию
    createBackup();

    // Обновляем интерфейс
    updateCalendar();
    updateStats();
    updateAdvancedStats();

    // Обновляем отображение сохраненных данных
    displaySavedData(calendarData[dateKey]);

    // Показываем уведомление
    showNotification("Данные сохранены!");
  }

  // Очистка данных дня
  function clearDayData() {
    const dateKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth() + 1}-${selectedDate.getDate()}`;

    // Удаляем данные
    delete calendarData[dateKey];

    // Очищаем поля ввода
    document.getElementById("overtimeHours").value = "";
    document.getElementById("overtimeMinutes").value = "";
    document.getElementById("earlyHours").value = "";
    document.getElementById("earlyMinutes").value = "";
    document.getElementById("lateHours").value = "";
    document.getElementById("lateMinutes").value = "";
    document.getElementById("commentsInput").value = "";

    // Сохраняем в localStorage
    saveData();

    // Создаем резервную копию
    createBackup();

    // Обновляем интерфейс
    updateCalendar();
    updateStats();
    updateAdvancedStats();

    // Очищаем отображение сохраненных данных
    document.getElementById("savedData").innerHTML = "";

    // Показываем уведомление
    showNotification("Данные удалены!");
  }

  // Отображение сохраненных данных
  function displaySavedData(dayData) {
    const savedDataElement = document.getElementById("savedData");

    if (!dayData || Object.keys(dayData).length === 0) {
      savedDataElement.innerHTML =
        "<p>Нет сохраненных данных для этого дня.</p>";
      return;
    }

    let html = "";

    // Переработка
    if (dayData.overtimeHours > 0 || dayData.overtimeMinutes > 0) {
      html += `
                <div class="data-item">
                    <h4><i class="fas fa-business-time"></i> Переработка</h4>
                    <p>${dayData.overtimeHours || 0} ч ${dayData.overtimeMinutes || 0} м</p>
                </div>
            `;
    }

    // Уход раньше
    if (dayData.earlyHours > 0 || dayData.earlyMinutes > 0) {
      html += `
                <div class="data-item">
                    <h4><i class="fas fa-running"></i> Ушел раньше</h4>
                    <p>${dayData.earlyHours || 0} ч ${dayData.earlyMinutes || 0} м</p>
                </div>
            `;
    }

    // Приход позже
    if (dayData.lateHours > 0 || dayData.lateMinutes > 0) {
      html += `
                <div class="data-item">
                    <h4><i class="fas fa-bed"></i> Пришел позже</h4>
                    <p>${dayData.lateHours || 0} ч ${dayData.lateMinutes || 0} м</p>
                </div>
            `;
    }

    // Комментарии
    if (dayData.comments && dayData.comments.trim() !== "") {
      html += `
                <div class="data-item">
                    <h4><i class="fas fa-comment"></i> Комментарии</h4>
                    <p>${dayData.comments}</p>
                </div>
            `;
    }

    // Расчет чистой переработки
    const netOvertime = calculateNetOvertime(dayData);
    if (netOvertime !== 0) {
      const hours = Math.floor(Math.abs(netOvertime) / 60);
      const minutes = Math.abs(netOvertime) % 60;
      let overtimeText = "";

      if (netOvertime > 0) {
        if (hours > 0 && minutes > 0) {
          overtimeText = `+${hours} ч ${minutes} м`;
        } else if (hours > 0) {
          overtimeText = `+${hours} ч`;
        } else {
          overtimeText = `+${minutes} м`;
        }

        html += `
                    <div class="data-item">
                        <h4><i class="fas fa-calculator"></i> Чистая переработка</h4>
                        <p>${overtimeText}</p>
                        <div class="calculation-info">
                            Расчет: (${dayData.overtimeHours || 0}ч ${dayData.overtimeMinutes || 0}м) - (${dayData.earlyHours || 0}ч ${dayData.earlyMinutes || 0}м) - (${dayData.lateHours || 0}ч ${dayData.lateMinutes || 0}м)
                        </div>
                    </div>
                `;
      } else if (netOvertime < 0) {
        if (hours > 0 && minutes > 0) {
          overtimeText = `-${hours} ч ${minutes} м`;
        } else if (hours > 0) {
          overtimeText = `-${hours} ч`;
        } else {
          overtimeText = `-${minutes} м`;
        }

        html += `
                    <div class="data-item">
                        <h4><i class="fas fa-calculator"></i> Долг</h4>
                        <p>${overtimeText}</p>
                        <div class="calculation-info">
                            Расчет: (${dayData.overtimeHours || 0}ч ${dayData.overtimeMinutes || 0}м) - (${dayData.earlyHours || 0}ч ${dayData.earlyMinutes || 0}м) - (${dayData.lateHours || 0}ч ${dayData.lateMinutes || 0}м)
                        </div>
                    </div>
                `;
      }
    }

    savedDataElement.innerHTML =
      html || "<p>Нет сохраненных данных для этого дня.</p>";
  }

  // Расчет чистой переработки (в минутах)
  function calculateNetOvertime(dayData) {
    const overtimeTotal = TimeUtils.toMinutes(
      dayData.overtimeHours,
      dayData.overtimeMinutes,
    );
    const earlyTotal = TimeUtils.toMinutes(
      dayData.earlyHours,
      dayData.earlyMinutes,
    );
    const lateTotal = TimeUtils.toMinutes(
      dayData.lateHours,
      dayData.lateMinutes,
    );

    return overtimeTotal - earlyTotal - lateTotal;
  }

  // Обновление статистики
  function updateStats() {
    let totalNetOvertimeMinutes = 0;

    // Считаем общую чистую переработку по всем дням
    for (const dateKey in calendarData) {
      const dayData = calendarData[dateKey];
      const netOvertime = calculateNetOvertime(dayData);
      totalNetOvertimeMinutes += netOvertime;
    }

    // Форматируем результат
    const resultText = TimeUtils.formatStats(totalNetOvertimeMinutes);
    document.getElementById("overtimeTotal").textContent = resultText;
  }

  // Обновление расширенной статистики
  function updateAdvancedStats() {
    let totalDays = 0;
    let daysWithOvertime = 0;
    let daysWithEarly = 0;
    let daysWithLate = 0;
    let daysWithComments = 0;
    let totalNetOvertimeMinutes = 0;

    for (const dateKey in calendarData) {
      const dayData = calendarData[dateKey];
      totalDays++;

      if (dayData.overtimeHours > 0 || dayData.overtimeMinutes > 0) {
        daysWithOvertime++;
      }

      if (dayData.earlyHours > 0 || dayData.earlyMinutes > 0) {
        daysWithEarly++;
      }

      if (dayData.lateHours > 0 || dayData.lateMinutes > 0) {
        daysWithLate++;
      }

      if (dayData.comments && dayData.comments.trim() !== "") {
        daysWithComments++;
      }

      totalNetOvertimeMinutes += calculateNetOvertime(dayData);
    }

    // Обновляем элементы статистики
    document.getElementById("daysWithData").textContent = totalDays;
    document.getElementById("daysWithOvertime").textContent = daysWithOvertime;
    document.getElementById("daysWithEarly").textContent = daysWithEarly;
    document.getElementById("daysWithLate").textContent = daysWithLate;
    document.getElementById("daysWithComments").textContent = daysWithComments;

    // Средняя переработка в день
    const avgOvertime =
      totalDays > 0 ? Math.round(totalNetOvertimeMinutes / totalDays) : 0;
    document.getElementById("avgOvertimePerDay").textContent =
      TimeUtils.formatTime(avgOvertime, true);
  }

  // Обновление прогресс-бара
  function updateProgressBar() {
    const daysInMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
    ).getDate();
    let daysWithData = 0;

    // Считаем дни с данными в текущем месяце
    const monthPrefix = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-`;
    for (const dateKey in calendarData) {
      if (dateKey.startsWith(monthPrefix)) {
        daysWithData++;
      }
    }

    const percentage = Math.round((daysWithData / daysInMonth) * 100);
    document.getElementById("monthProgress").textContent = `${percentage}%`;
    document.getElementById("progressFill").style.width = `${percentage}%`;
  }

  // Настройка выпадающего списка месяцев
  function setupMonthDropdown() {
    updateMonthDropdown();
    document.getElementById("currentYear").textContent =
      currentDate.getFullYear();
  }

  // Обновление списка месяцев в выпадающем списке
  function updateMonthDropdown() {
    const monthsGrid = document.getElementById("monthsGrid");
    const year = parseInt(document.getElementById("currentYear").textContent);
    const monthNames = [
      "Январь",
      "Февраль",
      "Март",
      "Апрель",
      "Май",
      "Июнь",
      "Июль",
      "Август",
      "Сентябрь",
      "Октябрь",
      "Ноябрь",
      "Декабрь",
    ];

    monthsGrid.innerHTML = "";

    monthNames.forEach((monthName, index) => {
      const monthOption = document.createElement("div");
      monthOption.classList.add("month-option");

      // Проверяем, является ли месяц текущим
      if (
        year === currentDate.getFullYear() &&
        index === currentDate.getMonth()
      ) {
        monthOption.classList.add("current");
      }

      monthOption.textContent = monthName;

      monthOption.addEventListener("click", function () {
        currentDate = new Date(year, index, 1);
        updateCalendar();
        updateMonthDropdown();

        // Закрываем выпадающий список
        document.getElementById("monthDropdown").classList.remove("show");

        // Выбираем текущий день
        selectDay(new Date(year, index, 1), `${year}-${index + 1}-1`);
      });

      monthsGrid.appendChild(monthOption);
    });
  }

  // Экспорт данных в JSON
  function exportData() {
    const exportData = {
      version: "2.0",
      exportDate: new Date().toISOString(),
      calendarData: calendarData,
      stats: {
        totalOvertime: document.getElementById("overtimeTotal").textContent,
      },
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `production-calendar-export-${new Date().toISOString().split("T")[0]}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification("Данные экспортированы!");
  }

  // Импорт данных из JSON
  function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (Object.keys(calendarData).length > 0) {
      if (!confirm("Текущие данные будут заменены. Продолжить?")) {
        event.target.value = "";
        return;
      }
    }

    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        const importedData = JSON.parse(e.target.result);

        // Валидация импортируемых данных
        if (!validateImportData(importedData)) {
          throw new Error("Некорректный формат файла");
        }

        calendarData = importedData.calendarData || {};

        // Сохраняем в localStorage
        saveData();

        // Создаем резервную копию
        createBackup();

        // Обновляем интерфейс
        updateCalendar();
        updateStats();
        updateAdvancedStats();

        // Выбираем текущий день
        selectDay(
          new Date(),
          `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`,
        );

        showNotification("Данные успешно импортированы!");
      } catch (error) {
        alert("Ошибка при импорте данных: " + error.message);
        console.error("Import error:", error);
      }

      event.target.value = "";
    };

    reader.onerror = function () {
      alert("Ошибка при чтении файла");
      event.target.value = "";
    };

    reader.readAsText(file);
  }

  // Валидация импортируемых данных
  function validateImportData(data) {
    if (!data.calendarData || typeof data.calendarData !== "object") {
      return false;
    }

    const requiredFields = [
      "overtimeHours",
      "overtimeMinutes",
      "earlyHours",
      "earlyMinutes",
      "lateHours",
      "lateMinutes",
      "comments",
    ];

    for (const dateKey in data.calendarData) {
      const dayData = data.calendarData[dateKey];

      // Проверка формата даты
      if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateKey)) {
        return false;
      }

      // Проверка наличия всех полей
      for (const field of requiredFields) {
        if (!(field in dayData)) {
          return false;
        }
      }

      // Проверка типов данных
      if (typeof dayData.comments !== "string") {
        return false;
      }

      // Проверка числовых значений
      const numericFields = requiredFields.filter((f) => f !== "comments");
      for (const field of numericFields) {
        if (typeof dayData[field] !== "number" || dayData[field] < 0) {
          return false;
        }
      }
    }

    return true;
  }

  // Сохранение данных в localStorage с троттлингом
  let saveTimeout;
  function saveData() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      localStorage.setItem(
        "productionCalendarData",
        JSON.stringify(calendarData),
      );
    }, 500);
  }

  // Загрузка данных из localStorage
  function loadData() {
    const savedData = localStorage.getItem("productionCalendarData");
    if (savedData) {
      try {
        calendarData = JSON.parse(savedData);
      } catch (error) {
        console.error("Error loading data from localStorage:", error);
        calendarData = {};
      }
    }
  }

  // Создание резервной копии
  function createBackup() {
    const backup = {
      data: calendarData,
      timestamp: new Date().toISOString(),
      version: "2.0",
    };

    let backups = JSON.parse(localStorage.getItem("calendarBackups") || "[]");
    backups.unshift(backup);

    // Сохраняем только последние 5 бэкапов
    if (backups.length > 5) {
      backups = backups.slice(0, 5);
    }

    localStorage.setItem("calendarBackups", JSON.stringify(backups));
  }

  // Показать модальное окно с резервными копиями
  function showBackupModal() {
    const backups = JSON.parse(localStorage.getItem("calendarBackups") || "[]");
    const backupList = document.getElementById("backupList");

    if (backups.length === 0) {
      backupList.innerHTML = "<p>Нет доступных резервных копий</p>";
    } else {
      backupList.innerHTML = backups
        .map(
          (backup, index) => `
                <div class="backup-item" data-index="${index}">
                    <div class="backup-date">${new Date(backup.timestamp).toLocaleString()}</div>
                    <div class="backup-info">Записей: ${Object.keys(backup.data || {}).length}</div>
                </div>
            `,
        )
        .join("");

      // Добавляем обработчики выбора
      backupList.querySelectorAll(".backup-item").forEach((item) => {
        item.addEventListener("click", function () {
          backupList
            .querySelectorAll(".backup-item")
            .forEach((i) => i.classList.remove("selected"));
          this.classList.add("selected");
        });
      });

      // Выбираем первую копию по умолчанию
      const firstItem = backupList.querySelector(".backup-item");
      if (firstItem) firstItem.classList.add("selected");
    }

    document.getElementById("backupModal").classList.add("show");
  }

  // Скрыть модальное окно
  function hideBackupModal() {
    document.getElementById("backupModal").classList.remove("show");
  }

  // Восстановить из резервной копии
  function restoreBackup() {
    const selectedItem = document.querySelector(".backup-item.selected");
    if (!selectedItem) {
      alert("Выберите резервную копию для восстановления");
      return;
    }

    const index = parseInt(selectedItem.dataset.index);
    const backups = JSON.parse(localStorage.getItem("calendarBackups") || "[]");

    if (backups[index]) {
      if (
        confirm(
          "Восстановить резервную копию от " +
            new Date(backups[index].timestamp).toLocaleString() +
            "? Текущие данные будут заменены.",
        )
      ) {
        calendarData = backups[index].data;

        // Сохраняем в localStorage
        saveData();

        // Обновляем интерфейс
        updateCalendar();
        updateStats();
        updateAdvancedStats();

        // Выбираем текущий день
        selectDay(
          new Date(),
          `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`,
        );

        hideBackupModal();
        showNotification("Данные восстановлены из резервной копии!");
      }
    }
  }

  // Показать уведомление
  function showNotification(message) {
    const oldNotification = document.querySelector(".notification");
    if (oldNotification) oldNotification.remove();

    const notification = document.createElement("div");
    notification.textContent = message;
    notification.classList.add("notification");
    notification.style.cssText = `
            position: fixed;
            top: 30px;
            right: 30px;
            background: linear-gradient(135deg, #2ecc71, #27ae60);
            color: white;
            padding: 16px 28px;
            border-radius: 12px;
            box-shadow: 0 8px 25px rgba(46, 204, 113, 0.4);
            z-index: 1000;
            animation: slideInRight 0.3s ease-out;
            font-weight: 600;
            max-width: 300px;
            word-wrap: break-word;
        `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = "slideOutRight 0.3s ease-out";
      setTimeout(() => {
        if (notification.parentNode) document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  // Функция для получения общей переработки в минутах
  function getTotalNetOvertimeMinutes() {
    let totalNetOvertimeMinutes = 0;

    // Считаем общую чистую переработку по всем дням
    for (const dateKey in calendarData) {
      const dayData = calendarData[dateKey];
      const netOvertime = calculateNetOvertime(dayData);
      totalNetOvertimeMinutes += netOvertime;
    }

    return totalNetOvertimeMinutes;
  }

  // Функция для отображения юмористического алерта
  function showOvertimeHumor() {
    const totalMinutes = getTotalNetOvertimeMinutes();
    const hours = Math.abs(totalMinutes) / 60;

    if (totalMinutes > 0) {
      // Переработка > 0
      alert("Работай раб, солнце еще высоко ☀️");
    } else if (totalMinutes < 0 && hours <= 24) {
      // Долг от 0 до -24 часов
      alert("Сударь, вы начали наглеть 🎩");
    } else if (totalMinutes < 0 && hours > 24) {
      // Долг > 24 часов
      alert("Ты че, ПЁС, совсем АХУЕЛ 😡");
    } else {
      // Нет переработки и нет долга
      alert("Нормалек, работай дальше 👍");
    }
  }

  // Добавляем обработчик клика на статистику переработки
  document
    .getElementById("overtimeTotal")
    .addEventListener("click", showOvertimeHumor);

  // Добавляем стили для анимации уведомлений
  const style = document.createElement("style");
  style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
  document.head.appendChild(style);

  // Делаем статистику кликабельной (добавляем курсор-указатель)
  const statCard = document.querySelector(".stat-card");
  if (statCard) {
    statCard.style.cursor = "pointer";
    statCard.addEventListener("click", showOvertimeHumor);

    // Добавляем эффект при наведении
    statCard.addEventListener("mouseenter", function () {
      this.style.transform = "scale(1.05)";
      this.style.transition = "transform 0.3s ease";
    });

    statCard.addEventListener("mouseleave", function () {
      this.style.transform = "scale(1)";
    });
  }

  // Также делаем кликабельным заголовок статистики
  const statTitle = document.querySelector(".stat-card h3");
  if (statTitle) {
    statTitle.style.cursor = "pointer";
    statTitle.title = "Кликни для мотивации 💪";
  }

  // Добавляем подсказку при наведении на статистику
  const overtimeTotal = document.getElementById("overtimeTotal");
  if (overtimeTotal) {
    overtimeTotal.style.cursor = "pointer";
    overtimeTotal.title = "Кликни для мотивационного сообщения!";

    // Эффект при наведении
    overtimeTotal.addEventListener("mouseenter", function () {
      this.style.color = "#3498db";
      this.style.transition = "color 0.3s ease";
    });

    overtimeTotal.addEventListener("mouseleave", function () {
      this.style.color = "#2c3e50";
    });
  }

  // Выбираем текущий день при загрузке
  selectDay(
    new Date(),
    `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`,
  );
});
