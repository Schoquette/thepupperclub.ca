@extends('emails.layout')

@section('body')
  <div style="text-align: center; margin-bottom: 24px;">
    <h2 style="margin: 0 0 6px; font-size: 22px; letter-spacing: 2px; text-transform: uppercase;">Visit Report Card</h2>
    <div style="color: #C9A24D; font-size: 15px;">{{ $dogNames }}</div>
  </div>

  @if(!empty($dogPhotoUrl))
  <div style="text-align: center; margin-bottom: 20px;">
    <img src="{{ $dogPhotoUrl }}" alt="Dog photo" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid #C9A24D;" />
  </div>
  @endif

  @if($photoUrl)
  <div style="margin: 0 -40px 20px; overflow: hidden;">
    <img src="{{ $photoUrl }}" alt="Visit photo" style="width: 100%; max-height: 320px; object-fit: cover; display: block;">
  </div>
  @endif

  @if($arrivalTime || $departureTime)
  <div style="display: flex; padding: 16px 0; border-bottom: 1px solid #F6F3EE; gap: 24px; margin-bottom: 20px;">
    @if($arrivalTime)
    <div style="flex: 1; text-align: center;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #C8BFB6;">Arrived</div>
      <div style="font-size: 20px; font-weight: 700; color: #3B2F2A; margin-top: 4px;">{{ $arrivalTime }}</div>
      @if($visitDate)<div style="font-size: 12px; color: #C8BFB6; margin-top: 2px;">{{ $visitDate }}</div>@endif
    </div>
    @endif
    @if($departureTime)
    <div style="flex: 1; text-align: center;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #C8BFB6;">Departed</div>
      <div style="font-size: 20px; font-weight: 700; color: #3B2F2A; margin-top: 4px;">{{ $departureTime }}</div>
    </div>
    @endif
  </div>
  @endif

  @if(count($checklist))
  <div style="margin-bottom: 20px;">
    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #C8BFB6; margin-bottom: 14px;">Activities & Care</div>
    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
      @foreach($checklist as $item)
      <span style="display: inline-flex; align-items: center; gap: 6px; background: #F6F3EE; border-radius: 20px; padding: 6px 12px; font-size: 13px; color: #3B2F2A;">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: #C9A24D; display: inline-block;"></span>{{ $item }}
      </span>
      @endforeach
    </div>
    @if($specialTrip)
    <div style="background: #FDF8EE; border: 1px solid rgba(201,162,77,0.2); border-radius: 12px; padding: 12px 16px; margin-top: 12px; font-size: 13px;">
      <strong style="color: #C9A24D;">Special Trip:</strong> {{ $specialTrip }}
    </div>
    @endif
  </div>
  @endif

  @if($report->notes)
  <div style="margin-bottom: 20px;">
    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #C8BFB6; margin-bottom: 14px;">Notes</div>
    <div style="font-size: 14px; line-height: 1.6; color: #3B2F2A;">{{ $report->notes }}</div>
  </div>
  @endif

  <div style="text-align: center; padding-top: 16px; border-top: 1px solid #F6F3EE;">
    <p style="text-align: center; margin: 20px 0;">
      <a href="{{ $portalUrl }}" style="display: inline-block; background: #C9A24D; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 14px;">View All Report Cards</a>
    </p>
    <p style="font-size: 12px; color: #C8BFB6; line-height: 1.5;">
      With love from <span style="color: #C9A24D;">The Pupper Club</span><br>
      {{ $client->name }}, you can view and download all your report cards in your client portal.
    </p>
  </div>
@endsection
