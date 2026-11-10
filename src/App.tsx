import { OwnerPortal } from './components/OwnerPortal';

/**
 * Main application component.
 * ThemeProvider wraps this component in src/main.tsx to provide reactive light/dark theme state.
 */
export function App() {
  return <OwnerPortal />;
}

export default App;
