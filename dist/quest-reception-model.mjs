/**
 * Checks whether an item is eligible for quest reception turn-in.
 * An item is eligible if it exists, is of type 'quest', and is not archived.
 * @param {object|null|undefined} item - The board item to check.
 * @returns {boolean} True if eligible for submission.
 */
export function canReceiveQuest(item) {
  if (!item || typeof item !== 'object') return false;
  return item.type === 'quest' && !item.archived;
}
