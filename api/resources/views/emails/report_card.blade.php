@extends('emails.layout')

@section('body')
  <div style="text-align: center; margin-bottom: 24px;">
    <h2 style="margin: 0 0 6px; font-family: 'Playfair Display SC', Georgia, 'Times New Roman', serif; font-size: 22px; letter-spacing: 2px; text-transform: uppercase; color: #3B2F2A;">Visit Report Card</h2>
    <div style="color: #C9A24D; font-size: 15px; font-family: 'Lato', 'Helvetica Neue', Arial, sans-serif;">{{ $dogNames }}</div>
  </div>

  @if(!empty($dogPhotoUrl))
  <div style="text-align: center; margin-bottom: 20px;">
    <img src="{{ $dogPhotoUrl }}" alt="Dog photo" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid #C9A24D;" />
  </div>
  @endif

  {{-- All visit photos --}}
  @if(!empty($photoUrls))
  <div style="margin: 0 -40px 20px; overflow: hidden;">
    @foreach($photoUrls as $i => $url)
    <img src="{{ $url }}" alt="Visit photo {{ $i + 1 }}" style="width: 100%; max-height: 320px; object-fit: cover; display: block;{{ $i > 0 ? ' margin-top: 8px;' : '' }}">
    @endforeach
  </div>
  @endif

  @if($arrivalTime || $departureTime)
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 16px 0; border-bottom: 1px solid #F6F3EE; margin-bottom: 20px;">
    <tr>
      @if($arrivalTime)
      <td style="text-align: center; vertical-align: top;">
        <div style="font-family: 'Lato', 'Helvetica Neue', Arial, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #C8BFB6;">Arrived</div>
        <div style="font-family: 'Lato', 'Helvetica Neue', Arial, sans-serif; font-size: 20px; font-weight: 700; color: #3B2F2A; margin-top: 4px;">{{ $arrivalTime }}</div>
        @if($visitDate)<div style="font-family: 'Lato', 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #C8BFB6; margin-top: 2px;">{{ $visitDate }}</div>@endif
      </td>
      @endif
      @if($departureTime)
      <td style="text-align: center; vertical-align: top;">
        <div style="font-family: 'Lato', 'Helvetica Neue', Arial, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #C8BFB6;">Departed</div>
        <div style="font-family: 'Lato', 'Helvetica Neue', Arial, sans-serif; font-size: 20px; font-weight: 700; color: #3B2F2A; margin-top: 4px;">{{ $departureTime }}</div>
      </td>
      @endif
    </tr>
  </table>
  @endif

  {{-- Per-dog sections --}}
  @foreach($dogSections as $section)
    @if($section['name'])
    <div style="margin-bottom: 6px; margin-top: 24px; padding-bottom: 6px; border-bottom: 2px solid #C9A24D;">
      <span style="font-family: 'Lato', 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 700; color: #3B2F2A;">{{ $section['name'] }}</span>
    </div>
    @endif

    @if(count($section['checklist']))
    <div style="margin-bottom: 16px;">
      <div style="font-family: 'Lato', 'Helvetica Neue', Arial, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #C8BFB6; margin-bottom: 14px;">Activities & Care</div>
      <div>
        @foreach($section['checklist'] as $item)
        <span style="display: inline-block; background: #F6F3EE; border-radius: 20px; padding: 6px 12px; font-size: 13px; color: #3B2F2A; margin: 0 6px 6px 0; font-family: 'Lato', 'Helvetica Neue', Arial, sans-serif;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #C9A24D; vertical-align: middle; margin-right: 6px;"></span>{{ $item }}
        </span>
        @endforeach
      </div>
    </div>
    @endif

    @if(!empty($section['notes']))
    <div style="margin-bottom: 16px;">
      <div style="font-family: 'Lato', 'Helvetica Neue', Arial, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #C8BFB6; margin-bottom: 8px;">{{ $section['name'] ? 'Notes for ' . $section['name'] : 'Notes' }}</div>
      <div style="font-family: 'Lato', 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #3B2F2A; background: #F6F3EE; border-radius: 12px; padding: 14px 16px;">{{ $section['notes'] }}</div>
    </div>
    @endif
  @endforeach

  @if($specialTrip)
  <div style="background: #FDF8EE; border: 1px solid rgba(201,162,77,0.2); border-radius: 12px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; font-family: 'Lato', 'Helvetica Neue', Arial, sans-serif;">
    <strong style="color: #C9A24D;">Special Trip:</strong> {{ $specialTrip }}
  </div>
  @endif

  <div style="text-align: center; padding-top: 16px; border-top: 1px solid #F6F3EE;">
    <p style="text-align: center; margin: 20px 0;">
      <a href="{{ $portalUrl }}" style="display: inline-block; background: #C9A24D; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 14px; font-family: 'Lato', 'Helvetica Neue', Arial, sans-serif;">View All Report Cards</a>
    </p>
    <p style="font-family: 'Lato', 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #C8BFB6; line-height: 1.5;">
      With love from <span style="color: #C9A24D;">The Pupper Club</span>
    </p>
  </div>
@endsection
