/**
 * The Questboard — Guild Chronicle Model
 * Data normalization, querying, statistics and state transitions for completed quests.
 */

import { updateItem, setItemStatus, setArchived } from './model.mjs';

const prioritiesToRank = {
  high: 'A',
  normal: 'B',
  low: 'C',
};

/**
 * Checks whether an item is recorded in the Guild Chronicle.
 * A quest belongs in the Chronicle if it is a completed quest that has been turned in or archived.
 */
export function isChronicleEligible(item) {
  if (!item || item.type !== 'quest') return false;
  return item.status === 'done' && (item.turnedIn === true || item.archived === true);
}

/**
 * Queries and filters completed quests recorded in the Chronicle.
 *
 * @param {Array<Object>} items - State items array.
 * @param {Object} [filters]
 * @param {string} [filters.search=''] - Substring to search across title, description, category and notes.
 * @param {string} [filters.category='all'] - Specific quest category or 'all'.
 * @param {string} [filters.rank='all'] - Specific rank ('A', 'B', 'C', 'S') or 'all'.
 * @returns {Array<Object>} Filtered quests sorted newest to oldest.
 */
export function chronicleQuests(items = [], { search = '', category = 'all', rank = 'all' } = {}) {
  const term = search.trim().toLocaleLowerCase('th');
  const targetCategory = category.trim();
  const targetRank = rank.trim().toUpperCase();

  return items
    .filter(isChronicleEligible)
    .filter(q => {
      if (targetCategory && targetCategory !== 'all' && q.category !== targetCategory) {
        return false;
      }
      if (targetRank && targetRank !== 'ALL') {
        const itemRank = prioritiesToRank[q.priority] || q.rank || 'B';
        if (itemRank.toUpperCase() !== targetRank) return false;
      }
      if (term) {
        const title = (q.title || '').toLocaleLowerCase('th');
        const desc = (q.description || '').toLocaleLowerCase('th');
        const cat = (q.category || '').toLocaleLowerCase('th');
        const notes = (q.notes || '').toLocaleLowerCase('th');
        if (!title.includes(term) && !desc.includes(term) && !cat.includes(term) && !notes.includes(term)) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      const timeA = a.turnedInAt ? new Date(a.turnedInAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.turnedInAt ? new Date(b.turnedInAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeB - timeA;
    });
}

/**
 * Calculates aggregate stats for all completed quests in the Chronicle.
 */
export function chronicleStats(items = []) {
  const eligible = items.filter(isChronicleEligible);
  let totalXp = 0;
  const byCategory = {};
  const byRank = { A: 0, B: 0, C: 0, S: 0 };

  for (const q of eligible) {
    const xp = typeof q.xp === 'number' && !Number.isNaN(q.xp) ? q.xp : 50;
    totalXp += xp;

    const cat = q.category || 'ทั่วไป';
    byCategory[cat] = (byCategory[cat] || 0) + 1;

    const rank = (prioritiesToRank[q.priority] || q.rank || 'B').toUpperCase();
    byRank[rank] = (byRank[rank] || 0) + 1;
  }

  return {
    totalQuests: eligible.length,
    totalXp,
    byCategory,
    byRank,
  };
}

/**
 * Reopens a completed quest from the Chronicle, returning it to active duty on the desk.
 */
export function reopenQuest(state, id) {
  const item = state.items.find(i => i.id === id);
  if (!item || item.type !== 'quest') return state;
  let next = setItemStatus(state, id, 'active');
  next = setArchived(next, id, false);
  return updateItem(next, id, {
    turnedIn: false,
    turnedInAt: null,
  });
}

/**
 * Marks a quest as turned in at the reception counter, recording it to the Chronicle.
 */
export function markQuestTurnedIn(state, id, turnedInAt = new Date().toISOString()) {
  const item = state.items.find(i => i.id === id);
  if (!item || item.type !== 'quest') return state;
  let next = setItemStatus(state, id, 'done');
  next = setArchived(next, id, true);
  return updateItem(next, id, {
    turnedIn: true,
    turnedInAt,
  });
}
