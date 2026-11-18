const LEATHER_COLORS = Object.freeze({
  gold: { label: 'น้ำตาลหนังเก่า', hue: 27, tone: 'classic' },
  sage: { label: 'เขียวมอส', hue: 70, tone: 'classic' },
  red: { label: 'แดงไวน์', hue: 7, tone: 'classic' },
  navy: { label: 'น้ำเงินหมึก', hue: 215, tone: 'deep' },
  plum: { label: 'ม่วงพลัม', hue: 313, tone: 'classic' },
  charcoal: { label: 'เทาถ่าน', hue: 66, tone: 'deep' },
  ivory: { label: 'ขาวงาช้าง', hue: 42, tone: 'pearl' },
  bone: { label: 'ขาวกระดูก', hue: 31, tone: 'pearl' },
});

export const LEATHER_COLOR_IDS = Object.freeze(Object.keys(LEATHER_COLORS));

const LEATHER_TONES = Object.freeze({
  deep: 'หนังเข้ม',
  classic: 'หนังย้อมหม่น',
  faded: 'หนังซีด',
  pearl: 'หนังสีอ่อน',
});

function readDye(color) {
  if (typeof color !== 'string') return null;
  const match = /^dye-(0|[1-9]\d{0,2})-(deep|classic|faded|pearl)$/.exec(color);
  if (!match || match[0] !== color || Number(match[1]) > 359) return null;
  return { hue: Number(match[1]), tone: match[2] };
}

export function validateLeatherColor(color, label) {
  if (LEATHER_COLOR_IDS.includes(color) || readDye(color)) return color;
  throw new Error(`${label} ไม่ถูกต้อง`);
}

export function leatherDyeMarkup(color) {
  const dye = readDye(color);
  return dye
    ? { attributes: ` data-leather-tone="${dye.tone}"`, style: `--leather-hue:${dye.hue};` }
    : { attributes: '', style: '' };
}

export function paintLeatherDye(element, color) {
  const dye = readDye(color);
  if (dye) {
    element.dataset.leatherTone = dye.tone;
    element.style.setProperty('--leather-hue', dye.hue);
  } else if (element.dataset.leatherTone) {
    delete element.dataset.leatherTone;
    element.style.removeProperty('--leather-hue');
  }
}

export function renderLeatherColorPicker(label, selected = 'gold') {
  const color = validateLeatherColor(selected, label);
  const { hue, tone } = readDye(color) ?? LEATHER_COLORS[color];
  return `<fieldset class="leather-color-picker">
    <legend>${label}</legend>
    <input type="hidden" data-leather-color name="color" value="${color}">
    <div class="leather-color-controls">
      <div class="leather-color-wheel" aria-hidden="true" data-wheel-tone="${tone}" style="--wheel-angle:${hue}deg">
        <span class="leather-wheel-marker"></span>
      </div>
      <div class="leather-color-details">
        <label class="leather-hue-field">เฉดสี<input type="range" min="0" max="359" value="${hue}" data-leather-hue></label>
        <label class="leather-tone-field">น้ำหนักสี<select data-leather-tone-input>
          ${Object.entries(LEATHER_TONES).map(([key, text]) => `<option value="${key}"${key === tone ? ' selected' : ''}>${text}</option>`).join('')}
        </select></label>
      </div>
    </div>
    <div class="leather-color-choices">
      ${LEATHER_COLOR_IDS.map(id => `<button type="button" class="leather-color-option" data-leather-preset="${id}" aria-pressed="${id === color}">
        <span class="leather-swatch folder-${id}" aria-hidden="true"></span>
        <span>${LEATHER_COLORS[id].label}</span>
      </button>`).join('')}
    </div>
  </fieldset>`;
}

export function bindLeatherColorPicker(form,onColor) {
  const find = selector => form.querySelector(selector);
  const value = find('[data-leather-color]');
  const hue = find('[data-leather-hue]');
  const tone = find('[data-leather-tone-input]');
  const wheel = find('.leather-color-wheel');
  const presets = [...form.querySelectorAll('[data-leather-preset]')];

  function select(color) {
    const dye = readDye(color) ?? LEATHER_COLORS[color];
    value.value = color;
    hue.value = dye.hue;
    tone.value = dye.tone;
    wheel.style.setProperty('--wheel-angle', `${dye.hue}deg`);
    wheel.dataset.wheelTone = dye.tone;
    for (const button of presets) {
      button.setAttribute('aria-pressed', String(button.dataset.leatherPreset === color));
    }
    onColor(color);
  }

  const selectDye = () => select(`dye-${hue.value}-${tone.value}`);
  hue.addEventListener('input', selectDye);
  tone.addEventListener('change', selectDye);
  for (const button of presets) {
    button.addEventListener('click', () => select(button.dataset.leatherPreset));
  }

  function followPointer(event) {
    const bounds = wheel.getBoundingClientRect();
    const dx = event.clientX - bounds.left - bounds.width / 2;
    const dy = event.clientY - bounds.top - bounds.height / 2;
    if (Math.hypot(dx, dy) < bounds.width / 10) return;
    hue.value = (Math.round(Math.atan2(dx, -dy) * 180 / Math.PI) + 360) % 360;
    selectDye();
  }

  wheel.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.isPrimary === false) return;
    event.preventDefault();
    wheel.setPointerCapture(event.pointerId);
    followPointer(event);
  });
  wheel.addEventListener('pointermove', event => {
    if (wheel.hasPointerCapture(event.pointerId)) followPointer(event);
  });
}
