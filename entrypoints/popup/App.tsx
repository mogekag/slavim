import { useEffect, useState } from 'react';
import { getAllWords, watchStats } from '@/lib/storage';
import './App.css';

function openManager() {
  browser.tabs.create({ url: browser.runtime.getURL('/manager.html') });
}

function App() {
  const [total, setTotal] = useState(0);
  const [learned, setLearned] = useState(0);

  async function refresh() {
    const words = await getAllWords();
    setTotal(words.length);
    setLearned(words.filter((w) => w.learned).length);
  }

  useEffect(() => {
    refresh();
    return watchStats(refresh);
  }, []);

  return (
    <div className="popup">
      <h1>Lexi Recall</h1>
      <div className="popup__stats">
        <div>
          <span className="popup__stat-value">{total}</span>
          <span className="popup__stat-label">saved</span>
        </div>
        <div>
          <span className="popup__stat-value">{learned}</span>
          <span className="popup__stat-label">learned</span>
        </div>
      </div>
      <button className="popup__open" onClick={openManager}>
        Open word manager
      </button>
      <p className="popup__hint">Highlight a word on any page to look it up and save it.</p>
    </div>
  );
}

export default App;
