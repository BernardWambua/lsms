export const QUESTION_TYPES = [
  { value: 'rating', label: 'Rating (1 to 5)' },
  { value: 'choice', label: 'Multiple choice' },
  { value: 'true_false', label: 'True / false' },
  { value: 'text', label: 'Text' },
];

export function questionTypeLabel(value) {
  return QUESTION_TYPES.find((t) => t.value === value)?.label || value;
}
