/**
 * The Questboard — The Guild Chronicle (สมุดบันทึกประวัติศาสตร์การผจญภัย)
 * Component providing an interactive two-page fantasy tome to inspect, search,
 * and manage all completed and turned-in guild quests.
 */

import { chronicleQuests, chronicleStats, reopenQuest } from './guild-chronicle-model.mjs';

const escapeHtml = value =>
  String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));

function formatDate(isoString) {
  if (!isoString) return 'ไม่มีบันทึกเวลา';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return String(isoString);
    return d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(isoString);
  }
}

/**
 * Creates and manages the Guild Chronicle Tome window.
 *
 * @param {object} options
 * @param {Document} [options.document]
 * @param {Window} [options.window]
 * @param {object} [options.windows] - Desk windows manager (createDeskWindows).
 * @param {Function} [options.getState] - Returns current app state.
 * @param {Function} [options.commit] - State commit callback: commit(nextState).
 * @param {Function} [options.renderQuest] - Authentic quest HTML renderer: renderQuest(quest).
 * @param {Function} [options.icon] - Icon lookup function: icon(name).
 * @param {Function} [options.onCue] - Sound playback callback: onCue(name).
 * @param {Function} [options.reducedMotion] - Predicate returning true when reduced motion is preferred.
 * @param {Function} [options.onReopen] - Callback invoked when a quest is reopened: onReopen(quest).
 */
export function createGuildChronicle({
  document = globalThis.document,
  window = globalThis.window,
  windows = null,
  getState = () => ({ items: [] }),
  commit = () => {},
  renderQuest = null,
  icon = () => '',
  onCue = () => {},
  reducedMotion = () => false,
  onReopen = () => {},
} = {}) {
  if (!document) {
    return {
      element: null,
      open: () => {},
      close: () => {},
      toggle: () => {},
      isOpen: false,
      refresh: () => {},
      destroy: () => {},
    };
  }

  const isReduced = () => {
    try {
      return typeof reducedMotion === 'function' ? reducedMotion() : Boolean(reducedMotion);
    } catch {
      return false;
    }
  };

  let panel = null;
  let registration = null;
  let isOpenState = false;
  let selectedQuestId = null;
  let currentSearch = '';
  let currentRank = 'all';

  const bookIcon = icon('book') || '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';
  const searchIcon = icon('search') || '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  const shieldIcon = icon('shield') || '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
  const restoreIcon = icon('restore') || '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';

  function buildWindowMarkup() {
    return `
      <header class="chronicle-header" data-desk-window-handle>
        <div class="chronicle-header-title">
          <span class="chronicle-header-icon" aria-hidden="true">${bookIcon}</span>
          <div class="chronicle-header-text">
            <h2>The Guild Chronicle</h2>
            <small>สมุดบันทึกประวัติศาสตร์เกียรติยศนักผจญภัย</small>
          </div>
        </div>
        <div class="chronicle-header-actions">
          <button type="button" class="chronicle-close-btn" data-action="close" aria-label="ปิดสมุดประวัติศาสตร์ (Esc)" title="ปิดสมุดประวัติศาสตร์ (Esc)">✕</button>
        </div>
      </header>

      <div class="chronicle-spread">
        <div class="chronicle-spine-crease" aria-hidden="true"></div>

        <!-- Left Page: Chronicle Index & Ledger -->
        <section class="chronicle-left" aria-label="ทะเบียนภารกิจที่สำเร็จ">
          <div class="chronicle-stats-card">
            <div class="chronicle-stat-item">
              <span class="chronicle-stat-label">ภารกิจที่สำเร็จ</span>
              <strong class="chronicle-stat-value" data-stat-total>0 เควส</strong>
            </div>
            <div class="chronicle-stat-item" style="text-align: right;">
              <span class="chronicle-stat-label">XP สะสมทั้งหมด</span>
              <strong class="chronicle-stat-value xp-value" data-stat-xp>0 XP</strong>
            </div>
          </div>

          <div class="chronicle-toolbar">
            <div class="chronicle-search-box">
              <span class="chronicle-search-icon" aria-hidden="true">${searchIcon}</span>
              <input type="search" class="chronicle-search-input" placeholder="ค้นหาตามชื่อ, หมวดหมู่, โน้ต..." aria-label="ค้นหาเควสในสมุดประวัติศาสตร์" />
            </div>
            <div class="chronicle-filter-pills" role="radiogroup" aria-label="กรองตามระดับความสำคัญ">
              <button type="button" class="chronicle-pill is-active" data-rank="all">ทั้งหมด</button>
              <button type="button" class="chronicle-pill" data-rank="S">Rank S</button>
              <button type="button" class="chronicle-pill" data-rank="A">Rank A</button>
              <button type="button" class="chronicle-pill" data-rank="B">Rank B</button>
              <button type="button" class="chronicle-pill" data-rank="C">Rank C</button>
            </div>
          </div>

          <div class="chronicle-list" role="listbox" aria-label="รายการเควสสำเร็จ"></div>
        </section>

        <!-- Right Page: Quest Showcase -->
        <section class="chronicle-right" aria-label="หน้าจัดแสดงใบเควสตัวจริง">
          <div class="chronicle-showcase-container">
            <div class="chronicle-paper-stage" data-showcase-stage>
              <!-- Authentic Quest Sheet Mounts Here -->
            </div>
          </div>
          <footer class="chronicle-showcase-footer">
            <button type="button" class="chronicle-reopen-btn" data-action="reopen" title="นำเควสนี้กลับขึ้นสู่บอร์ดเพื่อทำต่อ">
              ${restoreIcon} <span>นำเควสกลับมาทำใหม่</span>
            </button>
            <span class="chronicle-timestamp-label" data-timestamp-label></span>
          </footer>
        </section>
      </div>
    `;
  }

  function getRank(quest) {
    const p = quest.priority || 'normal';
    if (p === 'high') return 'A';
    if (p === 'low') return 'C';
    return (quest.rank || 'B').toUpperCase();
  }

  function renderShowcase(quest) {
    if (!panel) return;
    const stage = panel.querySelector('[data-showcase-stage]');
    const footer = panel.querySelector('.chronicle-showcase-footer');
    const timestampLabel = panel.querySelector('[data-timestamp-label]');
    if (!stage) return;

    if (!quest) {
      stage.innerHTML = `
        <div class="chronicle-empty">
          <div class="chronicle-empty-icon">${bookIcon}</div>
          <div class="chronicle-empty-title">เลือกเควสจากรายการด้านซ้าย</div>
          <p class="chronicle-empty-desc">คลิกเลือกเควสที่ต้องการดู เพื่อตรวจดูใบเควสตัวจริงและโน้ตที่บันทึกไว้</p>
        </div>
      `;
      if (footer) footer.style.display = 'none';
      return;
    }

    if (footer) footer.style.display = 'flex';

    // Render authentic quest parchment
    let questHtml = '';
    if (typeof renderQuest === 'function') {
      try {
        questHtml = renderQuest(quest);
      } catch {
        questHtml = '';
      }
    }

    if (!questHtml) {
      questHtml = `
        <article class="board-item quest-paper priority-${quest.priority || 'normal'}" style="width:300px;min-height:424px;">
          <header class="quest-paper-header">
            <span class="quest-category">${escapeHtml(quest.category || 'ภารกิจ')}</span>
            <span class="quest-rank rank-${getRank(quest)}">RANK ${getRank(quest)}</span>
          </header>
          <h3 class="quest-title">${escapeHtml(quest.title)}</h3>
          <p class="quest-desc">${escapeHtml(quest.description || '')}</p>
        </article>
      `;
    }

    const sealHtml = `
      <div class="chronicle-accepted-seal" aria-label="ประทับตรากิลด์อนุมัติแล้ว">
        <span class="chronicle-seal-icon">${shieldIcon}</span>
        <strong class="chronicle-seal-title">GUILD ACCEPTED</strong>
        <span class="chronicle-seal-thai">อนุมัติแล้ว · สำเร็จ</span>
        <span class="chronicle-seal-dept">Quest Archives Dept.</span>
      </div>
    `;

    stage.innerHTML = questHtml + sealHtml;

    if (timestampLabel) {
      const timeStr = formatDate(quest.turnedInAt || quest.createdAt);
      timestampLabel.textContent = `ส่งมอบเมื่อ: ${timeStr}`;
    }
  }

  function renderLedger() {
    if (!panel) return;
    const state = getState();
    const allItems = state.items || [];
    const stats = chronicleStats(allItems);
    const filtered = chronicleQuests(allItems, {
      search: currentSearch,
      rank: currentRank,
    });

    // Update stats
    const totalEl = panel.querySelector('[data-stat-total]');
    const xpEl = panel.querySelector('[data-stat-xp]');
    if (totalEl) totalEl.textContent = `${stats.totalQuests.toLocaleString()} เควส`;
    if (xpEl) xpEl.textContent = `${stats.totalXp.toLocaleString()} XP`;

    const listEl = panel.querySelector('.chronicle-list');
    if (!listEl) return;

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="chronicle-empty">
          <div class="chronicle-empty-icon">${shieldIcon}</div>
          <div class="chronicle-empty-title">ไม่พบเควสที่ตรงกับเงื่อนไข</div>
          <p class="chronicle-empty-desc">
            ${stats.totalQuests === 0
              ? 'ยังไม่มีเควสที่บันทึกในสมุดประวัติศาสตร์ นำเควสที่ทำสำเร็จแล้วมาส่งมอบที่เคาน์เตอร์ฝั่งซ้ายได้เลย!'
              : 'ลองเปลี่ยนคำค้นหา หรือเลือกระดับแรงก์อื่น'}
          </p>
        </div>
      `;
      selectedQuestId = null;
      renderShowcase(null);
      return;
    }

    // Determine currently selected quest
    let selectedQuest = filtered.find(q => q.id === selectedQuestId);
    if (!selectedQuest) {
      selectedQuest = filtered[0];
      selectedQuestId = selectedQuest.id;
    }

    listEl.innerHTML = filtered.map(quest => {
      const isSelected = quest.id === selectedQuestId;
      const rank = getRank(quest);
      const xp = typeof quest.xp === 'number' && !Number.isNaN(quest.xp) ? quest.xp : 50;
      const dateStr = formatDate(quest.turnedInAt || quest.createdAt);

      return `
        <button type="button"
          class="chronicle-row ${isSelected ? 'is-selected' : ''}"
          data-quest-id="${escapeHtml(quest.id)}"
          role="option"
          aria-selected="${isSelected}"
          aria-label="${escapeHtml(quest.title)} (Rank ${rank}, +${xp} XP)">
          <div class="chronicle-row-main">
            <span class="chronicle-rank-badge rank-${rank}">${rank}</span>
            <div class="chronicle-row-details">
              <strong class="chronicle-row-title">${escapeHtml(quest.title)}</strong>
              <div class="chronicle-row-meta">
                <span class="chronicle-row-tag">${escapeHtml(quest.category || 'ทั่วไป')}</span>
                <span class="chronicle-row-date">${escapeHtml(dateStr)}</span>
              </div>
            </div>
          </div>
          <div class="chronicle-row-side">
            <span class="chronicle-row-xp">+${xp} XP</span>
          </div>
        </button>
      `;
    }).join('');

    renderShowcase(selectedQuest);
  }

  function bindEvents() {
    if (!panel) return;

    // Close button
    panel.querySelector('[data-action="close"]')?.addEventListener('click', () => {
      close({ animate: true });
    });

    // Reopen button
    panel.querySelector('[data-action="reopen"]')?.addEventListener('click', () => {
      if (!selectedQuestId) return;
      const state = getState();
      const quest = (state.items || []).find(i => i.id === selectedQuestId);
      if (!quest) return;

      const nextState = reopenQuest(state, selectedQuestId);
      commit(nextState);
      onCue('paperSlide');
      onReopen(quest);
      renderLedger();
    });

    // Search input
    const searchInput = panel.querySelector('.chronicle-search-input');
    searchInput?.addEventListener('input', e => {
      currentSearch = e.target.value;
      renderLedger();
    });

    // Filter pills
    const pills = panel.querySelectorAll('.chronicle-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('is-active'));
        pill.classList.add('is-active');
        currentRank = pill.dataset.rank || 'all';
        renderLedger();
      });
    });

    // List item selection
    const listEl = panel.querySelector('.chronicle-list');
    listEl?.addEventListener('click', e => {
      const row = e.target.closest('.chronicle-row');
      if (!row) return;
      const id = row.dataset.questId;
      if (!id || id === selectedQuestId) return;

      selectedQuestId = id;
      onCue('paperSlide');

      // Update rows selection
      panel.querySelectorAll('.chronicle-row').forEach(r => {
        const sel = r.dataset.questId === id;
        r.classList.toggle('is-selected', sel);
        r.setAttribute('aria-selected', String(sel));
      });

      const state = getState();
      const quest = (state.items || []).find(i => i.id === id);
      renderShowcase(quest);
    });
  }

  function open({ questId = null } = {}) {
    if (isOpenState && panel) {
      if (questId) {
        selectedQuestId = questId;
        renderLedger();
      }
      registration?.raise?.();
      return;
    }

    panel = document.createElement('section');
    panel.className = 'guild-chronicle-window document-window';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'The Guild Chronicle · สมุดบันทึกประวัติศาสตร์การผจญภัย');
    panel.setAttribute('data-desk-window', '');
    panel.innerHTML = buildWindowMarkup();

    // Center in viewport
    const vw = window?.innerWidth || document?.documentElement?.clientWidth || 1024;
    const vh = window?.innerHeight || document?.documentElement?.clientHeight || 768;
    const targetW = Math.min(940, vw - 32);
    const targetH = Math.min(680, vh - 64);
    const initialLeft = Math.max(12, Math.round((vw - targetW) / 2));
    const initialTop = Math.max(12, Math.round((vh - targetH) / 2));
    panel.style.left = `${initialLeft}px`;
    panel.style.top = `${initialTop}px`;

    document.body.appendChild(panel);
    isOpenState = true;

    if (questId) {
      selectedQuestId = questId;
    }

    bindEvents();
    renderLedger();

    if (windows) {
      registration = windows.register(panel, {
        key: 'guild-chronicle-tome',
        handle: '.chronicle-header',
        onEscape: () => close({ animate: true }),
      });
      registration.raise();
    }

    onCue('folderOpen');

    if (!isReduced()) {
      panel.classList.add('is-unfolding');
      window.setTimeout(() => {
        panel?.classList.remove('is-unfolding');
      }, 300);
    }
  }

  function close({ animate = false } = {}) {
    if (!isOpenState || !panel) return false;
    isOpenState = false;

    if (animate) {
      onCue('drawerClose');
    }

    registration?.destroy?.();
    registration = null;

    panel.remove();
    panel = null;
    return true;
  }

  return {
    get element() {
      return panel;
    },
    get isOpen() {
      return isOpenState;
    },
    open,
    close,
    toggle({ questId = null } = {}) {
      if (isOpenState) close({ animate: true });
      else open({ questId });
    },
    refresh() {
      if (isOpenState && panel) {
        renderLedger();
      }
    },
    destroy() {
      close({ animate: false });
    },
  };
}
