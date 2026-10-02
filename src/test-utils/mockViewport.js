// setupTests.js stubs window.matchMedia to never match, which antd's breakpoint
// observer (Grid.useBreakpoint, responsive Row gutters) reads as "no breakpoint
// active". This swaps in a stub that evaluates antd's simple min-/max-width
// queries against a pretend viewport width, so components render their phone or
// desktop layout. It returns a function that restores the previous stub.
export function mockViewportWidth(width) {
  const previous = window.matchMedia;
  window.matchMedia = (query) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]));
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    };
  };
  return () => {
    window.matchMedia = previous;
  };
}
