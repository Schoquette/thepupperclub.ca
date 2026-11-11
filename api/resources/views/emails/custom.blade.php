@extends('emails.layout')

@section('body')
  @if(!empty($heading))
    <h2>{{ $heading }}</h2>
  @endif
  <div class="content">
    {{-- $content is rendered unescaped -- it must already be safe HTML
         (pre-escaped user text, or admin-authored content) by the time
         it reaches this view. Never pass raw, unescaped user input here. --}}
    {!! $content !!}
  </div>
@endsection
