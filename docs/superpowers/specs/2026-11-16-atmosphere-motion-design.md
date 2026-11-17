# Fine dust and animated guild light

User feedback: the enlarged dust grains look too big; atmosphere should animate. Continue the existing local desk design, retaining density, four time phases and all audio behavior.

Use fine 0.70–1.60px grains with no visible glow, varied translucency and gentle drift. Keep the existing density default39/max60, preferences and particle identity behavior. Morning/evening sun bands slowly shift; broad soft cloud shadows pass during daylight; independent warm pools gently flicker at night. Motion stays under the paper canvas and never transforms the board or document windows.

Approaches: JavaScript frame loops/canvas would add unnecessary lifecycle and rendering work; animating the whole board would move papers. Choose CSS animations on existing decorative phase pseudo-elements, using transform/opacity and no dependencies or per-frame JavaScript. Root selects this routine implementation within the requested animation change.

Existing visibility state pauses every decorative animation. Inactive phase animations stay paused; reduced motion keeps static lighting and removes dust/flicker, transitions and decorative movement. No new controls, sound changes, data/schema changes or publishing. Manual phase choices remain a convenient way to preview each atmosphere.

Native visual judgment remains limited by the existing browser access denial; automatic tests verify controller behavior, while source review checks CSS/lifecycle composition. Avoid snapshot tests that merely copy CSS values.
