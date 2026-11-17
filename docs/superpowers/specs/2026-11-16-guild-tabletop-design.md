# Guild registrar tabletop

The user accepted the researched tabletop direction and asked whether pins would disappear. This implementation makes that direction concrete: loose quest papers lie on a warm wooden desk without pins, while retaining the existing sparse layout, top tool rail and right storage drawer.

## Approaches
- Keep a pinned noticeboard: familiar, but inconsistent with the requested loose papers and physical drawer.
- Use a registrar's tabletop (chosen through the user's acceptance): papers lift about the grabbed point, leather folios contain visible sheets and storage remains freely arranged.
- Build a complete 3D room: unnecessary complexity and less usable space.

## Accepted behavior
1. Remove decorative quest pins everywhere; retain freely positioned papers and labels. Update visible placement language to describe the desk.
2. Add restrained grab-dependent paper pitch/roll and shading without changing the grabbed pixel, hit targets, saved coordinates, or folder solidity.
3. Drawer contents respond subtly to drawer movement; motion changes visual offsets only, never storage positions. Stop and clear offsets on cancel, resize, reduced motion, or new gestures.
4. Folio sheet edges reflect the actual number of contained quests (bounded visual layers), and a bookmark recalls the last selected quest during the session, including reopening and temporarily filtering it out. No extra permanent controls.
5. Contact sounds line up with visual contact when paper settles into a drawer or folio; delayed cues are cancellable and respect mute and reduced motion. Existing stamp timing remains aligned.

## Constraints
Local-only static ES modules, no added dependencies, no deployment, no edits to real quest data. Preserve backup format and existing drag cancellation. Respect prefers-reduced-motion. No browser automation: managed denial of the local app origin remains in force. Tests may use synthetic DOM and temporary HTTP servers.

## Validation
Behavioral tests for grip anchoring, drawer cancellation and coordinates, folio memory/filtered counts, and contact-cue cancellation. Run the full Node suite and module syntax checks; distinguish restricted-loopback failures from product failures. Visual and listening review remain unverified without browser access.
