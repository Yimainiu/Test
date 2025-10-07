# Group Availability Planner

A single-page prototype that demonstrates a collaborative weekly scheduling interface. Participants mark their availability on a shared grid, and the app highlights common times for the entire group.

## Features

- **Event setup with admin codes** – Create a new event from the header, receive a unique admin login code, and use it to unlock admin-only tools later.
- **Interactive weekly grid** – Click time slots to toggle availability for the current user.
- **Participant management** – Logged-in admins can review other participants' schedules and clear them if necessary.
- **Common availability view** – The common-times tab visualises overlap across all schedules and supports detailed hover tooltips.
- **Persistent data** – Event details, participants, and schedules are saved to `localStorage`, so selections remain between visits on the same device.

## Getting started

Open `index.html` in a browser to explore the interface. On first load you'll be asked to name the event and yourself; the generated admin code unlocks the admin controls on future visits. No build step is required.

## Tooltip details

Hover over any slot in the Common Times grid to display a tooltip listing exactly who is available at that time. Keyboard users can focus the slot to view the same information.
