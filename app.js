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

const STORAGE_NAMESPACE = "group-availability-planner";
const CURRENT_EVENT_KEY = `${STORAGE_NAMESPACE}:current-event-id`;
const EVENT_KEY_PREFIX = `${STORAGE_NAMESPACE}:event:`;
const USER_KEY_PREFIX = `${STORAGE_NAMESPACE}:user:`;
const ADMIN_SESSION_PREFIX = `${STORAGE_NAMESPACE}:admin-session:`;

let eventState = null;
let schedules = new Map();
let participants = [];
let ADMIN_ID = "";
let CURRENT_USER_ID = "";
let viewedParticipantId = "";
let adminSessionActive = false;
let isAdmin = false;

const myScheduleGrid = document.getElementById("myScheduleGrid");
const commonAvailabilityGrid = document.getElementById("commonAvailabilityGrid");
const participantList = document.getElementById("participantList");
const deleteScheduleButton = document.getElementById("deleteScheduleButton");
const tabsContainer = document.querySelector(".tabs");
const tabButtons = Array.from(document.querySelectorAll("[data-tab-target]"));
const tabPanels = Array.from(document.querySelectorAll("[data-tab-panel]"));
const tooltip = document.getElementById("commonTimesTooltip");
const eventNameDisplay = document.getElementById("eventNameDisplay");
const currentUserDisplay = document.getElementById("currentUserDisplay");
const adminCodeNotice = document.getElementById("adminCodeNotice");
const createEventButton = document.getElementById("createEventButton");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminCodeInput = document.getElementById("adminCodeInput");
const adminStatusText = document.getElementById("adminStatusText");
const adminLoginError = document.getElementById("adminLoginError");
const adminLogoutButton = document.getElementById("adminLogoutButton");
if (tooltip) {
  tooltip.dataset.visible = "false";
  tooltip.setAttribute("aria-hidden", "true");
}

if (createEventButton) {
  createEventButton.addEventListener("click", handleCreateEventClick);
}

if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", handleAdminLoginSubmit);
}

if (adminLogoutButton) {
  adminLogoutButton.addEventListener("click", handleAdminLogout);
}

function eventStorageKey(eventId) {
  return `${EVENT_KEY_PREFIX}${eventId}`;
}

function userStorageKey(eventId) {
  return `${USER_KEY_PREFIX}${eventId}`;
}

function adminSessionKey(eventId) {
  return `${ADMIN_SESSION_PREFIX}${eventId}`;
}

function persistEvent(event) {
  window.localStorage.setItem(eventStorageKey(event.id), JSON.stringify(event));
}

function applyEventState(event) {
  eventState = event;
  if (!Array.isArray(eventState.participants)) {
    eventState.participants = [];
  }
  participants = eventState.participants;

  const scheduleSource = eventState.schedules ?? {};
  schedules = new Map();

  participants.forEach((participant) => {
    const rawSlots = Array.isArray(scheduleSource[participant.id])
      ? scheduleSource[participant.id]
      : [];
    schedules.set(participant.id, new Set(rawSlots));
  });

  Object.entries(scheduleSource).forEach(([participantId, rawSlots]) => {
    if (!schedules.has(participantId)) {
      schedules.set(
        participantId,
        new Set(Array.isArray(rawSlots) ? rawSlots : [])
      );
    }
  });

  ADMIN_ID = eventState.adminParticipantId ?? "";
}

function saveEventState() {
  if (!eventState) {
    return;
  }

  const serialisedSchedules = {};
  schedules.forEach((slots, participantId) => {
    serialisedSchedules[participantId] = Array.from(slots).sort();
  });

  eventState.schedules = serialisedSchedules;
  eventState.participants = participants;

  persistEvent(eventState);
}

function loadExistingEvent() {
  try {
    const eventId = window.localStorage.getItem(CURRENT_EVENT_KEY);
    if (!eventId) {
      return null;
    }

    const raw = window.localStorage.getItem(eventStorageKey(eventId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    parsed.id = eventId;
    if (!Array.isArray(parsed.participants)) {
      parsed.participants = [];
    }
    if (typeof parsed.schedules !== "object" || parsed.schedules === null) {
      parsed.schedules = {};
    }
    return parsed;
  } catch (error) {
    console.warn("Unable to load event state", error);
    return null;
  }
}

function promptForValue(message, fallback) {
  const value = window.prompt(message, fallback ?? "");
  if (typeof value !== "string") {
    return fallback ?? "";
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback ?? "";
}

function normaliseName(name, fallback = "Guest") {
  const trimmed = (name ?? "").trim();
  if (!trimmed) {
    return fallback;
  }
  return trimmed.replace(/\s+/g, " ");
}

function generateId(prefix) {
  const randomPart = Math.random().toString(36).slice(2, 8);
  const timePart = Date.now().toString(36).slice(-4);
  return `${prefix}-${randomPart}${timePart}`;
}

function generateAdminCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function createParticipant(name) {
  return {
    id: generateId("participant"),
    name: normaliseName(name, "Guest"),
  };
}

function createEventData({ eventName, adminName }) {
  const adminParticipant = createParticipant(adminName);
  const eventId = generateId("event");
  const adminCode = generateAdminCode();
  return {
    id: eventId,
    name: normaliseName(eventName, "Untitled event"),
    adminCode,
    adminParticipantId: adminParticipant.id,
    participants: [adminParticipant],
    schedules: {
      [adminParticipant.id]: [],
    },
  };
}

function clearEventSpecificState(eventId) {
  if (!eventId) {
    return;
  }
  window.localStorage.removeItem(userStorageKey(eventId));
  window.localStorage.removeItem(adminSessionKey(eventId));
}

function promptCreateEvent() {
  const eventName = promptForValue("Name your event:", "Team availability");
  const adminName = promptForValue(
    "Enter your name (you will be the admin):",
    "Event host"
  );

  const event = createEventData({ eventName, adminName });
  persistEvent(event);
  window.localStorage.setItem(CURRENT_EVENT_KEY, event.id);
  applyEventState(event);

  CURRENT_USER_ID = event.adminParticipantId;
  viewedParticipantId = CURRENT_USER_ID;
  adminSessionActive = true;
  refreshAdminState();

  window.localStorage.setItem(userStorageKey(event.id), CURRENT_USER_ID);
  window.localStorage.setItem(adminSessionKey(event.id), CURRENT_USER_ID);

  if (typeof window.alert === "function") {
    window.alert(
      `Your admin code is ${event.adminCode}. Keep it somewhere safe to log in as admin later.`
    );
  }

  return event;
}

function ensureCurrentUserId() {
  if (!eventState) {
    return "";
  }

  const key = userStorageKey(eventState.id);
  const storedId = window.localStorage.getItem(key);
  const existingParticipant = participants.find(
    (participant) => participant.id === storedId
  );

  if (existingParticipant) {
    return existingParticipant.id;
  }

  const name = promptForValue(
    `Enter your name to join "${eventState.name ?? "Untitled event"}":`,
    "Guest"
  );

  const participant = createParticipant(name);
  participants.push(participant);
  schedules.set(participant.id, new Set());
  saveEventState();
  window.localStorage.setItem(key, participant.id);
  return participant.id;
}

function loadAdminSessionForCurrentUser() {
  if (!eventState) {
    return false;
  }

  const stored = window.localStorage.getItem(adminSessionKey(eventState.id));
  return stored === CURRENT_USER_ID;
}

function refreshAdminState() {
  isAdmin = CURRENT_USER_ID === ADMIN_ID && adminSessionActive;
}

function updateEventDetails() {
  if (eventNameDisplay) {
    eventNameDisplay.textContent = eventState?.name || "Untitled event";
  }

  if (currentUserDisplay) {
    const participant = participants.find(
      (item) => item.id === CURRENT_USER_ID
    );
    const baseName = participant ? participant.name : "";
    const roleLabel =
      CURRENT_USER_ID === ADMIN_ID
        ? isAdmin
          ? "Admin (unlocked)"
          : "Admin (locked)"
        : "Participant";
    currentUserDisplay.textContent = baseName
      ? `Signed in as ${baseName} · ${roleLabel}`
      : roleLabel;
  }

  if (adminCodeNotice) {
    if (isAdmin && eventState?.adminCode) {
      adminCodeNotice.hidden = false;
      adminCodeNotice.textContent = `Admin code: ${eventState.adminCode}`;
    } else {
      adminCodeNotice.hidden = true;
      adminCodeNotice.textContent = "";
    }
  }
}

function updateAdminUi() {
  if (!eventState) {
    return;
  }

  if (adminStatusText) {
    if (isAdmin) {
      adminStatusText.textContent = "Admin tools unlocked.";
    } else if (CURRENT_USER_ID === ADMIN_ID) {
      adminStatusText.textContent = "Enter the admin code to unlock admin tools.";
    } else {
      adminStatusText.textContent = "Admin tools are reserved for the event creator.";
    }
  }

  if (adminLoginForm) {
    adminLoginForm.hidden = isAdmin || CURRENT_USER_ID !== ADMIN_ID;
  }

  if (adminLogoutButton) {
    adminLogoutButton.hidden = !isAdmin;
  }

  if (adminLoginError) {
    adminLoginError.hidden = true;
    adminLoginError.textContent = "";
  }

  if (adminCodeInput) {
    adminCodeInput.value = "";
  }
}

function handleAdminLoginSubmit(event) {
  event.preventDefault();

  if (!eventState || CURRENT_USER_ID !== ADMIN_ID) {
    return;
  }

  const code = adminCodeInput?.value?.trim();
  if (!code) {
    if (adminLoginError) {
      adminLoginError.hidden = false;
      adminLoginError.textContent = "Enter the admin code to continue.";
    }
    return;
  }

  if (code === eventState.adminCode) {
    window.localStorage.setItem(adminSessionKey(eventState.id), CURRENT_USER_ID);
    adminSessionActive = true;
    refreshAdminState();
    updateEventDetails();
    updateAdminUi();
    renderParticipantList();
    updateDeleteButton();
  } else if (adminLoginError) {
    adminLoginError.hidden = false;
    adminLoginError.textContent = "Incorrect admin code.";
  }
}

function handleAdminLogout() {
  if (!eventState) {
    return;
  }

  window.localStorage.removeItem(adminSessionKey(eventState.id));
  adminSessionActive = false;
  refreshAdminState();
  updateEventDetails();
  updateAdminUi();
  renderParticipantList();
  updateDeleteButton();
}

function handleCreateEventClick() {
  const proceed = window.confirm(
    "Creating a new event will replace the current schedules stored on this device. Continue?"
  );
  if (!proceed) {
    return;
  }

  clearEventSpecificState(eventState?.id);
  promptCreateEvent();
  updateEventDetails();
  updateAdminUi();
  renderParticipantList();
  renderMyScheduleGrid();
  renderCommonAvailabilityGrid();
  updateDeleteButton();
  setActiveTab("my-schedule");
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
  saveEventState();
  renderMyScheduleGrid();
  renderCommonAvailabilityGrid();
  renderParticipantList();
  updateDeleteButton();
}

function clearSchedule(participantId) {
  schedules.set(participantId, new Set());
  saveEventState();
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

function initialiseApp() {
  let event = loadExistingEvent();
  let created = false;

  if (!event) {
    event = promptCreateEvent();
    created = true;
  } else {
    applyEventState(event);
  }

  if (!created) {
    CURRENT_USER_ID = ensureCurrentUserId();
    viewedParticipantId = CURRENT_USER_ID;
    adminSessionActive = loadAdminSessionForCurrentUser();
    refreshAdminState();
  }

  if (!viewedParticipantId) {
    viewedParticipantId = CURRENT_USER_ID;
  }

  updateEventDetails();
  updateAdminUi();
  renderParticipantList();
  renderMyScheduleGrid();
  renderCommonAvailabilityGrid();
  updateDeleteButton();
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

if (tabsContainer) {
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
}

if (deleteScheduleButton) {
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
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    hideTooltip();
  }
});

initialiseApp();

