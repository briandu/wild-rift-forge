import { useState, type DragEvent } from 'react';

export function dropLine(
  items: readonly string[],
  drag: string | null,
  over: string | null,
  name: string,
): string | undefined {
  if (!drag || over !== name || drag === name) return undefined;
  return items.indexOf(over) > items.indexOf(drag) ? 'inset 0 -2px 0 #16C0FF' : 'inset 0 2px 0 #16C0FF';
}

export function useRankDrag<T extends string>(enabled: boolean, onDrop: (from: T, to: T) => void) {
  const [drag, setDrag] = useState<T | null>(null);
  const [over, setOver] = useState<T | null>(null);

  function clear() {
    setDrag(null);
    setOver(null);
  }

  function rowProps(name: T) {
    return {
      draggable: enabled,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        try {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', name);
        } catch {
          // Some browsers reject setData during tests.
        }
        setDrag(name);
        setOver(name);
      },
      onDragOver: (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        if (over !== name) setOver(name);
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        const from = drag ?? (event.dataTransfer.getData('text/plain') as T);
        onDrop(from, name);
        clear();
      },
      onDragEnd: clear,
    };
  }

  return { drag, over, rowProps };
}
