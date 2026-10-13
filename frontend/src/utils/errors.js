// Turn a DRF error response into one readable line.
export function errorMessage(err) {
  const data = err?.response?.data;
  if (!data) return err?.message || 'Something went wrong.';
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  return Object.entries(data)
    .map(([field, messages]) => {
      const text = Array.isArray(messages) ? messages.join(' ') : String(messages);
      return field === 'non_field_errors' ? text : `${field.replace(/_/g, ' ')}: ${text}`;
    })
    .join(' ');
}
