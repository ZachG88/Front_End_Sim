import { useState } from 'react';
import { useSimulation } from './hooks/useSimulation.js';
import Header from './components/Header.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import AdvancedPanel from './components/AdvancedPanel.jsx';
import Statistics from './components/Statistics.jsx';
import SimulationView from './components/SimulationView.jsx';
import FloorPlan from './components/FloorPlan.jsx';

export default function App() {
  const {
    config,
    updateConfig,
    applyPreset,
    applyAdvanced,
    running,
    toggleRunning,
    display,
    reset,
  } = useSimulation();

  const [activeView, setActiveView] = useState('lanes');
  const [leftTab,    setLeftTab]    = useState('configure');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header
        display={display}
        running={running}
        onToggle={toggleRunning}
        onReset={() => reset()}
      />

      <div className="app-body">

        {/* ── Left sidebar with Configure / Advanced tabs ── */}
        <div className="left-sidebar">
          <div className="left-tabs">
            <button
              className={`left-tab-btn ${leftTab === 'configure' ? 'active' : ''}`}
              onClick={() => setLeftTab('configure')}
            >
              Configure
            </button>
            <button
              className={`left-tab-btn ${leftTab === 'advanced' ? 'active' : ''}`}
              onClick={() => setLeftTab('advanced')}
            >
              Advanced
            </button>
          </div>

          {leftTab === 'configure'
            ? <ControlPanel
                config={config}
                updateConfig={updateConfig}
                applyPreset={applyPreset}
                onReset={reset}
              />
            : <AdvancedPanel onApply={applyAdvanced} />
          }
        </div>

        <div className="content-area">
          <Statistics display={display} />

          {/* Right view tabs */}
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
