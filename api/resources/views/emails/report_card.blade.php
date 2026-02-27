<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Visit Report Card</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #F6F3EE; font-family: Arial, Helvetica, sans-serif; color: #3B2F2A; }
  .wrapper { max-width: 560px; margin: 32px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 24px rgba(59,47,42,0.10); }
  .header { background: #3B2F2A; padding: 28px 32px; text-align: center; }
  .header h1 { color: #F6F3EE; font-size: 22px; letter-spacing: 2px; text-transform: uppercase; font-weight: 700; }
  .header .dog { color: #C9A24D; font-size: 15px; margin-top: 6px; }
  .photo img { width: 100%; max-height: 320px; object-fit: cover; display: block; }
  .times { display: flex; padding: 20px 32px; border-bottom: 1px solid #F6F3EE; gap: 24px; }
  .time-block { flex: 1; text-align: center; }
  .time-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #C8BFB6; }
  .time-value { font-size: 20px; font-weight: 700; color: #3B2F2A; margin-top: 4px; }
  .time-date { font-size: 12px; color: #C8BFB6; margin-top: 2px; }
  .section { padding: 20px 32px; border-bottom: 1px solid #F6F3EE; }
  .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #C8BFB6; margin-bottom: 14px; }
  .checklist { display: flex; flex-wrap: wrap; gap: 8px; }
  .check-item { display: inline-flex; align-items: center; gap: 6px; background: #F6F3EE; border-radius: 20px; padding: 6px 12px; font-size: 13px; color: #3B2F2A; }
  .check-dot { width: 8px; height: 8px; border-radius: 50%; background: #C9A24D; flex-shrink: 0; }
  .special-trip { background: #FDF8EE; border: 1px solid #C9A24D30; border-radius: 12px; padding: 12px 16px; margin-top: 12px; font-size: 13px; }
  .special-trip strong { color: #C9A24D; }
  .notes { font-size: 14px; line-height: 1.6; color: #3B2F2A; }
  .footer { padding: 20px 32px; text-align: center; }
  .btn { display: inline-block; background: #C9A24D; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 12px; font-size: 14px; font-weight: 700; margin-bottom: 16px; }
  .footer-text { font-size: 12px; color: #C8BFB6; line-height: 1.5; }
  .gold { color: #C9A24D; }
</style>
</head>
<body>
<div class="wrapper">

  <div class="header">
    <h1>Visit Report Card</h1>
    <div class="dog">🐾 {{ $dogNames }}</div>
  </div>

  @if($photoUrl)
  <div class="photo">
    <img src="{{ $photoUrl }}" alt="Visit photo">
  </div>
  @endif

  @if($arrivalTime || $departureTime)
  <div class="times">
    @if($arrivalTime)
    <div class="time-block">
      <div class="time-label">Arrived</div>
      <div class="time-value">{{ $arrivalTime }}</div>
      @if($visitDate)<div class="time-date">{{ $visitDate }}</div>@endif
    </div>
    @endif
    @if($departureTime)
    <div class="time-block">
      <div class="time-label">Departed</div>
      <div class="time-value">{{ $departureTime }}</div>
    </div>
    @endif
  </div>
  @endif

  @if(count($checklist))
  <div class="section">
    <div class="section-title">Activities & Care</div>
    <div class="checklist">
      @foreach($checklist as $item)
      <span class="check-item"><span class="check-dot"></span>{{ $item }}</span>
      @endforeach
    </div>
    @if($specialTrip)
    <div class="special-trip">
      <strong>Special Trip:</strong> {{ $specialTrip }}
    </div>
    @endif
  </div>
  @endif

  @if($report->notes)
  <div class="section">
    <div class="section-title">Notes</div>
    <div class="notes">{{ $report->notes }}</div>
  </div>
  @endif

  <div class="footer">
    <a href="{{ $portalUrl }}" class="btn">View All Report Cards</a>
    <div class="footer-text">
      With love from <span class="gold">The Pupper Club</span> 🐾<br>
      {{ $client->name }}, you can view and download all your report cards in your client portal.
    </div>
  </div>

</div>
</body>
</html>
