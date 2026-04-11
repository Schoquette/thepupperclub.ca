@extends('emails.layout')

@section('body')
  @if(!empty($heading))
    <h2>{{ $heading }}</h2>
  @endif
  <div class="content">
    {!! $content !!}
  </div>
@endsection
