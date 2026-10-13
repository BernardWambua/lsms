import PropTypes from 'prop-types';

export const roleShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
});

// Recursive: a unit's children are units too.
function unitValidator(...args) {
  return PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    job_roles: PropTypes.arrayOf(roleShape).isRequired,
    children: PropTypes.arrayOf(unitValidator).isRequired,
  })(...args);
}
unitValidator.isRequired = (props, propName, ...rest) => (
  props[propName] == null
    ? new Error(`${propName} is required`)
    : unitValidator(props, propName, ...rest)
);

export const unitShape = unitValidator;
