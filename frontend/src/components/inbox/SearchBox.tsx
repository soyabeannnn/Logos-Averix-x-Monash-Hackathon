"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";

interface SearchBoxProps {
  /** The committed query (from the URL). */
  value: string;
  onCommit: (query: string) => void;
}

/** Search input that commits to the URL after the user pauses typing. */
export function SearchBox({ value, onCommit }: SearchBoxProps) {
  const id = useId();
  const [text, setText] = useState(value);
  const commit = useRef(onCommit);

  useEffect(() => {
    commit.current = onCommit;
  });

  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => commit.current(text), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, value]);

  return (
    <div className="min-w-[220px] flex-1">
      <label htmlFor={id} className="sr-only">
        Search emails
      </label>
      <input
        id={id}
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Search sender, subject or shipment ref"
        className="w-full rounded-[10px] border-2 border-plum bg-white px-2.5 py-[7px] text-plum"
      />
    </div>
  );
}
