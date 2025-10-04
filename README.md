# Group Availability Planner

A single-page prototype that demonstrates a collaborative weekly scheduling interface. Participants mark their availability on a shared grid, and the app highlights common times for the entire group.

## Features

- **Interactive weekly grid** – Click time slots to toggle availability for the current user.
- **Participant management** – Admins can review other participants' schedules and clear them if necessary.
- **Common availability view** – The common-times tab visualises overlap across all schedules and now supports detailed hover tooltips.
- **Persistent data** – Schedules are saved to `localStorage`, so selections remain between visits.

## Getting started

Open `index.html` in a browser to explore the interface. No build step is required.

## Tooltip details

Hover over any slot in the Common Times grid to display a tooltip listing exactly who is available at that time. Keyboard users can focus the slot to view the same information.
