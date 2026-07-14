import { useState } from 'react';
import type { Lang, QuizDirection, WordEntry, WordStats } from '@/types/word';
import { getAllWords, recordAnswer, saveContent } from '@/lib/storage';
import { lookupWord } from '@/lib/dictionary';
import { fetchDistractors, type Distractor } from '@/lib/distractors';
import { selectSessionWords } from '@/lib/quiz-selection';
import QuizCard from './QuizCard';

interface Props {
  onExit: () => void;
}

type Phase = 'setup' | 'loading' | 'running' | 'summary';

interface Question {
  entry: WordEntry;
  direction: QuizDirection;
  distractors: Distractor[];
}

const SESSION_SIZE = 10;

function pickDirection(): QuizDirection {
  return Math.random() < 0.5 ? 'word-to-definition' : 'definition-to-word';
}

export default function RecallSession({ onExit }: Props) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [lang, setLang] = useState<Lang | 'all'>('all');
  const [onlyLearning, setOnlyLearning] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 });
  const [beforeStats, setBeforeStats] = useState<Map<string, WordStats>>(new Map());
  const [afterStats, setAfterStats] = useState<Map<string, WordStats>>(new Map());

  async function start() {
    setError(null);
    setPhase('loading');
    try {
      const all = await getAllWords();
      const selected = selectSessionWords(all, { lang, onlyLearning, size: SESSION_SIZE });
      if (selected.length === 0) {
        setError('No words match those settings yet.');
        setPhase('setup');
        return;
      }

      const withContent: WordEntry[] = [];
      for (const entry of selected) {
        if (entry.content) {
          withContent.push(entry);
          continue;
        }
        const looked = await lookupWord(entry.lang, entry.word);
        if (looked) {
          await saveContent(looked.content);
          withContent.push({ ...entry, content: looked.content });
        }
      }

      const langsNeeded = Array.from(new Set(withContent.map((w) => w.lang)));
      const poolByLang = new Map<Lang, Distractor[]>();
      for (const l of langsNeeded) {
        const excludeWords = withContent.filter((w) => w.lang === l).map((w) => w.word);
        const pool = await fetchDistractors(l, Math.max(withContent.length * 3, 8), excludeWords);
        poolByLang.set(l, pool);
      }

      const snapshot = new Map<string, WordStats>();
      const built: Question[] = withContent.map((entry) => {
        snapshot.set(`${entry.lang}:${entry.word}`, { ...entry });
        const pool = poolByLang.get(entry.lang) ?? [];
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        return { entry, direction: pickDirection(), distractors: shuffled.slice(0, 3) };
      });

      setBeforeStats(snapshot);
      setQuestions(built);
      setIndex(0);
      setResults({ correct: 0, total: 0 });
      setPhase('running');
    } catch (err) {
      console.error(err);
      setError('Something went wrong building the session. Try again.');
      setPhase('setup');
    }
  }

  async function handleAnswer(correct: boolean) {
    const { entry } = questions[index];
    const updated = await recordAnswer(entry.lang, entry.word, correct);
    setAfterStats((prev) => new Map(prev).set(`${entry.lang}:${entry.word}`, updated));
    setResults((r) => ({ correct: r.correct + (correct ? 1 : 0), total: r.total + 1 }));
  }

  function handleNext() {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
    } else {
      setPhase('summary');
    }
  }

  const newlyLearned = Array.from(afterStats.values()).filter((s) => {
    const before = beforeStats.get(`${s.lang}:${s.word}`);
    return s.learned && before && !before.learned;
  });

  if (phase === 'setup') {
    return (
      <div className="recall-setup">
        <h2>Recall session</h2>
        {error && <div className="recall-setup__error">{error}</div>}
        <label>
          Language
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang | 'all')}>
            <option value="all">Both</option>
            <option value="en">English</option>
            <option value="ru">Russian</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={onlyLearning}
            onChange={(e) => setOnlyLearning(e.target.checked)}
          />
          Only words still learning
        </label>
        <div className="recall-setup__actions">
          <button onClick={start}>Start session</button>
          <button onClick={onExit}>Cancel</button>
        </div>
      </div>
    );
  }

  if (phase === 'loading') {
    return <div className="recall-loading">Preparing your session…</div>;
  }

  if (phase === 'running') {
    const question = questions[index];
    return (
      <div className="recall-running">
        <div className="recall-running__progress">
          {index + 1} / {questions.length}
        </div>
        <QuizCard
          key={`${question.entry.lang}:${question.entry.word}:${index}`}
          entry={question.entry}
          distractors={question.distractors}
          direction={question.direction}
          onAnswer={handleAnswer}
          onNext={handleNext}
        />
      </div>
    );
  }

  return (
    <div className="recall-summary">
      <h2>Session complete</h2>
      <p>
        {results.correct} / {results.total} correct
      </p>
      {newlyLearned.length > 0 && (
        <div>
          <strong>Newly learned:</strong>
          <ul>
            {newlyLearned.map((s) => (
              <li key={`${s.lang}:${s.word}`}>{s.word}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="recall-summary__actions">
        <button onClick={start}>Run another session</button>
        <button onClick={onExit}>Back to word list</button>
      </div>
    </div>
  );
}
