// Platform spec 8.1: Shéi's part of the shared Settings page. Loaded by Settings
// without the rest of the game, so it imports only this device's settings store.
import { useEffect } from "react";
import type { DeviceSettingsSection } from "../../core/language-module.ts";
import { useSettings } from "./store/settings.ts";

// Spec 7.3: the Level 2 pinyin toggle, the same value as the Pinyin checkbox above
// the tiles. The Level 1 pronoun is chosen while asking, so it has no row here.
const ChineseSettings: DeviceSettingsSection = ({ Toggle }) => {
  const { pinyin, setPinyin, hydrated, hydrate } = useSettings();
  useEffect(() => void hydrate(), [hydrate]);
  return (
    <Toggle
      label="Show pinyin at Level 2"
      description="Level 1 always shows pinyin."
      checked={pinyin}
      disabled={!hydrated}
      onChange={setPinyin}
    />
  );
};

export default ChineseSettings;
