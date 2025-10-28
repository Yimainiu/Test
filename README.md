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

## Supabase configuration

The planner now syncs events to [Supabase](https://supabase.com) so they can be shared across devices. To enable cloud persistence:

1. Create a Supabase project and generate a table named `events` with the following columns:
   - `id` – `text`, primary key.
   - `data` – `jsonb`, stores the event payload.
2. Copy the project's URL and anon key. Provide them to the app by either:
   - Updating the `<meta name="supabase-url">` and `<meta name="supabase-anon-key">` tags in `index.html`, **or**
   - Defining `window.__SUPABASE_URL__` and `window.__SUPABASE_ANON_KEY__` in a separate script tag that runs before `app.js` loads.
3. Reload the page. Newly created events will be written to Supabase, and opening a shared link will fetch the event from the remote table.

If Supabase credentials are not supplied, the app continues to operate using local storage only. Share links created in that mode will work on the same device but are not synced elsewhere.

## Tooltip details

Hover over any slot in the Common Times grid to display a tooltip listing exactly who is available at that time. Keyboard users can focus the slot to view the same information.
