import { useEffect, useMemo, useState } from 'react';
import type { Lang, WordEntry } from '@/types/word';
import { accuracy } from '@/types/word';
import { getAllWords, watchStats } from '@/lib/storage';
import WordList from '@/components/WordList';
import RecallSession from '@/components/RecallSession';

type View = 'browse' | 'recall';
type GroupFilter = 'all' | 'learning' | 'learned';
type SortBy = 'accuracy' | 'date' | 'alpha';

function App() {
  const [view, setView] = useState<View>('browse');
  const [words, setWords] = useState<WordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [langFilter, setLangFilter] = useState<Lang | 'all'>('all');
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('date');

  async function refresh() {
    setWords(await getAllWords());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    return watchStats(refresh);
  }, []);

  const visible = useMemo(() => {
    let list = words;
    if (langFilter !== 'all') list = list.filter((w) => w.lang === langFilter);
    if (groupFilter === 'learning') list = list.filter((w) => !w.learned);
    if (groupFilter === 'learned') list = list.filter((w) => w.learned);

    const sorted = [...list];
    if (sortBy === 'accuracy') sorted.sort((a, b) => accuracy(b) - accuracy(a));
    else if (sortBy === 'alpha') sorted.sort((a, b) => a.word.localeCompare(b.word));
    else sorted.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
    return sorted;
  }, [words, langFilter, groupFilter, sortBy]);

  const learnedCount = words.filter((w) => w.learned).length;

  return (
    <div className="app">
      <header className="app__header">
        <h1>Lexi Recall</h1>
        <div className="app__tabs">
          <button
            className={view === 'browse' ? 'active' : ''}
            onClick={() => setView('browse')}
          >
            Browse ({words.length})
          </button>
          <button
            className={view === 'recall' ? 'active' : ''}
            onClick={() => setView('recall')}
          >
            Recall session
          </button>
        </div>
      </header>

      {view === 'browse' && (
        <main className="app__main">
          <div className="app__filters">
            <label>
              Language
              <select value={langFilter} onChange={(e) => setLangFilter(e.target.value as Lang | 'all')}>
                <option value="all">All</option>
                <option value="en">English</option>
                <option value="ru">Russian</option>
              </select>
            </label>
            <label>
              Group
              <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value as GroupFilter)}>
                <option value="all">All ({words.length})</option>
                <option value="learning">Learning ({words.length - learnedCount})</option>
                <option value="learned">Learned ({learnedCount})</option>
              </select>
            </label>
            <label>
              Sort by
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
                <option value="date">Date added</option>
                <option value="accuracy">Accuracy</option>
                <option value="alpha">Alphabetical</option>
              </select>
            </label>
          </div>

          {loading ? <div>Loading…</div> : <WordList words={visible} onChanged={refresh} />}
        </main>
      )}

      {view === 'recall' && (
        <main className="app__main">
          <RecallSession onExit={() => setView('browse')} />
        </main>
      )}
    </div>
  );
}

export default App;
