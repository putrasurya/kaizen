import { render, screen } from '@testing-library/react';
import AppFooter from './AppFooter';

test('renders a credit link to the author', () => {
  render(<AppFooter />);

  const link = screen.getByRole('link', { name: /Putra Surya/i });
  expect(link).toHaveAttribute('href', 'https://github.com/putrasurya');
  expect(link).toHaveAttribute('target', '_blank');
});
