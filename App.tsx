import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import analytics from "@react-native-firebase/analytics";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import mobileAds, {
  AdEventType,
  BannerAd,
  BannerAdSize,
  InterstitialAd
} from "react-native-google-mobile-ads";
import MapView, { Marker, Region } from "react-native-maps";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  calculateAmount,
  countAll,
  Counts,
  formatMoney,
  INITIAL_COUNTS,
  PACKAGES,
  PackageKind,
  ReturnEntry
} from "./src/deposit";
import { RETURN_POINTS } from "./src/points";
import {
  completeOnboarding,
  isOnboardingComplete,
  loadCounts,
  loadHistory,
  saveCounts,
  saveHistory
} from "./src/storage";

type Tab = "home" | "calc" | "map" | "history" | "goals" | "guide";

const NAVY = "#06283A";
const GREEN = "#087A55";
const MINT = "#EAF6EF";
const LINE = "#DDE8E4";
const MUTED = "#6D7E87";
const BANNER_AD_UNIT_ID = "ca-app-pub-1906928325769847/2619167313";
const INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-1906928325769847/1306085646";
const INTERSTITIAL_SCREEN_INTERVAL = 7;

const interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, {
  requestNonPersonalizedAdsOnly: false
});

const tabs: Array<{ id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: "home", label: "Start", icon: "home-outline" },
  { id: "calc", label: "Kalkulator", icon: "calculator-outline" },
  { id: "map", label: "Mapa", icon: "location-outline" },
  { id: "history", label: "Historia", icon: "time-outline" },
  { id: "goals", label: "Cele", icon: "flame-outline" }
];

const screenTitles: Record<Tab, string> = {
  home: "Kaucjomat",
  calc: "Kalkulator",
  map: "Mapa",
  history: "Historia zwrotów",
  goals: "Zbiórki i cele",
  guide: "Jak oddać"
};

const onboarding = [
  {
    icon: "scan-outline" as const,
    title: "Oddawaj tylko oznaczone opakowania",
    body: "Szukaj znaku kaucji na etykiecie. Aplikacja pomoże policzyć zwrot przed wizytą w punkcie."
  },
  {
    icon: "calculator-outline" as const,
    title: "Policz kwotę w kilka sekund",
    body: "Ustaw liczbę butelek i puszek suwakiem albo przyciskami, a Kaucjomat pokaże sumę."
  },
  {
    icon: "leaf-outline" as const,
    title: "Zapisuj postęp lokalnie",
    body: "Historia i cele zostają na telefonie. Bez konta, bez logowania, bez wysyłania danych."
  }
];

const firstOnboardingStep = onboarding[0]!;

const defaultRegion: Region = {
  latitude: 52.2297,
  longitude: 21.0122,
  latitudeDelta: 0.07,
  longitudeDelta: 0.07
};

const distanceInKm = (
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number }
) => {
  const earthRadiusKm = 6371;
  const latDelta = ((second.latitude - first.latitude) * Math.PI) / 180;
  const lonDelta = ((second.longitude - first.longitude) * Math.PI) / 180;
  const lat1 = (first.latitude * Math.PI) / 180;
  const lat2 = (second.latitude * Math.PI) / 180;
  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lonDelta / 2) * Math.sin(lonDelta / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (distance: number) =>
  distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1).replace(".", ",")} km`;

const guideSteps = [
  {
    title: "Szukaj oznaczenia kaucji",
    body: "Sprawdź, czy opakowanie ma znak kaucji i wartość zwrotu."
  },
  {
    title: "Nie zgniataj opakowania",
    body: "Butelki i puszki oddawaj w całości, żeby automat mógł je rozpoznać."
  },
  {
    title: "Oddaj bez paragonu",
    body: "Zwrot jest bez paragonu i dodatkowych formalności."
  },
  {
    title: "Opakowanie ma być puste",
    body: "Bez resztek napojów, zakrętek wymaganych przez punkt i większych zabrudzeń."
  },
  {
    title: "Zwrot w dowolnym punkcie",
    body: "Oddaj w sklepie albo punkcie, który przyjmuje opakowania kaucyjne."
  }
];

const goals = [
  { name: "Oszczędzam na rower", current: 68.5, target: 100, icon: "bicycle-outline" as const },
  { name: "Zbiórka szkolna", current: 132, target: 250, icon: "school-outline" as const },
  { name: "Wyzwanie tygodnia", current: 18.5, target: 25, icon: "trophy-outline" as const },
  { name: "Na zieloną klasę", current: 210, target: 500, icon: "leaf-outline" as const }
];

export default function App() {
  const [counts, setCounts] = useState<Counts>(INITIAL_COUNTS);
  const [history, setHistory] = useState<ReturnEntry[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingIndex, setOnboardingIndex] = useState(0);
  const [region, setRegion] = useState<Region>(defaultRegion);
  const [interstitialLoaded, setInterstitialLoaded] = useState(false);
  const screenChangeCountRef = useRef(0);

  const amount = useMemo(() => calculateAmount(counts), [counts]);
  const totalCount = useMemo(() => countAll(counts), [counts]);
  const totalSaved = useMemo(
    () => history.reduce((sum, entry) => sum + entry.amount, 0),
    [history]
  );

  useEffect(() => {
    void mobileAds().initialize();
    void analytics().logScreenView({
      screen_name: "home",
      screen_class: screenTitles.home
    });
    void hydrate();
    void locateUser();
  }, []);

  useEffect(() => {
    const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      setInterstitialLoaded(true);
    });
    const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      setInterstitialLoaded(false);
      interstitial.load();
    });
    const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, () => {
      setInterstitialLoaded(false);
    });

    interstitial.load();

    return () => {
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
    };
  }, []);

  useEffect(() => {
    void saveCounts(counts);
  }, [counts]);

  const hydrate = async () => {
    setCounts(await loadCounts());
    setHistory(await loadHistory());
    setShowOnboarding(!(await isOnboardingComplete()));
  };

  const locateUser = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") return;

    const location = await Location.getCurrentPositionAsync({});
    setRegion({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.055,
      longitudeDelta: 0.055
    });
  };

  const setPackageCount = (id: PackageKind, value: number) => {
    setCounts((current) => ({ ...current, [id]: Math.max(0, Math.round(value)) }));
  };

  const clearCounts = () => setCounts(INITIAL_COUNTS);

  const saveReturn = async () => {
    if (totalCount === 0) {
      Alert.alert("Brak opakowań", "Dodaj przynajmniej jedną butelkę albo puszkę.");
      return;
    }

    const nextHistory: ReturnEntry[] = [
      {
        id: `${Date.now()}`,
        createdAt: new Date().toISOString(),
        counts,
        amount
      },
      ...history
    ];

    setHistory(nextHistory);
    await saveHistory(nextHistory);
    clearCounts();
    Alert.alert("Zapisano zwrot", `Do historii trafiło ${formatMoney(amount)}.`);
  };

  const finishOnboarding = async () => {
    await completeOnboarding();
    setShowOnboarding(false);
  };

  const navigate = (tab: Tab) => {
    if (tab === activeTab) return;

    setActiveTab(tab);
    void analytics().logScreenView({
      screen_name: tab,
      screen_class: screenTitles[tab]
    });
    screenChangeCountRef.current += 1;

    if (
      screenChangeCountRef.current % INTERSTITIAL_SCREEN_INTERVAL === 0 &&
      interstitialLoaded
    ) {
      interstitial.show();
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.app}>
          {activeTab !== "home" && (
            <TopBar
              title={screenTitles[activeTab]}
              onBack={() => navigate("home")}
              actionIcon={activeTab === "map" ? "options-outline" : activeTab === "history" ? "calendar-outline" : undefined}
            />
          )}
          <View style={styles.content}>
            {activeTab === "home" && (
              <HomeScreen
                amount={amount}
                totalSaved={totalSaved}
                onNavigate={navigate}
              />
            )}
            {activeTab === "calc" && (
              <CalculatorScreen
                counts={counts}
                amount={amount}
                totalCount={totalCount}
                onSetCount={setPackageCount}
                onSave={saveReturn}
                onClear={clearCounts}
              />
            )}
            {activeTab === "map" && <MapScreen region={region} />}
            {activeTab === "history" && <HistoryScreen history={history} totalSaved={totalSaved} />}
            {activeTab === "goals" && <GoalsScreen />}
            {activeTab === "guide" && <GuideScreen onReplayTutorial={() => setShowOnboarding(true)} />}
          </View>
          <BannerAd unitId={BANNER_AD_UNIT_ID} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
          <BottomTabs activeTab={activeTab} onChange={navigate} />
        </View>
        <OnboardingModal
          visible={showOnboarding}
          index={onboardingIndex}
          onNext={() => {
            if (onboardingIndex === onboarding.length - 1) {
              void finishOnboarding();
            } else {
              setOnboardingIndex((current) => current + 1);
            }
          }}
          onSkip={() => void finishOnboarding()}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function TopBar({
  title,
  actionIcon,
  onBack
}: {
  title: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  onBack: () => void;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable style={styles.topIcon} onPress={onBack}>
        <Ionicons name="chevron-back-outline" size={24} color={NAVY} />
      </Pressable>
      <Text style={styles.topTitle}>{title}</Text>
      <View style={styles.topIcon}>
        {actionIcon && <Ionicons name={actionIcon} size={22} color={NAVY} />}
      </View>
    </View>
  );
}

function HomeScreen({
  amount,
  totalSaved,
  onNavigate
}: {
  amount: number;
  totalSaved: number;
  onNavigate: (tab: Tab) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.homeContent} showsVerticalScrollIndicator={false}>
      <View style={styles.homeHeader}>
        <View style={styles.logoMark}>
          <Ionicons name="refresh-outline" size={35} color="#FFFFFF" />
          <Ionicons name="water-outline" size={28} color="#FFFFFF" style={styles.logoBottle} />
        </View>
        <View style={styles.homeTitleWrap}>
          <Text style={styles.appTitle}>Kaucjomat</Text>
          <Text style={styles.appSubtitle}>Policz zwrot i znajdź najbliższy butelkomat</Text>
        </View>
        <Ionicons name="notifications-outline" size={23} color={NAVY} />
      </View>

      <LinearGradient colors={["#5DBE54", "#00846B"]} style={styles.refundCard}>
        <View>
          <Text style={styles.refundLabel}>Szacowany zwrot</Text>
          <Text style={styles.refundValue}>{formatMoney(amount)}</Text>
          <Text style={styles.refundNote}>
            {amount > 0 ? "To się opłaca i ma znaczenie!" : "Dodaj opakowania w kalkulatorze."}
          </Text>
        </View>
        <Ionicons name="leaf-outline" size={70} color="rgba(255,255,255,0.22)" />
      </LinearGradient>

      <View style={styles.quickGrid}>
        <QuickTile icon="calculator-outline" label="Kalkulator" onPress={() => onNavigate("calc")} />
        <QuickTile icon="location-outline" label="Mapa" onPress={() => onNavigate("map")} />
        <QuickTile icon="book-outline" label="Jak oddać" onPress={() => onNavigate("guide")} />
        <QuickTile icon="time-outline" label="Historia" onPress={() => onNavigate("history")} />
      </View>

      <View style={styles.rateCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Stawki kaucji w systemie</Text>
          <Ionicons name="information-circle-outline" size={18} color={MUTED} />
        </View>
        {PACKAGES.map((item) => (
          <View key={item.id} style={styles.rateRow}>
            <BottleIcon kind={item.id} />
            <Text style={styles.rateName}>
              {item.name} {item.limit}
            </Text>
            <Text style={styles.rateValue}>{formatMoney(item.deposit)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.systemCard}>
        <View style={styles.systemIcon}>
          <Ionicons name="calendar-outline" size={23} color={NAVY} />
        </View>
        <View style={styles.systemTextWrap}>
          <Text style={styles.systemTitle}>System kaucyjny w Polsce</Text>
          <CheckLine text="Dla opakowań ze znakiem kaucji" />
          <CheckLine text="Bez paragonu" />
          <CheckLine text="Tylko opakowania w systemie" />
        </View>
      </View>

      <Text style={styles.microCopy}>
        Łącznie zapisano w historii: {formatMoney(totalSaved)}
      </Text>
    </ScrollView>
  );
}

function QuickTile({
  icon,
  label,
  onPress
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.quickTile} onPress={onPress}>
      <Ionicons name={icon} size={31} color={GREEN} />
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function CalculatorScreen({
  counts,
  amount,
  totalCount,
  onSetCount,
  onSave,
  onClear
}: {
  counts: Counts;
  amount: number;
  totalCount: number;
  onSetCount: (id: PackageKind, value: number) => void;
  onSave: () => void;
  onClear: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.helperText}>Wybierz rodzaje opakowań i policz zwrot.</Text>
      {PACKAGES.map((item) => (
        <View key={item.id} style={styles.calcRow}>
          <View style={styles.productCircle}>
            <BottleIcon kind={item.id} large />
          </View>
          <View style={styles.calcBody}>
            <Text style={styles.packageName}>{item.name}</Text>
            <Text style={styles.packageDescription}>
              {item.limit} - {formatMoney(item.deposit)}
            </Text>
            <View style={styles.counterRow}>
              <IconButton icon="remove-outline" onPress={() => onSetCount(item.id, counts[item.id] - 1)} />
              <View style={styles.counterValueBox}>
                <Text style={styles.counterValue}>{counts[item.id]}</Text>
              </View>
              <Pressable style={styles.plusButton} onPress={() => onSetCount(item.id, counts[item.id] + 1)}>
                <Ionicons name="add-outline" size={23} color="#FFFFFF" />
              </Pressable>
            </View>
            <Slider
              minimumValue={0}
              maximumValue={100}
              step={1}
              value={counts[item.id]}
              minimumTrackTintColor={GREEN}
              maximumTrackTintColor="#DCE8E3"
              thumbTintColor={GREEN}
              onValueChange={(value) => onSetCount(item.id, value)}
            />
          </View>
        </View>
      ))}

      <View style={styles.calcSummary}>
        <Text style={styles.calcSummaryLabel}>Razem:</Text>
        <Text style={styles.calcSummaryValue}>{formatMoney(amount)}</Text>
        <Ionicons name="server-outline" size={34} color={GREEN} />
      </View>
      <Text style={styles.tinyHint}>Tylko opakowania ze znakiem kaucji.</Text>

      <View style={styles.actionRow}>
        <Pressable style={styles.secondaryButton} onPress={onClear}>
          <Ionicons name="refresh-outline" size={20} color={NAVY} />
          <Text style={styles.secondaryText}>Wyczyść</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={onSave}>
          <Ionicons name="save-outline" size={20} color="#FFFFFF" />
          <Text style={styles.primaryText}>Zapisz zwrot</Text>
        </Pressable>
      </View>

      <AdPreview title="Ekologiczne rozwiązania dla Twojego domu" />
      <Text style={styles.microCopy}>{totalCount} opakowań w aktualnym zwrocie</Text>
    </ScrollView>
  );
}

function MapScreen({ region }: { region: Region }) {
  const nearestPoints = useMemo(
    () =>
      RETURN_POINTS.map((point) => ({
        ...point,
        distance: distanceInKm(region, point)
      }))
        .sort((first, second) => first.distance - second.distance)
        .slice(0, 8),
    [region]
  );

  return (
    <View style={styles.mapScreen}>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={19} color={MUTED} />
        <TextInput
          placeholder="Szukaj lokalizacji"
          placeholderTextColor="#7F8D95"
          style={styles.searchInput}
        />
      </View>
      <MapView style={styles.map} initialRegion={region} showsUserLocation>
        {RETURN_POINTS.map((point) => (
          <Marker
            key={point.id}
            coordinate={{ latitude: point.latitude, longitude: point.longitude }}
            title={point.name}
            description={point.address}
            pinColor={point.status === "active" ? GREEN : "#4A9F7D"}
          />
        ))}
      </MapView>
      <View style={styles.mapPanel}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Najbliższe punkty</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{RETURN_POINTS.length} punktów</Text>
            <Ionicons name="chevron-down-outline" size={12} color={GREEN} />
          </View>
        </View>
        {nearestPoints.map((point) => (
          <View key={point.id} style={styles.pointRow}>
            <Text style={styles.distance}>{formatDistance(point.distance)}</Text>
            <View style={styles.pointText}>
              <Text style={styles.pointName}>{point.chain ?? point.name}</Text>
              <Text style={styles.pointAddress}>{point.address}</Text>
              {point.description && <Text style={styles.pointDescription}>{point.description}</Text>}
            </View>
            <View style={styles.hoursBox}>
              <Text style={styles.openText}>{point.type === "automat" ? "Butelkomat" : "Punkt"}</Text>
              <Text style={styles.hoursText}>{point.hours ?? "8:00-22:00"}</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={17} color={MUTED} />
          </View>
        ))}
      </View>
    </View>
  );
}

function HistoryScreen({ history, totalSaved }: { history: ReturnEntry[]; totalSaved: number }) {
  if (history.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="time-outline" size={48} color="#7EA390" />
        <Text style={styles.emptyTitle}>Historia zwrotów</Text>
        <Text style={styles.emptyBody}>Zapisz pierwszy zwrot z kalkulatora, a pojawi się tutaj.</Text>
      </View>
    );
  }

  return (
    <View style={styles.historyScreen}>
      <View style={styles.filterRow}>
        <View style={styles.filterPill}>
          <Text style={styles.filterText}>Ten miesiąc</Text>
          <Ionicons name="chevron-down-outline" size={14} color={NAVY} />
        </View>
        <View style={styles.filterPill}>
          <Text style={styles.filterText}>Tydzień</Text>
          <Ionicons name="chevron-down-outline" size={14} color={NAVY} />
        </View>
      </View>
      <Text style={styles.historyLabel}>Łącznie odzyskano</Text>
      <Text style={styles.historyTotal}>{formatMoney(totalSaved)}</Text>
      <View style={styles.chartCard}>
        {[2, 5, 7, 4, 8, 5, 9, 3].map((height, index) => (
          <View key={index} style={styles.chartColumnWrap}>
            <View style={[styles.chartColumn, { height: height * 11 }]} />
          </View>
        ))}
      </View>
      <FlatList
        data={history}
        keyExtractor={(entry) => entry.id}
        renderItem={({ item }) => (
          <View style={styles.historyRow}>
            <Text style={styles.historyDate}>
              {new Intl.DateTimeFormat("pl-PL", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
              }).format(new Date(item.createdAt))}
            </Text>
            <View style={styles.historyMiddle}>
              <Text style={styles.historyPlace}>Zwrot w punkcie</Text>
              <Text style={styles.historyAddress}>ul. Zielona 15</Text>
            </View>
            <Text style={styles.historyAmount}>+{formatMoney(item.amount)}</Text>
          </View>
        )}
        ListFooterComponent={<AdPreview title="Zadbaj o planetę każdego dnia" />}
      />
    </View>
  );
}

function GoalsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <View style={styles.goalHeader}>
        <View>
          <Text style={styles.sectionTitle}>Zbiórki i cele</Text>
          <Text style={styles.helperText}>Moje cele</Text>
        </View>
        <Pressable style={styles.addGoalButton}>
          <Ionicons name="add-outline" size={22} color="#FFFFFF" />
        </Pressable>
      </View>
      {goals.map((goal, index) => (
        <GoalCard key={goal.name} goal={goal} highlighted={index === 0} />
      ))}
      <AdPreview title="Energia ze słońca dla Twojego domu" />
    </ScrollView>
  );
}

function GuideScreen({ onReplayTutorial }: { onReplayTutorial: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <View style={styles.guideCard}>
        <Text style={styles.sectionTitle}>Jak oddać opakowania?</Text>
        {guideSteps.map((step, index) => (
          <View key={step.title} style={styles.guideRow}>
            <View style={styles.guideIcon}>
              <Text style={styles.guideNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.guideTextWrap}>
              <Text style={styles.guideTitle}>{step.title}</Text>
              <Text style={styles.guideText}>{step.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.infoBand}>
        <Ionicons name="shield-checkmark-outline" size={21} color={GREEN} />
        <Text style={styles.infoBandText}>Sklepy powyżej 200 m² mają obowiązek przyjmować zwroty.</Text>
      </View>

      <Pressable style={styles.secondaryButtonWide} onPress={onReplayTutorial}>
        <Ionicons name="play-circle-outline" size={20} color={NAVY} />
        <Text style={styles.secondaryText}>Pokaż tutorial</Text>
      </Pressable>
    </ScrollView>
  );
}

function GoalCard({
  goal,
  highlighted
}: {
  goal: { name: string; current: number; target: number; icon: keyof typeof Ionicons.glyphMap };
  highlighted?: boolean;
}) {
  const progress = Math.min(1, goal.current / goal.target);

  return (
    <View style={[styles.goalCard, highlighted && styles.goalCardHero]}>
      <View style={styles.goalTop}>
        <View>
          <Text style={styles.goalName}>{goal.name}</Text>
          <Text style={styles.goalAmount}>{formatMoney(goal.current)}</Text>
        </View>
        <View style={styles.goalIcon}>
          <Ionicons name={goal.icon} size={42} color={GREEN} />
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.goalMeta}>
        <Text style={styles.goalMetaText}>{Math.round(progress * 100)}% celu</Text>
        <Text style={styles.goalMetaText}>Cel: {formatMoney(goal.target)}</Text>
      </View>
    </View>
  );
}

function BottomTabs({ activeTab, onChange }: { activeTab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <View style={styles.tabs}>
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <Pressable key={tab.id} style={styles.tabButton} onPress={() => onChange(tab.id)}>
            <Ionicons name={tab.icon} size={22} color={active ? GREEN : "#7D8A93"} />
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function OnboardingModal({
  visible,
  index,
  onNext,
  onSkip
}: {
  visible: boolean;
  index: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const step = onboarding[index] ?? firstOnboardingStep;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe}>
        <LinearGradient colors={["#F9FCFA", "#EAF6EF"]} style={styles.onboardingBody}>
          <View style={styles.onboardingIcon}>
            <Ionicons name={step.icon} size={42} color="#FFFFFF" />
          </View>
          <Text style={styles.onboardingTitle}>{step.title}</Text>
          <Text style={styles.onboardingText}>{step.body}</Text>
          <View style={styles.dots}>
            {onboarding.map((_, dotIndex) => (
              <View key={dotIndex} style={[styles.dot, dotIndex === index && styles.dotActive]} />
            ))}
          </View>
        </LinearGradient>
        <View style={styles.onboardingActions}>
          <Pressable style={styles.skipButton} onPress={onSkip}>
            <Text style={styles.skipText}>Pomiń</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={onNext}>
            <Text style={styles.primaryText}>
              {index === onboarding.length - 1 ? "Zaczynamy" : "Dalej"}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function IconButton({
  icon,
  onPress
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.iconButton} onPress={onPress}>
      <Ionicons name={icon} size={20} color={GREEN} />
    </Pressable>
  );
}

function BottleIcon({ kind, large }: { kind: PackageKind; large?: boolean }) {
  const icon = kind === "can" ? "battery-full-outline" : kind === "glass" ? "wine-outline" : "water-outline";
  const color = kind === "can" ? "#6B7378" : kind === "glass" ? "#128045" : "#2D80C8";

  return <Ionicons name={icon} size={large ? 48 : 25} color={color} />;
}

function CheckLine({ text }: { text: string }) {
  return (
    <View style={styles.checkLine}>
      <Ionicons name="checkmark-circle" size={18} color={GREEN} />
      <Text style={styles.checkText}>{text}</Text>
    </View>
  );
}

function AdPreview({ title }: { title: string }) {
  return (
    <View style={styles.adPreview}>
      <View>
        <Text style={styles.adLabel}>Reklama</Text>
        <Text style={styles.adTitle}>{title}</Text>
      </View>
      <Ionicons name="chevron-forward-outline" size={24} color={NAVY} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7FAF8"
  },
  app: {
    flex: 1,
    backgroundColor: "#F7FAF8"
  },
  content: {
    flex: 1
  },
  topBar: {
    height: 58,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F7FAF8"
  },
  topIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center"
  },
  topTitle: {
    color: NAVY,
    fontSize: 18,
    fontWeight: "900"
  },
  homeContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 14
  },
  homeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13
  },
  logoMark: {
    width: 76,
    height: 76,
    borderRadius: 8,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: GREEN,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  },
  logoBottle: {
    position: "absolute"
  },
  homeTitleWrap: {
    flex: 1
  },
  appTitle: {
    color: NAVY,
    fontSize: 36,
    fontWeight: "900"
  },
  appSubtitle: {
    color: NAVY,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 2
  },
  refundCard: {
    minHeight: 118,
    borderRadius: 8,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#004C40",
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 9 },
    elevation: 4
  },
  refundLabel: {
    color: "#E8FFF2",
    fontSize: 15,
    fontWeight: "800"
  },
  refundValue: {
    color: "#FFFFFF",
    fontSize: 38,
    fontWeight: "900",
    marginTop: 5
  },
  refundNote: {
    color: "#FFFFFF",
    fontSize: 13,
    marginTop: 3
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  quickTile: {
    width: "48.5%",
    minHeight: 80,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: LINE,
    shadowColor: "#0B2832",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  quickLabel: {
    color: NAVY,
    fontSize: 13,
    fontWeight: "900"
  },
  rateCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LINE,
    padding: 14
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: NAVY,
    fontSize: 18,
    fontWeight: "900"
  },
  rateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#EEF3F1",
    paddingTop: 12,
    marginTop: 12
  },
  rateName: {
    flex: 1,
    color: NAVY,
    fontSize: 13,
    fontWeight: "800"
  },
  rateValue: {
    color: GREEN,
    fontSize: 16,
    fontWeight: "900"
  },
  systemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LINE,
    padding: 15,
    flexDirection: "row",
    gap: 12
  },
  systemIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#E9F4F7",
    alignItems: "center",
    justifyContent: "center"
  },
  systemTextWrap: {
    flex: 1,
    gap: 7
  },
  systemTitle: {
    color: NAVY,
    fontSize: 16,
    fontWeight: "900"
  },
  checkLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  checkText: {
    color: NAVY,
    fontSize: 13,
    fontWeight: "700"
  },
  screenContent: {
    padding: 18,
    paddingBottom: 28,
    gap: 13
  },
  helperText: {
    color: MUTED,
    fontSize: 14
  },
  calcRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: "#FDFEFE"
  },
  productCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: LINE,
    shadowColor: "#0B2832",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  calcBody: {
    flex: 1
  },
  packageName: {
    color: NAVY,
    fontSize: 16,
    fontWeight: "900"
  },
  packageDescription: {
    color: NAVY,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#EEF7F2",
    borderWidth: 1,
    borderColor: "#CFE5DA",
    alignItems: "center",
    justifyContent: "center"
  },
  plusButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: GREEN,
    shadowOpacity: 0.26,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  counterValueBox: {
    flex: 1,
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: "#F5F7F7",
    borderWidth: 1,
    borderColor: LINE,
    alignItems: "center",
    justifyContent: "center"
  },
  counterValue: {
    color: NAVY,
    fontSize: 22,
    fontWeight: "900"
  },
  calcSummary: {
    minHeight: 70,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BFDCD2",
    backgroundColor: "#EAF7F4",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 13
  },
  calcSummaryLabel: {
    color: NAVY,
    fontSize: 18,
    fontWeight: "900"
  },
  calcSummaryValue: {
    flex: 1,
    color: GREEN,
    fontSize: 30,
    fontWeight: "900",
    textAlign: "right"
  },
  tinyHint: {
    color: MUTED,
    fontSize: 12,
    marginTop: -7
  },
  actionRow: {
    flexDirection: "row",
    gap: 10
  },
  primaryButton: {
    minHeight: 50,
    flex: 1,
    borderRadius: 8,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900"
  },
  secondaryButton: {
    minHeight: 50,
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#EAF3EF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16
  },
  secondaryButtonWide: {
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: "#EAF3EF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16
  },
  secondaryText: {
    color: NAVY,
    fontSize: 16,
    fontWeight: "900"
  },
  adPreview: {
    minHeight: 66,
    borderRadius: 8,
    backgroundColor: "#EAF5FB",
    borderWidth: 1,
    borderColor: "#C9DDEA",
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  adLabel: {
    color: MUTED,
    fontSize: 10,
    marginBottom: 4
  },
  adTitle: {
    color: NAVY,
    fontSize: 13,
    fontWeight: "900"
  },
  microCopy: {
    color: MUTED,
    fontSize: 12,
    textAlign: "center"
  },
  mapScreen: {
    flex: 1,
    paddingTop: 2
  },
  searchWrap: {
    marginHorizontal: 18,
    marginBottom: 10,
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: "#F1F4F5",
    borderWidth: 1,
    borderColor: LINE,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8
  },
  searchInput: {
    flex: 1,
    color: NAVY,
    fontSize: 14
  },
  map: {
    flex: 1
  },
  mapPanel: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
    borderColor: LINE
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: MINT,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  statusPillText: {
    color: GREEN,
    fontSize: 11,
    fontWeight: "900"
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#EEF3F1",
    paddingVertical: 12
  },
  distance: {
    width: 48,
    color: NAVY,
    fontSize: 13,
    fontWeight: "900"
  },
  pointText: {
    flex: 1
  },
  pointName: {
    color: NAVY,
    fontSize: 14,
    fontWeight: "900"
  },
  pointAddress: {
    color: MUTED,
    fontSize: 12,
    marginTop: 1
  },
  pointDescription: {
    color: "#8A989F",
    fontSize: 11,
    marginTop: 2
  },
  hoursBox: {
    alignItems: "flex-start"
  },
  openText: {
    color: GREEN,
    fontSize: 11,
    fontWeight: "900"
  },
  hoursText: {
    color: NAVY,
    fontSize: 10
  },
  historyScreen: {
    flex: 1,
    paddingHorizontal: 18
  },
  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF"
  },
  filterText: {
    color: NAVY,
    fontSize: 13,
    fontWeight: "800"
  },
  historyLabel: {
    color: NAVY,
    fontSize: 13,
    fontWeight: "800"
  },
  historyTotal: {
    color: GREEN,
    fontSize: 29,
    fontWeight: "900",
    marginTop: 1
  },
  chartCard: {
    height: 124,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: LINE,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 14,
    paddingHorizontal: 17,
    paddingVertical: 14,
    marginVertical: 12
  },
  chartColumnWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  chartColumn: {
    width: 14,
    borderRadius: 7,
    backgroundColor: "#62B64E"
  },
  historyRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF3F1",
    gap: 11
  },
  historyDate: {
    width: 78,
    color: NAVY,
    fontSize: 13,
    fontWeight: "700"
  },
  historyMiddle: {
    flex: 1
  },
  historyPlace: {
    color: NAVY,
    fontSize: 13,
    fontWeight: "900"
  },
  historyAddress: {
    color: MUTED,
    fontSize: 12
  },
  historyAmount: {
    color: GREEN,
    fontSize: 14,
    fontWeight: "900"
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: "900",
    color: NAVY
  },
  emptyBody: {
    marginTop: 6,
    fontSize: 15,
    color: MUTED,
    textAlign: "center"
  },
  goalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  addGoalButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center"
  },
  goalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: LINE,
    gap: 12
  },
  goalCardHero: {
    backgroundColor: "#F3FAF6"
  },
  goalTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  goalName: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "900"
  },
  goalAmount: {
    color: GREEN,
    fontSize: 26,
    fontWeight: "900",
    marginTop: 6
  },
  goalIcon: {
    width: 70,
    height: 58,
    alignItems: "center",
    justifyContent: "center"
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D8E4DF",
    overflow: "hidden"
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#33A15C"
  },
  goalMeta: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  goalMetaText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "700"
  },
  guideCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: LINE,
    gap: 9
  },
  guideRow: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#F4F8F5",
    borderRadius: 8,
    padding: 10
  },
  guideIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center"
  },
  guideNumberText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900"
  },
  guideTextWrap: {
    flex: 1
  },
  guideTitle: {
    color: NAVY,
    fontSize: 13,
    fontWeight: "900"
  },
  guideText: {
    color: NAVY,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2
  },
  infoBand: {
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: "#EAF8EB",
    borderWidth: 1,
    borderColor: "#CFE8CE",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 13
  },
  infoBandText: {
    flex: 1,
    color: NAVY,
    fontSize: 13,
    fontWeight: "800"
  },
  tabs: {
    minHeight: 70,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: LINE,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around"
  },
  tabButton: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 62,
    gap: 4
  },
  tabLabel: {
    color: "#7D8A93",
    fontSize: 10,
    fontWeight: "900"
  },
  tabLabelActive: {
    color: GREEN
  },
  modalSafe: {
    flex: 1,
    backgroundColor: "#F7FAF8"
  },
  onboardingBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28
  },
  onboardingIcon: {
    width: 88,
    height: 88,
    borderRadius: 8,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24
  },
  onboardingTitle: {
    color: NAVY,
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center"
  },
  onboardingText: {
    color: MUTED,
    fontSize: 17,
    lineHeight: 25,
    textAlign: "center",
    marginTop: 12
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    marginTop: 30
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#CAD8D1"
  },
  dotActive: {
    width: 28,
    backgroundColor: GREEN
  },
  onboardingActions: {
    flexDirection: "row",
    gap: 10,
    padding: 18
  },
  skipButton: {
    minHeight: 50,
    flex: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  skipText: {
    color: MUTED,
    fontWeight: "900",
    fontSize: 16
  }
});
