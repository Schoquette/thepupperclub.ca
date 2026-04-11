@extends('emails.layout')

@section('body')
  <h2>{{ $title }}</h2>
  <div class="content">
    {!! $content !!}
  </div>
@endsection
