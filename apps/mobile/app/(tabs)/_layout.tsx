import { Tabs } from "expo-router";
import { Home, TrendingUp, Zap, Briefcase, MessageSquare, Calculator, BarChart3 } from "lucide-react-native";

const C = {
  primary: "#7c3aed",
  gold: "#f59e0b",
  tabBg: "#050508",
  border: "#1e1e35",
  inactive: "#ffffff35",
};

function TabIcon({ Icon, color }: { Icon: any; color: string }) {
  return <Icon size={20} color={color} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.tabBg,
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarActiveTintColor: C.gold,
        tabBarInactiveTintColor: C.inactive,
        tabBarLabelStyle: { fontSize: 9, fontWeight: "700", letterSpacing: 0.3 },
      }}
    >
      <Tabs.Screen name="index"       options={{ title: "Ana Ekran",  tabBarIcon: ({ color }) => <TabIcon Icon={Home}        color={color} /> }} />
      <Tabs.Screen name="market"      options={{ title: "Piyasalar", tabBarIcon: ({ color }) => <TabIcon Icon={TrendingUp}  color={color} /> }} />
      <Tabs.Screen name="signals"     options={{ title: "Sinyaller", tabBarIcon: ({ color }) => <TabIcon Icon={Zap}         color={color} /> }} />
      <Tabs.Screen name="scenario"    options={{ title: "Senaryo",   tabBarIcon: ({ color }) => <TabIcon Icon={Calculator}  color={color} /> }} />
      <Tabs.Screen name="portfolio"   options={{ title: "Portföy",   tabBarIcon: ({ color }) => <TabIcon Icon={Briefcase}   color={color} /> }} />
      <Tabs.Screen name="performance" options={{ title: "Performans",tabBarIcon: ({ color }) => <TabIcon Icon={BarChart3}   color={color} /> }} />
      <Tabs.Screen name="copilot"     options={{ title: "AI Copilot",tabBarIcon: ({ color }) => <TabIcon Icon={MessageSquare} color={color} /> }} />
    </Tabs>
  );
}
