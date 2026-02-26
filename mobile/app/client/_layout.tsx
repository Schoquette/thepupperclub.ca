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

export default function ClientLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#F6F3EE',
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
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📅" label="Walks" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="💬" label="Messages" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="💳" label="Invoices" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="dogs"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🐕" label="Dogs" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profile" focused={focused} />,
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
