<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: DejaVu Sans, sans-serif; color: #3B2F2A; font-size: 11px; padding: 32px; }

    .header { border-bottom: 2px solid #C9A24D; padding-bottom: 14px; margin-bottom: 20px; }
    .logo    { font-size: 20px; font-weight: bold; color: #3B2F2A; }
    .tagline { font-size: 10px; color: #C8BFB6; margin-top: 2px; }
    .meta    { font-size: 10px; color: #C8BFB6; margin-top: 6px; }

    .section          { margin-bottom: 18px; }
    .section-title    { font-size: 12px; font-weight: bold; color: #C9A24D; border-bottom: 1px solid #F6F3EE; padding-bottom: 4px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em; }

    table.fields      { width: 100%; border-collapse: collapse; }
    table.fields td   { padding: 4px 6px; vertical-align: top; font-size: 11px; }
    table.fields .lbl { width: 38%; color: #C8BFB6; }
    table.fields .val { color: #3B2F2A; font-weight: 500; }

    .dog-card         { background: #F6F3EE; border-radius: 5px; padding: 10px 12px; margin-bottom: 10px; }
    .dog-name         { font-size: 12px; font-weight: bold; color: #3B2F2A; margin-bottom: 6px; }

    .footer           { margin-top: 30px; border-top: 1px solid #F6F3EE; padding-top: 10px; font-size: 9px; color: #C8BFB6; text-align: center; }
  </style>
</head>
<body>

  <div class="header">
    <div class="logo">The Pupper Club</div>
    <div class="tagline">Premium Dog Walking & Care</div>
    <div class="meta">
      Client Intake Form &mdash; {{ $client->name }}<br>
      Submitted: {{ $submittedAt }}
    </div>
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
      <tr><td class="lbl">Preferred Walk Times</td><td class="val">{{ $profile->preferred_walk_times }}</td></tr>
      @endif
      @if($profile->preferred_walk_length)
      <tr><td class="lbl">Walk Length</td><td class="val">{{ $profile->preferred_walk_length }}</td></tr>
      @endif
      @if($profile->preferred_update_method)
      <tr><td class="lbl">Update Method</td><td class="val">{{ $profile->preferred_update_method }}</td></tr>
      @endif
      @if($profile->report_detail_level)
      <tr><td class="lbl">Report Detail Level</td><td class="val">{{ $profile->report_detail_level }}</td></tr>
      @endif
      @if($profile->billing_method)
      <tr><td class="lbl">Billing Method</td><td class="val">{{ ucfirst(str_replace('_', ' ', $profile->billing_method)) }}</td></tr>
      @endif
      @if($profile->food_storage_location)
      <tr><td class="lbl">Food Storage</td><td class="val">{{ $profile->food_storage_location }}</td></tr>
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
        <tr><td class="lbl">Breed</td><td class="val">{{ $dog->breed ?? '—' }}</td></tr>
        @if($dog->date_of_birth)
        <tr><td class="lbl">Date of Birth</td><td class="val">{{ $dog->date_of_birth }}</td></tr>
        @endif
        @if($dog->weight_kg)
        <tr><td class="lbl">Weight</td><td class="val">{{ $dog->weight_kg }} kg</td></tr>
        @endif
        @if($dog->sex)
        <tr><td class="lbl">Sex</td><td class="val">{{ ucfirst($dog->sex) }}</td></tr>
        @endif
        @if($dog->colour)
        <tr><td class="lbl">Colour / Markings</td><td class="val">{{ $dog->colour }}</td></tr>
        @endif
        @if($dog->microchip_number)
        <tr><td class="lbl">Microchip</td><td class="val">{{ $dog->microchip_number }}</td></tr>
        @endif
        @if($dog->feeding_instructions)
        <tr><td class="lbl">Feeding Instructions</td><td class="val">{{ $dog->feeding_instructions }}</td></tr>
        @endif
        @if($dog->medical_conditions)
        <tr><td class="lbl">Medical Conditions</td><td class="val">{{ $dog->medical_conditions }}</td></tr>
        @endif
        @if($dog->allergies)
        <tr><td class="lbl">Allergies</td><td class="val">{{ $dog->allergies }}</td></tr>
        @endif
        @if($dog->behavioural_notes)
        <tr><td class="lbl">Behavioural Notes</td><td class="val">{{ $dog->behavioural_notes }}</td></tr>
        @endif
        <tr><td class="lbl">Bite History</td><td class="val">{{ $dog->has_bite_history ? 'Yes' : 'No' }}</td></tr>
        <tr><td class="lbl">Spayed / Neutered</td><td class="val">{{ $dog->is_spayed_neutered ? 'Yes' : 'No' }}</td></tr>
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

  <div class="footer">
    The Pupper Club &bull; Client Intake Form &bull; {{ $submittedAt }}
  </div>

</body>
</html>
