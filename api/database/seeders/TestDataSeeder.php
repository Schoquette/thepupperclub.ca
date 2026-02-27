<?php

namespace Database\Seeders;

use App\Models\Appointment;
use App\Models\ClientProfile;
use App\Models\Conversation;
use App\Models\Dog;
use App\Models\Invoice;
use App\Models\InvoiceLineItem;
use App\Models\Message;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Models\VaccinationRecord;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class TestDataSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('email', 'sophie@thepupperclub.ca')->first();

        // ── Clients ───────────────────────────────────────────────────────────

        $emma = User::firstOrCreate(['email' => 'emma@test.com'], [
            'name'     => 'Emma Johnson',
            'password' => Hash::make('password123'),
            'role'     => 'client',
            'status'   => 'active',
        ]);

        ClientProfile::firstOrCreate(['user_id' => $emma->id], [
            'phone'                   => '604-555-0101',
            'address'                 => '1234 Maple Street',
            'city'                    => 'Vancouver',
            'province'                => 'BC',
            'postal_code'             => 'V6B 1A1',
            'emergency_contact_name'  => 'James Johnson',
            'emergency_contact_phone' => '604-555-0102',
            'billing_method'          => 'credit_card',
            'subscription_tier'       => 'premium',
            'subscription_start_date' => now()->subMonths(3),
            'notes'                   => 'Prefers morning walks. Gate code 1234.',
        ]);

        $marcus = User::firstOrCreate(['email' => 'marcus@test.com'], [
            'name'     => 'Marcus Wilson',
            'password' => Hash::make('password123'),
            'role'     => 'client',
            'status'   => 'active',
        ]);

        ClientProfile::firstOrCreate(['user_id' => $marcus->id], [
            'phone'                   => '604-555-0201',
            'address'                 => '56 Oak Avenue',
            'city'                    => 'Vancouver',
            'province'                => 'BC',
            'postal_code'             => 'V5K 2B3',
            'emergency_contact_name'  => 'Linda Wilson',
            'emergency_contact_phone' => '604-555-0202',
            'billing_method'          => 'e_transfer',
            'subscription_tier'       => 'basic',
            'subscription_start_date' => now()->subMonth(),
        ]);

        $sarah = User::firstOrCreate(['email' => 'sarah@test.com'], [
            'name'     => 'Sarah Chen',
            'password' => Hash::make('password123'),
            'role'     => 'client',
            'status'   => 'active',
        ]);

        ClientProfile::firstOrCreate(['user_id' => $sarah->id], [
            'phone'                   => '604-555-0301',
            'address'                 => '789 Pine Crescent',
            'city'                    => 'Burnaby',
            'province'                => 'BC',
            'postal_code'             => 'V5G 3C4',
            'emergency_contact_name'  => 'Kevin Chen',
            'emergency_contact_phone' => '604-555-0302',
            'billing_method'          => 'credit_card',
            'subscription_tier'       => 'standard',
            'subscription_start_date' => now()->subWeeks(2),
        ]);

        // ── Dogs ─────────────────────────────────────────────────────────────

        $buddy = Dog::firstOrCreate(['user_id' => $emma->id, 'name' => 'Buddy'], [
            'breed'               => 'Golden Retriever',
            'date_of_birth'       => '2020-03-15',
            'size'                => 'large',
            'sex'                 => 'male',
            'weight_kg'           => 32.5,
            'colour'              => 'Golden',
            'spayed_neutered'     => true,
            'is_active'           => true,
            'vet_name'            => 'Dr. Sarah Park',
            'vet_phone'           => '604-555-7001',
            'vet_address'         => '100 Animal Clinic Way, Vancouver',
            'special_instructions'=> 'Loves fetch. Always wants to chase squirrels.',
        ]);

        $luna = Dog::firstOrCreate(['user_id' => $emma->id, 'name' => 'Luna'], [
            'breed'           => 'Labrador Retriever',
            'date_of_birth'   => '2021-07-22',
            'size'            => 'large',
            'sex'             => 'female',
            'weight_kg'       => 28.0,
            'colour'          => 'Black',
            'spayed_neutered' => true,
            'is_active'       => true,
            'vet_name'        => 'Dr. Sarah Park',
            'vet_phone'       => '604-555-7001',
            'vet_address'     => '100 Animal Clinic Way, Vancouver',
            'medications'     => [['name' => 'Apoquel', 'dosage' => '16mg', 'frequency' => 'Once daily', 'notes' => 'For skin allergies']],
            'special_instructions' => 'On allergy medication. Don\'t let her roll in grass.',
        ]);

        $mochi = Dog::firstOrCreate(['user_id' => $marcus->id, 'name' => 'Mochi'], [
            'breed'           => 'Border Collie',
            'date_of_birth'   => '2019-11-05',
            'size'            => 'medium',
            'sex'             => 'male',
            'weight_kg'       => 18.0,
            'colour'          => 'Black and White',
            'spayed_neutered' => true,
            'is_active'       => true,
            'vet_name'        => 'Dr. Tom Nguyen',
            'vet_phone'       => '604-555-7002',
            'vet_address'     => '200 Pet Health Blvd, Vancouver',
            'special_instructions' => 'Very high energy. Needs at least 60 mins of activity.',
        ]);

        $bella = Dog::firstOrCreate(['user_id' => $sarah->id, 'name' => 'Bella'], [
            'breed'           => 'Miniature Poodle',
            'date_of_birth'   => '2022-01-30',
            'size'            => 'small',
            'sex'             => 'female',
            'weight_kg'       => 7.5,
            'colour'          => 'Apricot',
            'spayed_neutered' => true,
            'is_active'       => true,
            'vet_name'        => 'Dr. Amy Liu',
            'vet_phone'       => '604-555-7003',
            'vet_address'     => '300 Paws Vet Clinic, Burnaby',
        ]);

        $oliver = Dog::firstOrCreate(['user_id' => $sarah->id, 'name' => 'Oliver'], [
            'breed'           => 'French Bulldog',
            'date_of_birth'   => '2023-05-10',
            'size'            => 'small',
            'sex'             => 'male',
            'weight_kg'       => 11.0,
            'colour'          => 'Brindle',
            'spayed_neutered' => false,
            'is_active'       => false,  // Pending review
            'vet_name'        => 'Dr. Amy Liu',
            'vet_phone'       => '604-555-7003',
            'vet_address'     => '300 Paws Vet Clinic, Burnaby',
            'special_instructions' => 'New dog — still needs review.',
        ]);

        // ── Vaccination Records ───────────────────────────────────────────────

        // Buddy
        VaccinationRecord::firstOrCreate(['dog_id' => $buddy->id, 'vaccine_name' => 'Rabies'], [
            'administered_date' => now()->subYear(),
            'expiry_date'       => now()->addYear(),
        ]);
        VaccinationRecord::firstOrCreate(['dog_id' => $buddy->id, 'vaccine_name' => 'DHPP'], [
            'administered_date' => now()->subMonths(10),
            'expiry_date'       => now()->addMonths(2),
        ]);
        VaccinationRecord::firstOrCreate(['dog_id' => $buddy->id, 'vaccine_name' => 'Bordetella'], [
            'administered_date' => now()->subMonths(5),
            'expiry_date'       => now()->addMonths(7),
        ]);

        // Luna (one expired to trigger the badge)
        VaccinationRecord::firstOrCreate(['dog_id' => $luna->id, 'vaccine_name' => 'Rabies'], [
            'administered_date' => now()->subYears(2),
            'expiry_date'       => now()->subMonths(2),  // EXPIRED
        ]);
        VaccinationRecord::firstOrCreate(['dog_id' => $luna->id, 'vaccine_name' => 'DHPP'], [
            'administered_date' => now()->subMonths(8),
            'expiry_date'       => now()->addMonths(4),
        ]);

        // Mochi
        VaccinationRecord::firstOrCreate(['dog_id' => $mochi->id, 'vaccine_name' => 'Rabies'], [
            'administered_date' => now()->subMonths(6),
            'expiry_date'       => now()->addMonths(18),
        ]);
        VaccinationRecord::firstOrCreate(['dog_id' => $mochi->id, 'vaccine_name' => 'DHPP'], [
            'administered_date' => now()->subMonths(6),
            'expiry_date'       => now()->addMonths(18),
        ]);

        // Bella
        VaccinationRecord::firstOrCreate(['dog_id' => $bella->id, 'vaccine_name' => 'Rabies'], [
            'administered_date' => now()->subMonths(3),
            'expiry_date'       => now()->addMonths(21),
        ]);

        // ── Appointments ─────────────────────────────────────────────────────

        $this->makeAppointment($emma, [$buddy->id, $luna->id], 'walk_60',    'morning',       now()->subWeeks(2)->setTime(9, 0),  'completed', 60);
        $this->makeAppointment($emma, [$buddy->id],            'walk_30',    'early_morning', now()->subWeeks(1)->setTime(8, 0),  'completed', 30);
        $this->makeAppointment($emma, [$buddy->id, $luna->id], 'walk_60',    'morning',       now()->subDay()->setTime(9, 30),    'completed', 60);
        $this->makeAppointment($emma, [$buddy->id],            'walk_30',    'morning',       now()->setTime(9, 0),               'checked_in', 30);
        $this->makeAppointment($emma, [$buddy->id, $luna->id], 'walk_60',    'morning',       now()->addDay()->setTime(9, 0),     'scheduled', 60);
        $this->makeAppointment($emma, [$buddy->id],            'drop_in',    'midday',        now()->addDays(3)->setTime(12, 0),  'scheduled', 30);
        $this->makeAppointment($emma, [$buddy->id, $luna->id], 'day_boarding','morning',      now()->addWeek()->setTime(8, 30),   'scheduled', 480);

        $this->makeAppointment($marcus, [$mochi->id], 'walk_60',  'afternoon', now()->subDays(3)->setTime(14, 0), 'completed', 60);
        $this->makeAppointment($marcus, [$mochi->id], 'walk_60',  'morning',   now()->addDay()->setTime(10, 0),   'scheduled', 60);

        $this->makeAppointment($sarah, [$bella->id], 'walk_30', 'afternoon', now()->addDays(8)->setTime(15, 0), 'scheduled', 30);

        // ── Service Requests ─────────────────────────────────────────────────

        ServiceRequest::firstOrCreate(
            ['user_id' => $marcus->id, 'status' => 'pending'],
            [
                'service_type'       => 'drop_in',
                'preferred_date'     => now()->addDays(5)->toDateString(),
                'preferred_time_block'=> 'afternoon',
                'notes'              => 'Mochi needs a check-in visit while I\'m at work.',
                'dog_ids'            => [$mochi->id],
            ]
        );

        // ── Conversations & Messages ──────────────────────────────────────────

        if ($admin) {
            $this->seedConversation($emma, $admin, [
                ['sender' => $admin, 'body' => 'Hi Emma! Welcome to The Pupper Club. We\'re so excited to start walking Buddy and Luna!', 'hours_ago' => 72],
                ['sender' => $emma,  'body' => 'Thank you so much! Buddy is already so excited 🐾', 'hours_ago' => 71],
                ['sender' => $admin, 'body' => 'Quick reminder that Buddy and Luna have a walk scheduled tomorrow morning at 9 AM.', 'hours_ago' => 24],
                ['sender' => $emma,  'body' => 'Perfect! They\'re ready to go. Lockbox code is 4587.', 'hours_ago' => 23],
                ['sender' => $admin, 'body' => 'We\'re here! Starting the walk now 🐕', 'hours_ago' => 1],
            ]);

            $this->seedConversation($marcus, $admin, [
                ['sender' => $admin,  'body' => 'Hey Marcus! Mochi had a great walk today. He found every puddle on the route 😄', 'hours_ago' => 48],
                ['sender' => $marcus, 'body' => 'Ha! That sounds like him. How far did you go?', 'hours_ago' => 47],
                ['sender' => $admin,  'body' => 'About 5km along the seawall. He was zooming the whole time!', 'hours_ago' => 47],
                ['sender' => $marcus, 'body' => 'Amazing. I submitted a drop-in request for next week. Let me know if that works!', 'hours_ago' => 2],
            ]);

            $this->seedConversation($sarah, $admin, [
                ['sender' => $admin, 'body' => 'Hi Sarah! I\'ve added Bella to the system. Looking forward to meeting her!', 'hours_ago' => 36],
                ['sender' => $sarah, 'body' => 'She\'s a bit shy at first but warms up quickly. She loves treats!', 'hours_ago' => 35],
            ]);
        }

        // ── Invoices ─────────────────────────────────────────────────────────

        // Emma - paid invoice
        $inv1 = Invoice::firstOrCreate(
            ['user_id' => $emma->id, 'invoice_number' => 'PC-' . date('Y') . '-0001'],
            [
                'status'         => 'paid',
                'subtotal'       => 250.00,
                'gst'            => 12.50,
                'surcharge'      => 7.61,
                'tip'            => 25.00,
                'total'          => 295.11,
                'billing_method' => 'credit_card',
                'due_date'       => now()->subMonth(),
                'paid_at'        => now()->subMonth()->addDays(3),
                'notes'          => 'Monthly subscription — November',
            ]
        );
        if ($inv1->lineItems()->count() === 0) {
            $inv1->lineItems()->createMany([
                ['description' => '60-min Walk × 4', 'quantity' => 4, 'unit_price' => 50.00, 'amount' => 200.00],
                ['description' => 'Drop-in Visit × 2', 'quantity' => 2, 'unit_price' => 25.00, 'amount' => 50.00],
            ]);
        }

        // Emma - outstanding invoice
        $inv2 = Invoice::firstOrCreate(
            ['user_id' => $emma->id, 'invoice_number' => 'PC-' . date('Y') . '-0002'],
            [
                'status'         => 'sent',
                'subtotal'       => 300.00,
                'gst'            => 15.00,
                'surcharge'      => 9.14,
                'tip'            => 0.00,
                'total'          => 324.14,
                'billing_method' => 'credit_card',
                'due_date'       => now()->addWeek(),
                'notes'          => 'Monthly subscription — December',
            ]
        );
        if ($inv2->lineItems()->count() === 0) {
            $inv2->lineItems()->createMany([
                ['description' => '60-min Walk × 4', 'quantity' => 4, 'unit_price' => 50.00, 'amount' => 200.00],
                ['description' => 'Day Boarding × 1', 'quantity' => 1, 'unit_price' => 100.00, 'amount' => 100.00],
            ]);
        }

        // Marcus - outstanding invoice
        $inv3 = Invoice::firstOrCreate(
            ['user_id' => $marcus->id, 'invoice_number' => 'PC-' . date('Y') . '-0003'],
            [
                'status'         => 'sent',
                'subtotal'       => 120.00,
                'gst'            => 6.00,
                'surcharge'      => 0.00,
                'tip'            => 0.00,
                'total'          => 126.00,
                'billing_method' => 'e_transfer',
                'due_date'       => now()->addDays(5),
            ]
        );
        if ($inv3->lineItems()->count() === 0) {
            $inv3->lineItems()->createMany([
                ['description' => '60-min Walk × 3', 'quantity' => 3, 'unit_price' => 40.00, 'amount' => 120.00],
            ]);
        }

        $this->command->info('Test data seeded: 3 clients, 5 dogs, appointments, messages, invoices.');
        $this->command->info('Login: emma@test.com / password123');
        $this->command->info('Login: marcus@test.com / password123');
        $this->command->info('Login: sarah@test.com / password123');
    }

    private function makeAppointment(User $user, array $dogIds, string $serviceType, string $timeBlock, \Carbon\Carbon $time, string $status, int $duration): void
    {
        $existing = Appointment::where('user_id', $user->id)
            ->where('service_type', $serviceType)
            ->whereDate('scheduled_time', $time->toDateString())
            ->first();

        if ($existing) return;

        $appt = Appointment::create([
            'user_id'          => $user->id,
            'service_type'     => $serviceType,
            'scheduled_time'   => $time,
            'client_time_block'=> $timeBlock,
            'duration_minutes' => $duration,
            'status'           => $status,
            'check_in_time'    => in_array($status, ['checked_in', 'completed']) ? $time : null,
            'check_out_time'   => $status === 'completed' ? $time->copy()->addMinutes($duration) : null,
        ]);

        $appt->dogs()->attach($dogIds);
    }

    private function seedConversation(User $client, User $admin, array $messages): void
    {
        $conversation = Conversation::firstOrCreate(['user_id' => $client->id]);

        if ($conversation->messages()->count() > 0) return;

        foreach ($messages as $msg) {
            $sender = $msg['sender'];
            $hoursAgo = $msg['hours_ago'];
            $conversation->messages()->create([
                'sender_id'  => $sender->id,
                'type'       => 'text',
                'body'       => $msg['body'],
                'created_at' => now()->subHours($hoursAgo),
                'updated_at' => now()->subHours($hoursAgo),
            ]);
        }
    }
}
