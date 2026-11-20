/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { WorkshopProvider } from './store/WorkshopContext';
import { LayoutShell, PillarId } from './components/LayoutShell';
import { Pillar1Cockpits } from './pillars/Pillar1Cockpits';
import { Pillar2Pantry } from './pillars/Pillar2Pantry';
import { Pillar3Recipes } from './pillars/Pillar3Recipes';
import { Pillar4Commercial } from './pillars/Pillar4Commercial';
import { Pillar5Cfo } from './pillars/Pillar5Cfo';
import { Pillar6ReportsSettings, Pillar6Tab } from './pillars/Pillar6ReportsSettings';

function ShirinTarazApp() {
  const [activePillar, setActivePillar] = useState<PillarId>('cockpits');
  const [pillar6Tab, setPillar6Tab] = useState<Pillar6Tab>('reports');

  const handleQuickJumpSettings = () => {
    setPillar6Tab('settings');
    setActivePillar('reports_settings');
  };

  return (
    <LayoutShell
      activePillar={activePillar}
      onSelectPillar={(p) => {
        if (p === 'reports_settings' && activePillar !== 'reports_settings') {
          setPillar6Tab('reports');
        }
        setActivePillar(p);
      }}
      onQuickJumpSettings={handleQuickJumpSettings}
    >
      {activePillar === 'cockpits' && <Pillar1Cockpits />}
      {activePillar === 'pantry' && <Pillar2Pantry />}
      {activePillar === 'recipes' && <Pillar3Recipes />}
      {activePillar === 'commercial' && <Pillar4Commercial />}
      {activePillar === 'cfo' && <Pillar5Cfo />}
      {activePillar === 'reports_settings' && <Pillar6ReportsSettings initialTab={pillar6Tab} />}
    </LayoutShell>
  );
}

export default function App() {
  return (
    <WorkshopProvider>
      <ShirinTarazApp />
    </WorkshopProvider>
  );
}
