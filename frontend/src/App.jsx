import { useState } from 'react';
import ImportScreen from './components/ImportScreen.jsx';
import GraphView from './components/GraphView.jsx';

export default function App() {
  const [graphData, setGraphData] = useState(null);

  return graphData
    ? <GraphView data={graphData} onBack={() => setGraphData(null)} />
    : <ImportScreen onLoad={setGraphData} />;
}
