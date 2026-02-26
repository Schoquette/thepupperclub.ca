import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={s.tab}>
      <Text style={s.emoji}>{emoji}</Text>
      <Text style={[s.label, focused && s.labelActive]}>{label}</Text>
    </View>
  );
}

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#3B2F2A',
          borderTopColor: '#2a211d',
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 16,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#C9A24D',
        tabBarInactiveTintColor: '#C8BFB6',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Today" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="👥" label="Clients" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="💬" label="Inbox" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const s = StyleSheet.create({
  tab:        { alignItems: 'center', justifyContent: 'center', paddingTop: 6 },
  emoji:      { fontSize: 22 },
  label:      { fontSize: 10, color: '#C8BFB6', marginTop: 2, fontWeight: '500' },
  labelActive:{ color: '#C9A24D', fontWeight: '700' },
});
