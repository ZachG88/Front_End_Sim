import { useState } from 'react';
import { useSimulation } from './hooks/useSimulation.js';
import Header from './components/Header.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import Statistics from './components/Statistics.jsx';
import SimulationView from './components/SimulationView.jsx';
import FloorPlan from './components/FloorPlan.jsx';

export default function App() {
  const {
    config,
    updateConfig,
    applyPreset,
    running,
    toggleRunning,
    display,
    reset,
  } = useSimulation();

  const [activeView, setActiveView] = useState('lanes');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header
        display={display}
        running={running}
        onToggle={toggleRunning}
        onReset={() => reset()}
      />

      <div className="app-main">
        <ControlPanel
          config={config}
          updateConfig={updateConfig}
          applyPreset={applyPreset}
          onReset={reset}
        />

        <div className="content-area">
          <Statistics display={display} />

          {/* Tab switcher */}
          <div className="view-tabs">
            <button
              className={`view-tab ${activeView === 'lanes' ? 'active' : ''}`}
              onClick={() => setActiveView('lanes')}
            >
              Lane List
            </button>
            <button
              className={`view-tab ${activeView === 'floorplan' ? 'active' : ''}`}
              onClick={() => setActiveView('floorplan')}
            >
              Floor Plan
            </button>
          </div>

          {activeView === 'lanes'
            ? <SimulationView display={display} />
            : <FloorPlan display={display} />
          }
        </div>
      </div>
    </div>
  );
}
