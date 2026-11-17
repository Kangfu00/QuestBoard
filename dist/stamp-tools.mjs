import { STATUS, setItemStatus } from './model.mjs';

const TOOL_STATUSES = ['done', 'failed', 'paused'];
const TOOL_STYLES = ['seal', 'rectangle', 'banner'];

function validateSelection(status, style) {
  if (!TOOL_STATUSES.includes(status)) throw new Error('สถานะตราประทับไม่ถูกต้อง');
  if (!TOOL_STYLES.includes(style)) throw new Error('รูปแบบตราประทับไม่ถูกต้อง');
}

export function chooseStampTool(status, style = 'seal', customStamp = null) {
  validateSelection(status, style);
  if (customStamp !== null && customStamp.status !== status) {
    throw new Error('ตราประทับนี้ไม่ตรงกับสถานะที่เลือก');
  }
  return {
    status,
    style,
    stampId: customStamp?.id ?? null,
    dataUrl: customStamp?.dataUrl ?? null,
    name: customStamp?.name ?? STATUS[status].label,
  };
}

export function isStampableTarget(item, { allowArchived = false } = {}) {
  return Boolean(item?.type === 'quest' && (!item.archived || allowArchived === true));
}

export function applyHeldStamp(state, id, tool, stampPosition = undefined, { allowArchived = false } = {}) {
  if (tool == null) return state;
  const target = state.items.find(item => item.id === id);
  if (!isStampableTarget(target, { allowArchived })) return state;
  validateSelection(tool.status, tool.style);
  return setItemStatus(state, id, tool.status, tool.stampId ?? null, tool.style, stampPosition);
}
