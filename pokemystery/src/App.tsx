import { Layout } from './components/Layout';
import { useRoute } from './lib/router';
import { Landing } from './pages/Landing';
import { AiGame } from './pages/AiGame';
import { GuessGame } from './pages/GuessGame';
import { SettingsPage } from './pages/SettingsPage';
import { AboutPage } from './pages/AboutPage';

export function App() {
  const route = useRoute();
  return (
    <Layout>
      {route === 'home' ? <Landing /> : null}
      {/* key remounts a game page when re-entered so a fresh session starts */}
      {route === 'play-ai' ? <AiGame key="ai" /> : null}
      {route === 'play-guess' ? <GuessGame key="guess" /> : null}
      {route === 'settings' ? <SettingsPage /> : null}
      {route === 'about' ? <AboutPage /> : null}
    </Layout>
  );
}
