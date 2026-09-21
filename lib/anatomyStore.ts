type Listener = () => void;

/**
 * Deliberately not React state. `progress` is written on every
 * ScrollTrigger tick (potentially 60+/sec) and read inside the R3F
 * useFrame loop directly — routing it through React would cause a
 * re-render of the whole component tree every scroll frame (Section 18:
 * "avoid unnecessary React re-renders").
 *
 * `sectionIndex` DOES notify subscribers, but only fires when the active
 * section actually changes (roughly a dozen times across the whole
 * scroll), so the text overlay only re-renders when it has new copy to show.
 */
class AnatomyStore {
  private _progress = 0;
  private _sectionIndex = 0;
  private listeners = new Set<Listener>();

  setProgress(value: number) {
    this._progress = value;
  }

  getProgress() {
    return this._progress;
  }

  setSectionIndex(value: number) {
    if (value === this._sectionIndex) return;
    this._sectionIndex = value;
    this.listeners.forEach((listener) => listener());
  }

  getSectionIndex = () => this._sectionIndex;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}

export const anatomyStore = new AnatomyStore();
