@extends('emails.layout')

@section('body')
  <h2>{{ $title }}</h2>
  <div class="content">
    {!! $content !!}
  </div>

  @if(!empty($attachments))
    <div class="attachments">
      <div class="attachments-label">Attachments</div>
      @foreach($attachments as $att)
        <span class="attachment-item">{{ $att['original_name'] }}</span>
      @endforeach
    </div>
  @endif
@endsection
