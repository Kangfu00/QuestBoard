/**
 * Canonical motion durations (ms) and easing curves for The Questboard.
 * Mirrors the CSS custom properties in dist/motion-tokens.css so every module
 * and agent shares one consistent physical feel across the guild tabletop.
 */
export const MOTION_DURATION = Object.freeze({
  dialog: 180,
  approach: 180,
  settle: 210,
  paperDrop: 230,
  pageTurn: 240,
  photoLift: 260,
  hoverTarget: 260,
  storeFeed: 300,
  stampReturn: 320,
  drawer: 380,
  stampIn: 380,
  folderInsert: 430,
  retrieve: 600,
  paperTurn: 780,
  questUnlock: 780,
  folioClose: 880,
  folioOpen: 1020,
  reducedFade: 120,
});

export const MOTION_EASING = Object.freeze({
  /** Primary deceleration curve: quick start, natural friction stop. */
  slide: 'cubic-bezier(.22,.8,.24,1)',
  /** Hover affordance (folder lid lift, photo lift). */
  hover: 'cubic-bezier(.2,.75,.25,1)',
  /** Paper landing and settle into place. */
  settle: 'cubic-bezier(.2,.8,.3,1)',
  /** Approaching a drawer mouth before slipping under the wood lip. */
  approach: 'cubic-bezier(.2,.72,.3,1)',
  /** Feeding into a drawer slot under the wood lip. */
  feed: 'cubic-bezier(.36,.08,.5,1)',
  /** Unfolding a newly created sheet onto the desk. */
  unfold: 'cubic-bezier(.16,.75,.28,1)',
  /** Curved paper flip across front and back faces. */
  turn: 'cubic-bezier(.32,.05,.24,1)',
  /** Dependency knot unlock flourish. */
  unlock: 'cubic-bezier(.2,.65,.25,1)',
  /** Quiet UI dialog or subtle return. */
  uiOut: 'ease-out',
  uiIn: 'ease-in',
});

export const MOTION_TIMING = Object.freeze({
  approach: Object.freeze({ duration: MOTION_DURATION.approach, easing: MOTION_EASING.approach }),
  feed: Object.freeze({ duration: MOTION_DURATION.storeFeed, easing: MOTION_EASING.feed }),
  retrieve: Object.freeze({ duration: MOTION_DURATION.retrieve, easing: MOTION_EASING.unfold }),
  paperTurn: Object.freeze({ duration: MOTION_DURATION.paperTurn, easing: MOTION_EASING.turn, fill: 'both' }),
  questUnlock: Object.freeze({ duration: MOTION_DURATION.questUnlock, easing: MOTION_EASING.unlock, fill: 'both' }),
  photoLift: Object.freeze({ duration: MOTION_DURATION.photoLift, easing: MOTION_EASING.hover, fill: 'both' }),
  paperweightLand: Object.freeze({ duration: MOTION_DURATION.settle, easing: MOTION_EASING.uiOut }),
  notebookLeaf: Object.freeze({ duration: MOTION_DURATION.pageTurn, easing: MOTION_EASING.uiOut }),
  stampReturn: Object.freeze({ duration: MOTION_DURATION.stampReturn, easing: MOTION_EASING.uiIn, fill: 'forwards' }),
});
