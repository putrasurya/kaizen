import { render, screen } from '@testing-library/react';
import App from './App';
import { StoreProvider } from './redux/store';

describe("App", () => {
  test('renders the Kaizen title, note list, timer list and footer together', () => {
    render(
      <StoreProvider>
        <App />
      </StoreProvider>
    );

    expect(screen.getByText(/Kaizen/i)).toBeInTheDocument();
    expect(screen.getByText(/Take Note/i)).toBeInTheDocument();
    expect(screen.getByText(/Add Timer/i)).toBeInTheDocument();
    expect(screen.getByText(/Putra Surya/i)).toBeInTheDocument();
  });
});
