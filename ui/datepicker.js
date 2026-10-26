// ui/datepicker.js - Custom Windows 11 Fluent Design Date Picker (flatpickr wrapper)

export function setupDatePicker(inputOrSelector, options = {}) {
  if (typeof window.flatpickr !== 'function') return null;
  const elements = typeof inputOrSelector === 'string'
    ? document.querySelectorAll(inputOrSelector)
    : (inputOrSelector instanceof NodeList || Array.isArray(inputOrSelector) ? inputOrSelector : [inputOrSelector]);

  const instances = [];
  elements.forEach((input) => {
    if (!input) return;
    if (input._flatpickr) {
      input._flatpickr.destroy();
    }
    if (input.type === 'date') {
      input.type = 'text';
    }
    const fp = window.flatpickr(input, {
      locale: window.flatpickr.l10ns?.ru || 'ru',
      dateFormat: 'Y-m-d',
      monthSelectorType: 'dropdown',
      disableMobile: true,
      allowInput: true,
      ...options,
      onChange: (selectedDates, dateStr, instance) => {
        input.value = dateStr;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (options.onChange) {
          options.onChange(selectedDates, dateStr, instance);
        }
      }
    });
    instances.push(fp);
  });
  return instances.length === 1 ? instances[0] : instances;
}
