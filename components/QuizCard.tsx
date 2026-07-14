import { useMemo, useState } from 'react';
import type { QuizDirection, WordEntry } from '@/types/word';
import type { Distractor } from '@/lib/distractors';
import { stripToText } from '@/lib/sanitize';

interface Option {
  label: string;
  isCorrect: boolean;
}

interface Props {
  entry: WordEntry;
  distractors: Distractor[];
  direction: QuizDirection;
  onAnswer: (correct: boolean) => void;
  onNext: () => void;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function QuizCard({ entry, distractors, direction, onAnswer, onNext }: Props) {
  const [selected, setSelected] = useState<number | null>(null);

  const options = useMemo<Option[]>(() => {
    const asWord = direction === 'definition-to-word';
    const correct: Option = {
      label: asWord ? entry.word : stripToText(entry.content?.definition ?? ''),
      isCorrect: true,
    };
    const wrong: Option[] = distractors.map((d) => ({
      label: asWord ? d.word : stripToText(d.definition),
      isCorrect: false,
    }));
    return shuffle([correct, ...wrong]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.word, direction]);

  const prompt =
    direction === 'word-to-definition' ? entry.word : stripToText(entry.content?.definition ?? '');

  function handleSelect(index: number) {
    if (selected !== null) return;
    setSelected(index);
    onAnswer(options[index].isCorrect);
  }

  return (
    <div className="quiz-card">
      <div className="quiz-card__lang">{entry.lang.toUpperCase()}</div>
      <div className="quiz-card__prompt">{prompt}</div>
      <div className="quiz-card__options">
        {options.map((opt, i) => {
          const answered = selected !== null;
          const isSelected = selected === i;
          const cls = [
            'quiz-card__option',
            answered && opt.isCorrect ? 'quiz-card__option--correct' : '',
            answered && isSelected && !opt.isCorrect ? 'quiz-card__option--wrong' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button key={i} className={cls} disabled={answered} onClick={() => handleSelect(i)}>
              {opt.label}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <button className="quiz-card__next" onClick={onNext}>
          Next
        </button>
      )}
    </div>
  );
}
