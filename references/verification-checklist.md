# Verification checklist

## Static checks

- Output is one HTML file.
- No `localhost`, development port, source-map path, or original filesystem path remains.
- No unresolved stylesheet, script, image, font, icon, manifest, or media resource remains.
- No token, cookie, authorization header, private payload, email list, or personal data is embedded.
- No unresolved module import or dynamic chunk remains.
- Expected route strings and visible copy are present.

## Browser checks

Open the output with `file://` after stopping all dev servers.

- Initial screen renders without a blank or permanent loading state.
- Required routes are reachable by visible controls.
- Back and forward work.
- Refresh and direct hash entry work.
- Buttons, tabs, menus, dialogs, forms, and downloads behave as agreed.
- Desktop and narrow layouts remain usable.
- Images and fonts render.
- No unexpected console errors occur.
- No unapproved network request occurs.
- Offline API states are product copy, not raw transport errors.

## Visual comparison

Compare the same route, viewport, data, and state.

- shell and navigation;
- typography and spacing;
- colors and borders;
- overflow and scroll ownership;
- active, hover, loading, empty, error, and disabled states;
- long content and responsive collapse.

## Report language

Report these separately:

- **Created**: the file exists.
- **Static audit passed**: unresolved assets and forbidden references were not found.
- **Browser verified**: named routes and interactions were exercised through `file://`.
- **Backend connected**: only when real requests succeeded.

Never substitute one status for another.
