<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: DejaVu Sans, sans-serif; color: #3B2F2A; font-size: 11px; padding: 0; }

    /* Header — branded blue bar with logo */
    .header {
      background: #6492D8;
      padding: 28px 40px;
      text-align: center;
    }
    .header img {
      max-width: 180px;
      height: auto;
    }
    .header-text {
      color: #ffffff;
      font-size: 10px;
      margin-top: 8px;
      letter-spacing: 0.05em;
    }

    .body-content { padding: 32px 40px; }

    .doc-title {
      font-size: 16px;
      font-weight: bold;
      color: #3B2F2A;
      margin-bottom: 4px;
    }
    .doc-meta {
      font-size: 10px;
      color: #C8BFB6;
      margin-bottom: 24px;
      padding-bottom: 14px;
      border-bottom: 2px solid #C9A24D;
    }

    .section          { margin-bottom: 20px; }
    .section-title    {
      font-size: 12px;
      font-weight: bold;
      color: #C9A24D;
      border-bottom: 1px solid #F6F3EE;
      padding-bottom: 4px;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    table.fields      { width: 100%; border-collapse: collapse; }
    table.fields td   { padding: 4px 6px; vertical-align: top; font-size: 11px; }
    table.fields .lbl { width: 38%; color: #C8BFB6; }
    table.fields .val { color: #3B2F2A; font-weight: 500; }

    .dog-card         { background: #F6F3EE; border-radius: 5px; padding: 12px 14px; margin-bottom: 12px; page-break-inside: avoid; }
    .dog-name         { font-size: 13px; font-weight: bold; color: #3B2F2A; margin-bottom: 8px; border-bottom: 1px solid #e0dbd5; padding-bottom: 6px; }

    .med-item         { background: #ffffff; border-radius: 3px; padding: 4px 8px; margin-bottom: 4px; font-size: 10px; }

    .tag              { display: inline-block; background: #6492D8; color: #ffffff; border-radius: 3px; padding: 2px 8px; margin: 2px 4px 2px 0; font-size: 9px; }

    .footer {
      margin-top: 30px;
      border-top: 2px solid #C9A24D;
      padding: 16px 40px;
      font-size: 9px;
      color: #C8BFB6;
      text-align: center;
    }
    .footer strong { color: #3B2F2A; }
  </style>
</head>
<body>

  {{-- Branded header --}}
  <div class="header">
    @php
      $logoPath = public_path('images/logo-cream-stacked.png');
    @endphp
    @if(file_exists($logoPath))
      <img src="{{ $logoPath }}" alt="The Pupper Club" />
    @else
      <div style="color:#fff;font-size:20px;font-weight:bold;">The Pupper Club</div>
    @endif
    <div class="header-text">Premium Dog Walking &amp; Care &bull; Port Moody, BC</div>
  </div>

  <div class="body-content">

    <div class="doc-title">Client Intake Form</div>
    <div class="doc-meta">
      {{ $client->name }} &mdash; Submitted {{ $submittedAt }}
    </div>

    {{-- Contact Information --}}
    <div class="section">
      <div class="section-title">Contact Information</div>
      <table class="fields">
        <tr><td class="lbl">Full Name</td><td class="val">{{ $client->name ?? '—' }}</td></tr>
        <tr><td class="lbl">Email</td><td class="val">{{ $client->email ?? '—' }}</td></tr>
        @if($profile)
        <tr><td class="lbl">Phone</td><td class="val">{{ $profile->phone ?? '—' }}</td></tr>
        <tr><td class="lbl">Address</td><td class="val">
          {{ implode(', ', array_filter([$profile->address, $profile->city, $profile->province, $profile->postal_code])) ?: '—' }}
        </td></tr>
        @endif
      </table>
    </div>

    {{-- Emergency Contact --}}
    @if($profile && ($profile->emergency_contact_name || $profile->emergency_contact_phone))
    <div class="section">
      <div class="section-title">Emergency Contact</div>
      <table class="fields">
        <tr><td class="lbl">Name</td><td class="val">{{ $profile->emergency_contact_name ?? '—' }}</td></tr>
        <tr><td class="lbl">Phone</td><td class="val">{{ $profile->emergency_contact_phone ?? '—' }}</td></tr>
        <tr><td class="lbl">Relationship</td><td class="val">{{ $profile->emergency_contact_relationship ?? '—' }}</td></tr>
      </table>
    </div>
    @endif

    {{-- Veterinarian --}}
    @if($profile && ($profile->vet_clinic_name || $profile->vet_phone))
    <div class="section">
      <div class="section-title">Veterinarian</div>
      <table class="fields">
        <tr><td class="lbl">Clinic</td><td class="val">{{ $profile->vet_clinic_name ?? '—' }}</td></tr>
        <tr><td class="lbl">Phone</td><td class="val">{{ $profile->vet_phone ?? '—' }}</td></tr>
        <tr><td class="lbl">Address</td><td class="val">{{ $profile->vet_address ?? '—' }}</td></tr>
      </table>
    </div>
    @endif

    {{-- Home Access --}}
    @if($homeAccess)
    <div class="section">
      <div class="section-title">Home Access</div>
      <table class="fields">
        @if($homeAccess->entry_instructions)
        <tr><td class="lbl">Entry Instructions</td><td class="val">{{ $homeAccess->entry_instructions }}</td></tr>
        @endif
        @if($homeAccess->lockbox_code)
        <tr><td class="lbl">Lockbox Code</td><td class="val">{{ $homeAccess->lockbox_code }}</td></tr>
        @endif
        @if($homeAccess->door_code)
        <tr><td class="lbl">Door Code</td><td class="val">{{ $homeAccess->door_code }}</td></tr>
        @endif
        @if($homeAccess->alarm_code)
        <tr><td class="lbl">Alarm Code</td><td class="val">{{ $homeAccess->alarm_code }}</td></tr>
        @endif
        @if($homeAccess->key_location)
        <tr><td class="lbl">Key Location</td><td class="val">{{ $homeAccess->key_location }}</td></tr>
        @endif
        @if($homeAccess->parking_instructions)
        <tr><td class="lbl">Parking Instructions</td><td class="val">{{ $homeAccess->parking_instructions }}</td></tr>
        @endif
        @if($homeAccess->notes)
        <tr><td class="lbl">Notes</td><td class="val">{{ $homeAccess->notes }}</td></tr>
        @endif
      </table>
    </div>
    @endif

    {{-- Communication Preferences --}}
    @if($profile)
    <div class="section">
      <div class="section-title">Communication Preferences</div>
      <table class="fields">
        @php
          $channels = [];
          if ($profile->notify_app ?? true) $channels[] = 'App Notifications';
          if ($profile->notify_email) $channels[] = 'Email';
          if ($profile->notify_sms) $channels[] = 'Text Message (SMS)';
        @endphp
        <tr><td class="lbl">Preferred Channels</td><td class="val">{{ count($channels) ? implode(', ', $channels) : 'None selected' }}</td></tr>
      </table>
    </div>
    @endif

    {{-- Service Preferences --}}
    @if($profile)
    <div class="section">
      <div class="section-title">Service Preferences</div>
      <table class="fields">
        @if($profile->preferred_walk_days)
        <tr><td class="lbl">Preferred Walk Days</td><td class="val">
          {{ is_array($profile->preferred_walk_days) ? implode(', ', $profile->preferred_walk_days) : $profile->preferred_walk_days }}
        </td></tr>
        @endif
        @if($profile->preferred_walk_times)
        <tr><td class="lbl">Preferred Walk Times</td><td class="val">
          {{ is_array($profile->preferred_walk_times) ? implode(', ', $profile->preferred_walk_times) : $profile->preferred_walk_times }}
        </td></tr>
        @endif
        @if($profile->preferred_walk_length)
        <tr><td class="lbl">Walk Length</td><td class="val">{{ $profile->preferred_walk_length }}</td></tr>
        @endif
        @if($profile->preferred_update_method)
        <tr><td class="lbl">Update Method</td><td class="val">
          {{ is_array($profile->preferred_update_method) ? implode(', ', $profile->preferred_update_method) : $profile->preferred_update_method }}
        </td></tr>
        @endif
        @if($profile->report_detail_level)
        <tr><td class="lbl">Report Detail Level</td><td class="val">{{ $profile->report_detail_level }}</td></tr>
        @endif
        @if($profile->billing_method)
        @php
        $billingLabel = match($profile->billing_method) {
          'credit_card' => 'Credit Card',
          'e_transfer' => 'E-Transfer',
          'interac_pad' => 'Interac/PAD',
          'cash' => 'Cash',
          default => ucfirst(str_replace('_', ' ', $profile->billing_method)),
        };
        @endphp
        <tr><td class="lbl">Billing Method</td><td class="val">{{ $billingLabel }}</td></tr>
        @endif
        @if($profile->food_storage_location)
        <tr><td class="lbl">Food Storage</td><td class="val">{{ $profile->food_storage_location }}</td></tr>
        @endif
        @if($profile->customized_care_options)
        <tr><td class="lbl">Customized Care</td><td class="val">
          {{ is_array($profile->customized_care_options) ? implode(', ', $profile->customized_care_options) : $profile->customized_care_options }}
        </td></tr>
        @endif
      </table>
    </div>
    @endif

    {{-- Dogs --}}
    @if($dogs && $dogs->count() > 0)
    <div class="section">
      <div class="section-title">Dogs ({{ $dogs->count() }})</div>
      @foreach($dogs as $dog)
      <div class="dog-card">
        <div class="dog-name">{{ $dog->name }}</div>
        <table class="fields">
          {{-- Basic Info --}}
          <tr><td class="lbl">Breed</td><td class="val">{{ $dog->breed ?? '—' }}</td></tr>
          @if($dog->date_of_birth)
          <tr><td class="lbl">Date of Birth</td><td class="val">{{ \Carbon\Carbon::parse($dog->date_of_birth)->format('F j, Y') }}</td></tr>
          @endif
          @if($dog->weight_kg)
          <tr><td class="lbl">Weight</td><td class="val">{{ $dog->weight_kg }} lbs</td></tr>
          @endif
          @if($dog->size)
          <tr><td class="lbl">Size</td><td class="val">{{ ucfirst($dog->size) }}</td></tr>
          @endif
          @if($dog->sex)
          <tr><td class="lbl">Sex</td><td class="val">{{ ucfirst($dog->sex) }}</td></tr>
          @endif
          @if($dog->colour)
          <tr><td class="lbl">Colour / Markings</td><td class="val">{{ $dog->colour }}</td></tr>
          @endif
          @if($dog->microchip_number)
          <tr><td class="lbl">Microchip #</td><td class="val">{{ $dog->microchip_number }}</td></tr>
          @endif
          <tr><td class="lbl">Spayed / Neutered</td><td class="val">{{ $dog->spayed_neutered ? 'Yes' : 'No' }}</td></tr>

          {{-- Personality & Behaviour --}}
          @if($dog->personality_description)
          <tr><td class="lbl">Personality</td><td class="val">{{ $dog->personality_description }}</td></tr>
          @endif
          @if($dog->energy_level)
          <tr><td class="lbl">Energy Level</td><td class="val">{{ ucfirst($dog->energy_level) }}</td></tr>
          @endif
          @if($dog->interaction_dogs)
          <tr><td class="lbl">With Other Dogs</td><td class="val">{{ $dog->interaction_dogs }}</td></tr>
          @endif
          @if($dog->interaction_strangers)
          <tr><td class="lbl">With Strangers</td><td class="val">{{ $dog->interaction_strangers }}</td></tr>
          @endif
          @if($dog->interaction_children)
          <tr><td class="lbl">With Children</td><td class="val">{{ $dog->interaction_children }}</td></tr>
          @endif
          @if($dog->triggers)
          <tr><td class="lbl">Triggers / Fears</td><td class="val">{{ $dog->triggers }}</td></tr>
          @endif
          <tr><td class="lbl">Bite History</td><td class="val">{{ $dog->bite_history ? 'Yes' : 'No' }}</td></tr>
          @if($dog->bite_history && $dog->bite_history_notes)
          <tr><td class="lbl">Bite History Notes</td><td class="val">{{ $dog->bite_history_notes }}</td></tr>
          @endif

          {{-- Medical --}}
          @if($dog->medical_conditions)
          <tr><td class="lbl">Medical Conditions</td><td class="val">{{ $dog->medical_conditions }}</td></tr>
          @endif
          @if($dog->allergies)
          <tr><td class="lbl">Allergies</td><td class="val">{{ $dog->allergies }}</td></tr>
          @endif
          @if($dog->medications && is_array($dog->medications) && count($dog->medications) > 0)
          <tr><td class="lbl">Medications</td><td class="val">
            @foreach($dog->medications as $med)
              <div class="med-item">{{ $med['name'] ?? '' }}@if(!empty($med['dosage'])) &mdash; {{ $med['dosage'] }}@endif</div>
            @endforeach
          </td></tr>
          @endif
          @if(!is_null($dog->administer_medication_on_visits))
          <tr><td class="lbl">Administer Meds on Visits</td><td class="val">{{ $dog->administer_medication_on_visits ? 'Yes' : 'No' }}</td></tr>
          @endif
          @if(!is_null($dog->mobility_limitations))
          <tr><td class="lbl">Mobility Limitations</td><td class="val">{{ $dog->mobility_limitations ? 'Yes' : 'No' }}</td></tr>
          @endif
          @if($dog->recent_surgeries)
          <tr><td class="lbl">Recent Surgeries</td><td class="val">{{ $dog->recent_surgeries }}</td></tr>
          @endif

          {{-- Walk Preferences --}}
          @if($dog->preferred_walk_style && is_array($dog->preferred_walk_style) && count($dog->preferred_walk_style) > 0)
          <tr><td class="lbl">Walk Style</td><td class="val">
            @foreach($dog->preferred_walk_style as $style)
              <span class="tag">{{ $style }}</span>
            @endforeach
          </td></tr>
          @endif
          @if($dog->preferred_gear && is_array($dog->preferred_gear) && count($dog->preferred_gear) > 0)
          <tr><td class="lbl">Gear / Equipment</td><td class="val">
            @foreach($dog->preferred_gear as $gear)
              <span class="tag">{{ $gear }}</span>
            @endforeach
          </td></tr>
          @endif
          @if($dog->treats_allowed)
          <tr><td class="lbl">Treats Allowed</td><td class="val">{{ ucfirst($dog->treats_allowed) }}</td></tr>
          @endif
          @if($dog->treats_notes)
          <tr><td class="lbl">Treats Notes</td><td class="val">{{ $dog->treats_notes }}</td></tr>
          @endif
          @if($dog->training_commands)
          <tr><td class="lbl">Training Commands</td><td class="val">{{ $dog->training_commands }}</td></tr>
          @endif
          @if($dog->avoid_on_walks)
          <tr><td class="lbl">Avoid on Walks</td><td class="val">{{ $dog->avoid_on_walks }}</td></tr>
          @endif
        </table>
      </div>
      @endforeach
    </div>
    @endif

    {{-- Additional Notes --}}
    @if($profile && ($profile->what_great_care_looks_like || $profile->biggest_concern || $profile->comfort_factors || $profile->additional_notes))
    <div class="section">
      <div class="section-title">Additional Notes</div>
      <table class="fields">
        @if($profile->what_great_care_looks_like)
        <tr><td class="lbl">What great care looks like</td><td class="val">{{ $profile->what_great_care_looks_like }}</td></tr>
        @endif
        @if($profile->biggest_concern)
        <tr><td class="lbl">Biggest concern</td><td class="val">{{ $profile->biggest_concern }}</td></tr>
        @endif
        @if($profile->comfort_factors)
        <tr><td class="lbl">Comfort factors</td><td class="val">{{ $profile->comfort_factors }}</td></tr>
        @endif
        @if($profile->referral_source)
        <tr><td class="lbl">Referral source</td><td class="val">{{ $profile->referral_source }}</td></tr>
        @endif
        @if($profile->additional_notes)
        <tr><td class="lbl">Additional notes</td><td class="val">{{ $profile->additional_notes }}</td></tr>
        @endif
      </table>
    </div>
    @endif

  </div>{{-- end .body-content --}}

  <div class="footer">
    <strong>The Pupper Club</strong> &bull; Premium Dog Walking &amp; Care &bull; Port Moody, BC<br>
    thepupperclub.ca &bull; Client Intake Form &bull; {{ $submittedAt }}
  </div>

</body>
</html>
