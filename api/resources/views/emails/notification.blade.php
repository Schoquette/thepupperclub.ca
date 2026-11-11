@extends('emails.layout')

@section('body')
  <h2>{{ $title }}</h2>
  <div class="content">
    {{-- $content is rendered unescaped -- it must already be safe HTML
         (pre-escaped user text, or admin-authored content) by the time
         it reaches this view. Never pass raw, unescaped user input here. --}}
    {!! $content !!}
  </div>
@endsection
