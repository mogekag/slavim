import type { WordEntry } from '@/types/word';
import WordCard from './WordCard';

interface Props {
  words: WordEntry[];
  onChanged: () => void;
}

export default function WordList({ words, onChanged }: Props) {
  if (words.length === 0) {
    return <div className="word-list__empty">No words match the current filters yet.</div>;
  }

  return (
    <div className="word-list">
      {words.map((w) => (
        <WordCard key={`${w.lang}:${w.word}`} entry={w} onChanged={onChanged} />
      ))}
    </div>
  );
}
