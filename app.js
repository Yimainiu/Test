const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const STORAGE_KEY = "group-availability-planner:schedules";

const participants = [
  { id: "alice", name: "Alice Johnson" },
  { id: "bob", name: "Bob Smith" },
  { id: "chloe", name: "Chloe Martin" },
  { id: "dmitri", name: "Dmitri Lee" },
];

const ADMIN_ID = participants[0]?.id ?? "";
const CURRENT_USER_ID = ADMIN_ID;
let viewedParticipantId = CURRENT_USER_ID;

const schedules = loadSchedules();

const myScheduleGrid = document.getElementById("myScheduleGrid");
const commonAvailabilityGrid = document.getElementById("commonAvailabilityGrid");
const participantList = document.getElementById("participantList");
const deleteScheduleButton = document.getElementById("deleteScheduleButton");
const tabsContainer = document.querySelector(".tabs");
const tabButtons = Array.from(document.querySelectorAll("[data-tab-target]"));
const tabPanels = Array.from(document.querySelectorAll("[data-tab-panel]"));
const tooltip = document.getElementById("commonTimesTooltip");
if (tooltip) {
  tooltip.dataset.visible = "false";
  tooltip.setAttribute("aria-hidden", "true");
}

const isAdmin = CURRENT_USER_ID === ADMIN_ID;

function loadSchedules() {
  const map = new Map();

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      Object.entries(parsed).forEach(([id, slots]) => {
        map.set(id, new Set(slots));
      });
    }
  } catch (error) {
    console.warn("Unable to restore schedules from storage", error);
  }

  if (map.size === 0) {
    return createDefaultSchedules();
  }

  participants.forEach((participant) => {
    if (!map.has(participant.id)) {
      map.set(participant.id, new Set());
    }
  });

  return map;
}

function createDefaultSchedules() {
  const seed = new Map();

  const defaultEntries = {
    alice: [
      [0, [9, 10, 11, 14, 15]],
      [1, [9, 10, 11, 15]],
      [3, [13, 14, 15]],
      [4, [9, 10, 11, 16, 17]],
    ],
    bob: [
      [0, [9, 10, 11, 16]],
      [1, [9, 10, 15, 16]],
      [2, [10, 11, 12, 17]],
      [4, [9, 10, 11, 15]],
    ],
    chloe: [
      [0, [8, 9, 10, 11]],
      [1, [9, 10, 11, 16]],
      [2, [14, 15, 16]],
      [4, [9, 10, 11, 15]],
    ],
    dmitri: [
      [0, [9, 10, 11, 12]],
      [1, [9, 10, 14, 15]],
      [2, [9, 10, 11, 16]],
      [4, [9, 10, 11, 15]],
    ],
  };

  participants.forEach((participant) => {
    const rows = defaultEntries[participant.id] ?? [];
    const slotSet = new Set();
    rows.forEach(([dayIndex, hours]) => {
      hours.forEach((hour) => slotSet.add(slotKey(dayIndex, hour)));
    });
    seed.set(participant.id, slotSet);
  });

  return seed;
}

function saveSchedules() {
  const serialised = {};
  schedules.forEach((slots, participantId) => {
    serialised[participantId] = Array.from(slots);
  });
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialised));
}

function slotKey(dayIndex, hour) {
  return `${dayIndex}:${hour}`;
}

function ensureSchedule(participantId) {
  if (!schedules.has(participantId)) {
    schedules.set(participantId, new Set());
  }
  return schedules.get(participantId);
}

function formatHour(hour) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalised = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalised} ${suffix}`;
}

function formatHourShort(hour) {
  const suffix = hour >= 12 ? "p" : "a";
  const normalised = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalised}${suffix}`;
}

function formatHourRange(hour) {
  const endHour = (hour + 1) % 24;
  return `${formatHour(hour)} – ${formatHour(endHour)}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function renderMyScheduleGrid() {
  const participant = participants.find((item) => item.id === viewedParticipantId);
  const schedule = ensureSchedule(viewedParticipantId);
  const editable = viewedParticipantId === CURRENT_USER_ID;

  myScheduleGrid.innerHTML = "";

  const fragment = document.createDocumentFragment();
  fragment.append(createHeaderRow());

  DAYS.forEach((day, dayIndex) => {
    const row = createRow();
    row.append(createCell("grid__cell grid__cell--day", day));

    HOURS.forEach((hour) => {
      const key = slotKey(dayIndex, hour);
      const isAvailable = schedule.has(key);
      const cellClasses = ["grid__cell"];
      if (isAvailable) {
        cellClasses.push("grid__cell--available");
      } else {
        cellClasses.push("grid__cell--empty");
      }
      if (editable) {
        cellClasses.push("grid__cell--editable");
      }

      const cell = createCell(cellClasses.join(" "));
      cell.dataset.dayIndex = String(dayIndex);
      cell.dataset.hour = String(hour);
      cell.dataset.slotKey = key;
      cell.setAttribute("aria-label", `${day} ${formatHourRange(hour)} availability`);
      cell.setAttribute("role", "button");
      cell.setAttribute("aria-pressed", String(isAvailable));
      cell.tabIndex = editable ? 0 : -1;

      if (editable) {
        cell.addEventListener("click", () => toggleAvailability(key));
        cell.addEventListener("keydown", (event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            toggleAvailability(key);
          }
        });
      }

      row.append(cell);
    });

    fragment.append(row);
  });

  myScheduleGrid.append(fragment);

  const subtitle = document.querySelector("#my-schedule .panel__subtitle");
  if (subtitle && participant) {
    const canEditText = editable
      ? "You're updating your own availability."
      : `Viewing ${participant.name}'s schedule.`;
    const instruction = editable
      ? "Click a time slot to toggle availability."
      : "Slots are read-only when previewing another participant.";
    subtitle.textContent = `${canEditText} ${instruction}`;
  }
}

function renderCommonAvailabilityGrid() {
  commonAvailabilityGrid.innerHTML = "";

  const fragment = document.createDocumentFragment();
  fragment.append(createHeaderRow());

  const totalParticipants = participants.length;

  DAYS.forEach((day, dayIndex) => {
    const row = createRow();
    row.append(createCell("grid__cell grid__cell--day", day));

    HOURS.forEach((hour) => {
      const key = slotKey(dayIndex, hour);
      const availableParticipants = participants.filter((participant) => {
        const participantSchedule = ensureSchedule(participant.id);
        return participantSchedule.has(key);
      });
      const availableNames = availableParticipants.map((participant) => participant.name);
      const availableCount = availableParticipants.length;
      const everyoneAvailable = availableCount === totalParticipants && totalParticipants > 0;
      const hasAvailability = availableCount > 0;

      const cell = createCell("grid__cell");
      cell.dataset.dayIndex = String(dayIndex);
      cell.dataset.hour = String(hour);
      cell.dataset.count = String(availableCount);
      cell.dataset.names = availableNames.join("|");
      cell.setAttribute("tabindex", "0");

      if (everyoneAvailable) {
        cell.classList.add("grid__cell--common-all");
        cell.textContent = "✔";
      } else if (hasAvailability) {
        cell.classList.add("grid__cell--common-partial");
        cell.textContent = String(availableCount);
      } else {
        cell.classList.add("grid__cell--empty");
      }

      const description = hasAvailability
        ? `${availableCount} participant${availableCount === 1 ? "" : "s"} available (${availableNames.join(", ")})`
        : "No participants available";
      cell.setAttribute("aria-label", `${day} ${formatHourRange(hour)} · ${description}`);

      cell.addEventListener("mouseenter", (event) => handleTooltipEnter(event, cell));
      cell.addEventListener("mousemove", handleTooltipMove);
      cell.addEventListener("mouseleave", hideTooltip);
      cell.addEventListener("focus", () => handleTooltipFocus(cell));
      cell.addEventListener("blur", hideTooltip);

      row.append(cell);
    });

    fragment.append(row);
  });

  commonAvailabilityGrid.append(fragment);
  if (tooltip) {
    commonAvailabilityGrid.append(tooltip);
    hideTooltip();
  }
}

function renderParticipantList() {
  participantList.innerHTML = "";
  const template = document.getElementById("participantListItemTemplate");

  participants.forEach((participant) => {
    const schedule = ensureSchedule(participant.id);
    const clone = template.content.firstElementChild.cloneNode(true);
    const button = clone.querySelector(".participant-list__button");
    const badge = clone.querySelector(".participant-list__badge");

    button.textContent = participant.name;
    button.dataset.participantId = participant.id;
    button.setAttribute("aria-current", String(viewedParticipantId === participant.id));
    button.title = `${schedule.size} slot${schedule.size === 1 ? "" : "s"} selected`;

    if (!isAdmin && participant.id !== CURRENT_USER_ID) {
      button.disabled = true;
    }

    if (participant.id === ADMIN_ID && badge) {
      badge.hidden = false;
    }

    button.addEventListener("click", () => {
      if (!isAdmin && participant.id !== CURRENT_USER_ID) {
        return;
      }
      viewedParticipantId = participant.id;
      renderParticipantList();
      renderMyScheduleGrid();
      updateDeleteButton();
    });

    participantList.append(clone);
  });
}

function updateDeleteButton() {
  if (!isAdmin) {
    deleteScheduleButton.hidden = true;
    return;
  }

  deleteScheduleButton.hidden = false;
  const schedule = ensureSchedule(viewedParticipantId);
  const participant = participants.find((item) => item.id === viewedParticipantId);

  deleteScheduleButton.disabled = schedule.size === 0;
  deleteScheduleButton.textContent =
    viewedParticipantId === CURRENT_USER_ID
      ? "Clear my schedule"
      : `Delete ${participant?.name ?? "participant"}'s schedule`;
}

function toggleAvailability(slot) {
  const schedule = ensureSchedule(CURRENT_USER_ID);
  if (schedule.has(slot)) {
    schedule.delete(slot);
  } else {
    schedule.add(slot);
  }
  schedules.set(CURRENT_USER_ID, schedule);
  saveSchedules();
  renderMyScheduleGrid();
  renderCommonAvailabilityGrid();
  renderParticipantList();
  updateDeleteButton();
}

function clearSchedule(participantId) {
  schedules.set(participantId, new Set());
  saveSchedules();
}

function handleTooltipEnter(event, cell) {
  showTooltipForCell(cell, event.clientX, event.clientY);
}

function handleTooltipMove(event) {
  positionTooltip(event.clientX, event.clientY);
}

function handleTooltipFocus(cell) {
  const rect = cell.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;
  showTooltipForCell(cell, clientX, clientY);
}

function showTooltipForCell(cell, clientX, clientY) {
  const names = (cell.dataset.names || "")
    .split("|")
    .map((name) => name.trim())
    .filter(Boolean);
  const dayIndex = Number(cell.dataset.dayIndex);
  const hour = Number(cell.dataset.hour);
  const count = Number(cell.dataset.count ?? "0");

  populateTooltip(dayIndex, hour, names, count);
  tooltip.dataset.visible = "true";
  tooltip.setAttribute("aria-hidden", "false");
  positionTooltip(clientX, clientY);
}

function populateTooltip(dayIndex, hour, names, count) {
  tooltip.innerHTML = "";

  const title = document.createElement("p");
  title.className = "tooltip__title";
  title.textContent = `${DAYS[dayIndex]} · ${formatHourRange(hour)}`;
  tooltip.append(title);

  const subtitle = document.createElement("p");
  subtitle.className = "tooltip__subtitle";
  subtitle.textContent =
    count > 0
      ? `${count} participant${count === 1 ? " is" : "s are"} available`
      : "No one is available in this slot";
  tooltip.append(subtitle);

  if (names.length > 0) {
    const list = document.createElement("ul");
    list.className = "tooltip__list";
    names.forEach((name) => {
      const item = document.createElement("li");
      item.textContent = name;
      list.append(item);
    });
    tooltip.append(list);
  } else {
    const empty = document.createElement("p");
    empty.className = "tooltip__empty";
    empty.textContent = "Everyone is busy.";
    tooltip.append(empty);
  }
}

function positionTooltip(clientX, clientY) {
  const gridRect = commonAvailabilityGrid.getBoundingClientRect();
  const x = clamp(clientX - gridRect.left, 12, gridRect.width - 12);
  const y = clamp(clientY - gridRect.top, 12, gridRect.height - 12);
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
  tooltip.dataset.visible = "true";
}

function hideTooltip() {
  tooltip.dataset.visible = "false";
  tooltip.setAttribute("aria-hidden", "true");
}

function createHeaderRow() {
  const row = createRow();
  row.append(createCell("grid__cell grid__cell--header"));
  HOURS.forEach((hour) => {
    row.append(createCell("grid__cell grid__cell--header", formatHourShort(hour)));
  });
  return row;
}

function createRow() {
  const row = document.createElement("div");
  row.className = "grid__row";
  row.style.display = "contents";
  return row;
}

function createCell(classes, text = "") {
  const cell = document.createElement("div");
  cell.className = classes;
  cell.textContent = text;
  return cell;
}

function setActiveTab(targetId) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tabTarget === targetId;
    button.classList.toggle("tabs__button--active", isActive);
  });

  tabPanels.forEach((panel) => {
    const isActive = panel.id === targetId;
    panel.classList.toggle("tab-panel--active", isActive);
  });

  if (targetId !== "common-times") {
    hideTooltip();
  }
}

tabsContainer.addEventListener("click", (event) => {
  const button = event.target.closest(".tabs__button");
  if (!button) {
    return;
  }
  const targetId = button.dataset.tabTarget;
  if (targetId) {
    setActiveTab(targetId);
  }
});

deleteScheduleButton.addEventListener("click", () => {
  if (!isAdmin) {
    return;
  }
  const participant = participants.find((item) => item.id === viewedParticipantId);
  if (!participant) {
    return;
  }
  const confirmationMessage =
    viewedParticipantId === CURRENT_USER_ID
      ? "Are you sure you want to clear your schedule?"
      : `Delete ${participant.name}'s schedule?`;
  const confirmed = window.confirm(confirmationMessage);
  if (!confirmed) {
    return;
  }
  clearSchedule(viewedParticipantId);
  renderMyScheduleGrid();
  renderCommonAvailabilityGrid();
  renderParticipantList();
  updateDeleteButton();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    hideTooltip();
  }
});

renderParticipantList();
renderMyScheduleGrid();
renderCommonAvailabilityGrid();
updateDeleteButton();

