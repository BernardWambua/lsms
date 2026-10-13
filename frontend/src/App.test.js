import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => sessionStorage.clear());

test('shows the welcome page with login, and no public sign up, to logged-out visitors', () => {
  render(<App />);
  expect(screen.getByText(/welcome to lsms/i)).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /login/i }).length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: /sign up/i })).not.toBeInTheDocument();
});
