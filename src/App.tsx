import { useCallback, useEffect, useState } from 'react';
import type { GameSetup, GameState } from './game/types';
import { createGame } from './game/engine';
import { clearGame, loadGame, saveGame } from './storage';
import Home from './screens/Home';
import HowToPlay from './screens/HowToPlay';
import { SetupFlow } from './screens/setup/SetupFlow';
import { GameScreen } from './screens/game/GameScreen';

type Screen = 'home' | 'howto' | 'setup' | 'game';

const IN_GAME_KEY = 'sinduean.inGame';
function wasInGame(): boolean {
  try {
    return sessionStorage.getItem(IN_GAME_KEY) === '1';
  } catch {
    return false;
  }
}
function markInGame(v: boolean): void {
  try {
    if (v) sessionStorage.setItem(IN_GAME_KEY, '1');
    else sessionStorage.removeItem(IN_GAME_KEY);
  } catch {
    /* ignore */
  }
}

export default function App() {
  // รีโหลดในแท็บเดิมระหว่างเล่น → กลับเข้าเกมจากเซฟทันที (กลับไปหน้าส่งต่อถ้าค้างอยู่ช่วงวางแผน)
  const [game, setGame] = useState<GameState | null>(() => (wasInGame() ? loadGame() : null));
  const [screen, setScreen] = useState<Screen>(() => (game ? 'game' : 'home'));
  const [hasSave, setHasSave] = useState(() => loadGame() !== null);

  useEffect(() => markInGame(screen === 'game'), [screen]);

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
