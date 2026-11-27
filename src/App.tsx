import { useCallback, useState } from 'react';
import type { GameSetup, GameState } from './game/types';
import { createGame } from './game/engine';
import { clearGame, loadGame, saveGame } from './storage';
import Home from './screens/Home';
import HowToPlay from './screens/HowToPlay';
import { SetupFlow } from './screens/setup/SetupFlow';
import { GameScreen } from './screens/game/GameScreen';

type Screen = 'home' | 'howto' | 'setup' | 'game';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [game, setGame] = useState<GameState | null>(null);
  const [hasSave, setHasSave] = useState(() => loadGame() !== null);

  // ทุกการเปลี่ยนสถานะเกมผ่านที่นี่ → เซฟทันที
  const update = useCallback((s: GameState) => {
    saveGame(s);
    setGame(s);
  }, []);

  const start = (setup: GameSetup) => {
    clearGame();
    update(createGame(setup));
    setScreen('game');
  };

  const resume = () => {
    const s = loadGame();
    if (s) {
      setGame(s);
      setScreen('game');
    } else setHasSave(false);
  };

  const exit = () => {
    setHasSave(loadGame() !== null);
    setScreen('home');
  };

  return (
    <div className="app">
      {screen === 'home' && (
        <Home
          hasSave={hasSave}
          onStart={() => setScreen('setup')}
          onResume={resume}
          onHowTo={() => setScreen('howto')}
        />
      )}
      {screen === 'howto' && <HowToPlay onBack={() => setScreen('home')} />}
      {screen === 'setup' && <SetupFlow onStart={start} onCancel={() => setScreen('home')} />}
      {screen === 'game' && game && <GameScreen state={game} onChange={update} onExit={exit} />}
    </div>
  );
}
