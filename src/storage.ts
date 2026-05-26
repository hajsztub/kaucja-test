import AsyncStorage from "@react-native-async-storage/async-storage";
import { Counts, DEFAULT_GOALS, Goal, INITIAL_COUNTS, ReturnEntry } from "./deposit";

const COUNTS_KEY = "kaucja:counts";
const HISTORY_KEY = "kaucja:history";
const ONBOARDING_KEY = "kaucja:onboarding-complete";
const GOALS_KEY = "kaucja:goals";

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

export const loadGoals = async (): Promise<Goal[]> => {
  const raw = await AsyncStorage.getItem(GOALS_KEY);
  const goals: Goal[] = raw ? JSON.parse(raw) : DEFAULT_GOALS;
  return goals.some((goal) => goal.primary)
    ? goals
    : goals.map((goal, index) => ({ ...goal, primary: index === 0 }));
};

export const saveGoals = (goals: Goal[]) =>
  AsyncStorage.setItem(GOALS_KEY, JSON.stringify(goals));

export const isOnboardingComplete = async () =>
  (await AsyncStorage.getItem(ONBOARDING_KEY)) === "true";

export const completeOnboarding = () =>
  AsyncStorage.setItem(ONBOARDING_KEY, "true");
