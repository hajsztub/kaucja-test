import AsyncStorage from "@react-native-async-storage/async-storage";
import { Counts, INITIAL_COUNTS, ReturnEntry } from "./deposit";

const COUNTS_KEY = "kaucja:counts";
const HISTORY_KEY = "kaucja:history";
const ONBOARDING_KEY = "kaucja:onboarding-complete";

export const loadCounts = async (): Promise<Counts> => {
  const raw = await AsyncStorage.getItem(COUNTS_KEY);
  return raw ? { ...INITIAL_COUNTS, ...JSON.parse(raw) } : INITIAL_COUNTS;
};

export const saveCounts = (counts: Counts) =>
  AsyncStorage.setItem(COUNTS_KEY, JSON.stringify(counts));

export const loadHistory = async (): Promise<ReturnEntry[]> => {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  return raw ? JSON.parse(raw) : [];
};

export const saveHistory = (history: ReturnEntry[]) =>
  AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));

export const isOnboardingComplete = async () =>
  (await AsyncStorage.getItem(ONBOARDING_KEY)) === "true";

export const completeOnboarding = () =>
  AsyncStorage.setItem(ONBOARDING_KEY, "true");
