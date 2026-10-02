import { render, screen } from '@testing-library/react';
import App from './App';
import { StoreProvider } from './redux/store';
import { mockViewportWidth } from './test-utils/mockViewport';

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

describe("App responsive gutter", () => {
  let restoreViewport;
  afterEach(() => restoreViewport?.());

  // The Row's negative side margin is half the horizontal gutter and has to match
  // App.module.css's container padding (16px on phones, 25px otherwise), or the
  // page scrolls sideways.
  test.each([
    [360, '-16px'],
    [1280, '-25px'],
  ])('at %ipx wide the column row inline margin is %s', (width, margin) => {
    restoreViewport = mockViewportWidth(width);
    const { container } = render(
      <StoreProvider>
        <App />
      </StoreProvider>
    );

    // App's root is the container div; its first child is the two-column Row.
    const row = container.firstChild.firstChild;
    expect(row).toHaveClass('ant-row');
    // antd 6 sets this as the logical `margin-inline` property, which jsdom's
    // CSSStyleDeclaration doesn't expand, so check the inline style text.
    expect(row.getAttribute('style')).toContain(`margin-inline: ${margin}`);
  });
});
